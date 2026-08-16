import { chunker } from './chunker.js';

const MAX_LAYOUT_POINTS = 4000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mapNormToRaw(raw, normOffset) {
  let rawIndex = 0;
  let normIndex = 0;
  let inWhitespace = true;
  while (rawIndex < raw.length) {
    const char = raw[rawIndex];
    if (char === '\u200B' || char === '\uFEFF') {
      rawIndex += 1;
      continue;
    }
    if (/\s/.test(char)) {
      if (!inWhitespace) {
        inWhitespace = true;
        if (normIndex === normOffset) return rawIndex;
        normIndex += 1;
      }
      rawIndex += 1;
      continue;
    }
    inWhitespace = false;
    if (normIndex === normOffset) return rawIndex;
    normIndex += 1;
    rawIndex += 1;
  }
  return raw.length;
}

function getCharacterY(node, rawOffset) {
  if (!node?.nodeValue) return null;
  const raw = node.nodeValue;
  const start = clamp(rawOffset, 0, Math.max(0, raw.length - 1));
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, Math.min(raw.length, start + 1));
  const rect = Array.from(range.getClientRects()).find((item) => item.height > 0) || range.getBoundingClientRect();
  if (!rect || (!rect.height && !rect.width)) return null;
  const root = document.scrollingElement || document.documentElement;
  const scrollTop = window.scrollY || root.scrollTop || 0;
  const y = rect.top + scrollTop;
  // 隐藏测量 DOM 是 absolute 定位，不会撑大 document.scrollHeight；
  // 如果按 document 高度校验，后半章坐标会被误判为无效。
  const measureRoot = node.parentElement?.closest?.('.wr-tts-measure-root');
  const maxY = measureRoot
    ? Math.max(measureRoot.scrollHeight || 0, measureRoot.getBoundingClientRect().height || 0)
    : Math.max(root.scrollHeight || 0, document.body?.scrollHeight || 0);
  return Number.isFinite(y) && y >= 0 && y <= maxY + 50 ? y : null;
}

function findTextAlignment(domText, chapterText) {
  if (!domText || !chapterText) return null;
  if (domText === chapterText) return { domStart: 0, chapterStart: 0 };
  const domStart = domText.indexOf(chapterText);
  if (domStart >= 0) return { domStart, chapterStart: 0 };
  const chapterStart = chapterText.indexOf(domText);
  if (chapterStart >= 0) return { domStart: 0, chapterStart };
  return null;
}

function dedupePoints(points) {
  const sorted = points
    .filter((point) => Number.isFinite(point.offset) && Number.isFinite(point.y))
    .sort((a, b) => a.offset - b.offset || a.y - b.y);
  const result = [];
  for (const point of sorted) {
    const previous = result[result.length - 1];
    if (previous && previous.offset === point.offset) {
      previous.y = point.y;
      continue;
    }
    if (previous && Math.abs(previous.y - point.y) < 0.5) continue;
    result.push(point);
  }
  return result;
}

export function getLayoutY(layout, offset) {
  const points = layout?.points || [];
  if (!points.length) return null;
  const target = Number(offset) || 0;
  if (target <= points[0].offset) return points[0].y;
  const last = points[points.length - 1];
  if (target >= last.offset) return last.y;

  let low = 0;
  let high = points.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].offset <= target) low = middle;
    else high = middle;
  }
  const previous = points[low];
  const next = points[high];
  const lineLength = Math.max(1, next.offset - previous.offset);
  const transitionChars = clamp(Math.round(lineLength * 0.12), 1, 4);
  const transitionStart = next.offset - transitionChars;
  const transitionEnd = next.offset + 1;
  if (target <= transitionStart) return previous.y;
  const progress = clamp((target - transitionStart) / Math.max(1, transitionEnd - transitionStart), 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  return previous.y + (next.y - previous.y) * eased;
}

/**
 * 反查：给定文档流 y 坐标，估算对应的归一化字符偏移。
 * 主要用于 Canvas 阅读器下根据当前页 canvas 边界确定页首/页尾正文偏移。
 */
export function getOffsetAtY(layout, y) {
  const points = layout?.points || [];
  if (!points.length) return null;
  const target = Number(y) || 0;
  if (target <= points[0].y) return points[0].offset;
  const last = points[points.length - 1];
  if (target >= last.y) return last.offset;

  let low = 0;
  let high = points.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].y <= target) low = middle;
    else high = middle;
  }
  const previous = points[low];
  const next = points[high];
  if (next.y <= previous.y) return previous.offset;
  const progress = clamp((target - previous.y) / (next.y - previous.y), 0, 1);
  return Math.round(previous.offset + (next.offset - previous.offset) * progress);
}

/**
 * 反查：给定文档流 y 坐标，返回第一个 y >= 目标值的排版点偏移。
 * 用于“页尾”的排他边界：下一页首行如果已经越过页尾 canvas，应取下一页首行偏移。
 */
export function getOffsetAfterY(layout, y) {
  const points = layout?.points || [];
  if (!points.length) return null;
  const target = Number(y) || 0;
  if (target <= points[0].y) return points[0].offset;
  const last = points[points.length - 1];
  if (target > last.y) return last.offset + 1;

  let low = 0;
  let high = points.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].y < target) low = middle;
    else high = middle;
  }
  return points[high].y >= target ? points[high].offset : null;
}

/**
 * 从预渲染 DOM 建立行起点表。只保存 y 发生变化的位置，避免逐字符常驻数据。
 */
export function buildLayoutMap(root, chapterText, rangeStart, rangeEnd) {
  if (!root || !root.isConnected) return null;
  const normalizedChapter = chunker.normalizeText(chapterText);
  const domText = chunker.normalizeText(root.innerText || root.textContent || '');
  const alignment = findTextAlignment(domText, normalizedChapter);
  if (!alignment) return null;

  const safeStart = clamp(Number(rangeStart) || 0, 0, normalizedChapter.length);
  const safeEnd = clamp(Number(rangeEnd) || normalizedChapter.length, safeStart, normalizedChapter.length);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const points = [];
  let searchFrom = 0;
  let node;

  const addNodeLines = (textNode, raw, norm, chapterNodeStart) => {
    const localStart = clamp(safeStart - chapterNodeStart, 0, norm.length - 1);
    const localEnd = clamp(safeEnd - chapterNodeStart - 1, 0, norm.length - 1);
    if (localEnd < localStart) return;
    const measured = new Map();
    const measure = (localOffset) => {
      const key = clamp(Math.round(localOffset), localStart, localEnd);
      if (measured.has(key)) return measured.get(key);
      const y = getCharacterY(textNode, mapNormToRaw(raw, key));
      measured.set(key, y);
      return y;
    };
    const add = (localOffset, y) => {
      if (!Number.isFinite(y) || points.length >= MAX_LAYOUT_POINTS) return;
      points.push({ offset: chapterNodeStart + localOffset, y });
    };
    const scan = (left, right, leftY, rightY) => {
      if (points.length >= MAX_LAYOUT_POINTS || right <= left || !Number.isFinite(leftY) || !Number.isFinite(rightY)) return;
      if (Math.abs(leftY - rightY) < 0.5) return;
      if (right - left <= 1) {
        add(right, rightY);
        return;
      }
      const middle = Math.floor((left + right) / 2);
      const middleY = measure(middle);
      scan(left, middle, leftY, middleY);
      scan(middle, right, middleY, rightY);
    };

    const startY = measure(localStart);
    const endY = measure(localEnd);
    add(localStart, startY);
    scan(localStart, localEnd, startY, endY);
  };

  while ((node = walker.nextNode())) {
    const raw = node.nodeValue || '';
    const norm = chunker.normalizeText(raw);
    if (!norm) continue;
    const domNodeStart = domText.indexOf(norm, searchFrom);
    if (domNodeStart < 0) continue;
    searchFrom = domNodeStart + norm.length;
    const chapterNodeStart = domNodeStart - alignment.domStart + alignment.chapterStart;
    const chapterNodeEnd = chapterNodeStart + norm.length;
    if (chapterNodeEnd <= safeStart || chapterNodeStart >= safeEnd) continue;
    addNodeLines(node, raw, norm, chapterNodeStart);
  }

  const compact = dedupePoints(points);
  if (!compact.length) return null;
  const span = Math.max(1, safeEnd - safeStart);
  const coverageTolerance = Math.max(80, span * 0.08);
  if (compact[0].offset > safeStart + coverageTolerance) return null;
  if (compact[compact.length - 1].offset < safeEnd - coverageTolerance) return null;
  for (let index = 1; index < compact.length; index += 1) {
    if (compact[index].y + 2 < compact[index - 1].y) return null;
  }
  return {
    points: compact,
    rangeStart: safeStart,
    rangeEnd: safeEnd,
    sourceLength: normalizedChapter.length,
    createdAt: Date.now()
  };
}
