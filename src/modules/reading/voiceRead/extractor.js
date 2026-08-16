import { chunker } from './chunker.js';
import { apiChapter } from './apiChapter.js';
import { buildLayoutMap, getOffsetAfterY, getOffsetAtY } from './layoutMap.js';

const LEGACY_TTS_PANEL_ID = 'wr-tts-panel';
const VOICE_QUICK_ID = 'wr-voice-quick';

/** 同一章多页时，记录第一页页尾偏移，供直接进入第二页/末页时恢复页首 */
const PAGE_BOUNDARY_CACHE_KEY = 'weread_page_boundary_cache';
const pageBoundaryCache = new Map();

function readPageBoundaryCacheFromStorage() {
  try {
    const value = GM_getValue(PAGE_BOUNDARY_CACHE_KEY, {});
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    return {};
  }
}

function writePageBoundaryCacheToStorage() {
  try {
    const obj = {};
    for (const [key, entry] of pageBoundaryCache.entries()) {
      obj[key] = entry;
    }
    GM_setValue(PAGE_BOUNDARY_CACHE_KEY, obj);
  } catch (error) {
    // 存储不可用时仅保留内存缓存
  }
}

const extractorState = {
  cachedStore: null,
  cachedVm: null,
  cachedReaderState: null,
  cachedPreRenderHtml: null,
  /** 观察器捕获到的预渲染 DOM 节点（存引用，测量文本位置用；可能已被移除） */
  cachedPreRenderNode: null,
  preRenderObserver: null,
  currentChapterUid: '',
  lastResult: null,
  webpackRequire: null,
  webpackStore: null,
  webpackDecryption: null,
  webpackVm: null,
  webpackDiagnostic: null,
  lastDiagnosticSignature: ''
};

function nextTick(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms || 50));
}

function htmlToText(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript, svg, canvas, audio, video, iframe').forEach((el) => el.remove());
    const bodyText = doc.body && (doc.body.innerText || doc.body.textContent);
    return chunker.normalizeText(bodyText || html.replace(/<[^>]+>/g, ' '));
  } catch (error) {
    return chunker.normalizeText(html.replace(/<[^>]+>/g, ' '));
  }
}

function getPreRenderDomText(el) {
  if (!el) return '';
  try {
    if (typeof el.cloneNode === 'function') {
      const clone = el.cloneNode(true);
      if (typeof clone.querySelectorAll === 'function') {
        clone.querySelectorAll('script, style, noscript, svg, canvas, audio, video, iframe').forEach((node) => node.remove());
        return chunker.normalizeText(clone.innerText || clone.textContent || '');
      }
    }
  } catch (error) {
    // 克隆失败时回退到原始节点文本
  }
  return chunker.normalizeText(el.innerText || el.textContent || '');
}

function findAppElement() {
  return document.querySelector('#app') || document.body;
}

function isObjectLike(value) {
  return Boolean(value) && (typeof value === 'object' || typeof value === 'function');
}

function readProperty(value, key) {
  if (!isObjectLike(value) && typeof value !== 'string') return undefined;
  try {
    return value[key];
  } catch (error) {
    return undefined;
  }
}

function safeObjectKeys(value) {
  if (!isObjectLike(value)) return [];
  try {
    return Object.keys(value);
  } catch (error) {
    return [];
  }
}

function uniqueObjects(list) {
  const result = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function isStoreLike(value) {
  if (!isObjectLike(value)) return false;
  return Boolean(
    readProperty(value, 'state') &&
    typeof readProperty(value, 'dispatch') === 'function' &&
    typeof readProperty(value, 'commit') === 'function'
  );
}

function isReaderStateLike(value) {
  if (!isObjectLike(value)) return false;
  if (
    readProperty(value, 'currentChapter') ||
    readProperty(value, 'currentSection') ||
    readProperty(value, 'currentBookSection') ||
    readProperty(value, 'chapterContentHtml') ||
    readProperty(value, 'horizontalReaderChapterContentHtml')
  ) {
    return true;
  }
  return (
    readProperty(value, 'bookId') !== undefined &&
    (readProperty(value, 'chapterUid') !== undefined ||
      readProperty(value, 'currentChapterUid') !== undefined)
  );
}

const CONTENT_KEY_RE = /(ContentHtml|ChapterContent|RenderContent|PreRender|Chapter|Section)/i;
const NOISE_KEY_RE = /^(Target|Highlight|Selection|Settings|Config|Theme|Style|Layout|Header|Footer|Nav|Menu|Toolbar|Panel|Dialog|Modal|Toast|Error|Loading|Scroll|Window|Viewport|Size|Color|Font|Speed|Voice|Rate|Profile|Timer|Anchor)/i;
const METADATA_KEY_RE = /^(currentChapter|currentSection|currentBookSection|bookSection|chapters|chapterList|chapterInfo|chapterMeta|chapterTitle|chapterNames|sectionInfo|sectionIndex|currentSectionIdx|currentSectionIndex|sectionUid|currentSectionUid|chapterUid|currentChapterUid|chapterId|bookSectionId|sectionCount|chapterCount|nextChapter|prevChapter|previousChapter|nextSection|prevSection|lastChapter|firstChapter|bookChapter)$/i;
const UI_CONTAINER_SELECTORS = [
  '#readerTopBar',
  '.readerTopBar',
  '.readerNav',
  'nav',
  'header',
  'footer',
  'aside',
  '.catalog',
  '.bookIntro',
  '.bookInfo',
  '.bookReview',
  '.recommend',
  '.bookComment',
  '.footer',
  '.header',
  '.readerMenu',
  '.readerToolbar'
];
const RENDER_FIELD_KEYS = [
  'tempContent',
  'preRenderHtml',
  'renderHtml',
  'currentSectionHtml',
  'chapterContentHtml',
  'preRenderContent',
  'renderedHtml',
  'horizontalReaderChapterContentHtml'
];
const TEXT_LAYER_SELECTORS = [
  '#renderTargetContent [data-wr-role="text"]',
  '[data-wr-role="text"]',
  '.readerTextLayer',
  '.textLayer',
  '#preRenderContent',
  '#preRenderContents',
  '.preRenderContent',
  '.preRenderContainer'
];
const TEXT_LAYER_CONTAINER_SELECTORS = [
  '#renderTargetContent .passage-content',
  '.passage-content',
  '.passageContent',
  '.readerPassageContent'
];
const PRE_RENDER_CONTAINER_SELECTORS = [
  '#preRenderContent',
  '#preRenderContents',
  '.preRenderContent',
  '.preRenderContainer'
];

function queryUniqueContainers(selectors) {
  const seen = new Set();
  const list = [];
  for (const selector of selectors) {
    const nodes = typeof document.querySelectorAll === 'function'
      ? Array.from(document.querySelectorAll(selector))
      : [];
    for (const node of nodes) {
      if (node && !seen.has(node)) {
        seen.add(node);
        list.push(node);
      }
    }
  }
  return list;
}

function getTextLayerLineThreshold(span) {
  if (span && typeof getComputedStyle === 'function') {
    try {
      const lineHeight = parseFloat(getComputedStyle(span).lineHeight);
      if (Number.isFinite(lineHeight) && lineHeight > 0) {
        return Math.max(8, lineHeight * 0.4);
      }
    } catch (error) {
      // 计算样式不可用时退回固定阈值
    }
  }
  return 12;
}

/**
 * 文本层重建结果偶尔会在中段丢失/多出个别字符（损坏字符、零宽空格等），
 * 导致整段精确匹配失败。这里退而求其次：用“最长可匹配前缀”定位页首，
 * 再用“页尾方向的最长可匹配后缀”补出页末，保证起始位置不会落到整章比例估算。
 */
function findApproximateTextRange(chapterText, pageText) {
  const text = chunker.normalizeText(chapterText);
  const page = chunker.normalizeText(pageText);
  if (!text || !page) return null;

  const exact = text.indexOf(page);
  if (exact >= 0) return { start: exact, end: exact + page.length };

  let prefixLen = Math.min(page.length, 160);
  while (prefixLen >= 8) {
    const prefix = page.slice(0, prefixLen);
    const start = text.indexOf(prefix);
    if (start >= 0) {
      let end = start + prefixLen;
      const maxSuffix = Math.min(page.length - prefixLen, 160);
      for (let suffixLen = maxSuffix; suffixLen >= 8; suffixLen -= 1) {
        const suffix = page.slice(page.length - suffixLen);
        const found = text.indexOf(suffix, end);
        if (found >= 0 && found + suffixLen >= end) {
          end = found + suffixLen;
          break;
        }
      }
      return { start, end };
    }
    prefixLen = Math.floor(prefixLen * 0.8);
  }
  return null;
}

function collectTextLayerSpans() {
  const spans = [];
  if (typeof document.querySelectorAll !== 'function') return spans;
  const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
  for (const passage of passages) {
    const nodes = passage.querySelectorAll ? Array.from(passage.querySelectorAll('[data-wr-role="text"]')) : [];
    for (const span of nodes) {
      const ch = span.textContent;
      if (!ch) continue;
      try {
        const rect = span.getBoundingClientRect();
        if (rect && typeof rect.left === 'number' && typeof rect.top === 'number') {
          spans.push({ ch, x: rect.left, y: rect.top, rect, span });
        }
      } catch (error) {
        // 跳过无法测量的字符
      }
    }
  }
  return spans;
}

/**
 * 在 Canvas 阅读器的文本层里直接按视觉顺序查找短语，返回文档流 y 坐标。
 * 这是“从文字”定位最准确的来源：pre-render DOM 可能缺失或布局与当前页不一致。
 */
function locatePhraseInTextLayer(normPhrase) {
  if (!normPhrase || typeof document.querySelectorAll !== 'function') return null;
  const spans = collectTextLayerSpans();
  if (!spans.length) return null;

  spans.sort((a, b) => a.y - b.y || a.x - b.x);
  const threshold = getTextLayerLineThreshold(spans[0]?.span);
  const lines = [];
  for (const point of spans) {
    const last = lines[lines.length - 1];
    if (!last || point.y - last.centroid > threshold) {
      lines.push({ centroid: point.y, points: [point] });
    } else {
      last.points.push(point);
      last.centroid = last.points.reduce((sum, item) => sum + item.y, 0) / last.points.length;
    }
  }

  const items = [];
  for (const line of lines) {
    line.points.sort((a, b) => a.x - b.x);
    for (const point of line.points) items.push(point);
  }
  const text = chunker.normalizeText(items.map((item) => item.ch).join(''));
  const index = text.indexOf(normPhrase);
  if (index < 0) return null;

  // normalizeText 可能折叠空白/零宽字符，直接按字符索引回退到 items 不绝对可靠；
  // 这里用未归一化的视觉文本做一次前缀匹配，取最接近的 span。
  const rawText = items.map((item) => item.ch).join('');
  let rawIndex = 0;
  let normIndex = 0;
  let inWhitespace = true;
  while (rawIndex < rawText.length && normIndex < index) {
    const ch = rawText[rawIndex];
    if (ch === '\u200B' || ch === '\uFEFF') {
      rawIndex += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (!inWhitespace) {
        inWhitespace = true;
        normIndex += 1;
      }
      rawIndex += 1;
      continue;
    }
    inWhitespace = false;
    normIndex += 1;
    rawIndex += 1;
  }
  const target = items[Math.min(rawIndex, items.length - 1)];
  if (!target) return null;
  const scrollY = window.scrollY || document.scrollingElement?.scrollTop || 0;
  const y = (target.rect?.top ?? target.span.getBoundingClientRect().top) + scrollY;
  return Number.isFinite(y) ? { y, rawIndex } : null;
}

/**
 * 扫描页面，找到“文本层开始出现”的滚动位置以及该位置第一个 passage 的正文偏移。
 * 用于 Canvas 区域与文本层区域的混合分页映射。
 */
async function findTextLayerBoundary(text) {
  const normText = chunker.normalizeText(text || '');
  if (!normText || typeof document.querySelectorAll !== 'function') return null;
  const doc = document.scrollingElement || document.documentElement;
  const maxScroll = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
  const step = Math.max(120, Math.round((window.innerHeight || 800) * 0.25));
  for (let y = 0; y <= maxScroll + step; y += step) {
    window.scrollTo(0, Math.min(maxScroll, y));
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
    for (const passage of passages) {
      const pageText = reconstructTextLayerPageText(passage);
      if (!pageText) continue;
      const range = findApproximateTextRange(normText, pageText);
      if (range) {
        return { scroll: Math.min(maxScroll, y), offset: range.start };
      }
    }
  }
  return null;
}

function isTextLayerPageVisible(passage) {
  const spans = passage.querySelectorAll
    ? Array.from(passage.querySelectorAll('[data-wr-role="text"]'))
    : [];
  const viewportHeight = Math.max(
    Number(window.innerHeight) || 0,
    Number(document.documentElement && document.documentElement.clientHeight) || 0
  );
  const aheadMargin = 600;
  for (const span of spans) {
    if (!span.textContent) continue;
    try {
      const rect = span.getBoundingClientRect();
      if (rect && rect.bottom >= 0 && rect.top >= -80 && rect.top <= viewportHeight + aheadMargin) {
        return true;
      }
    } catch (error) {
      // 单个字符定位失败时忽略，继续检查其它字符
    }
  }
  return false;
}

function reconstructTextLayerPageText(passage) {
  const spans = passage.querySelectorAll
    ? Array.from(passage.querySelectorAll('[data-wr-role="text"]'))
    : [];
  const points = [];
  for (const span of spans) {
    const ch = span.textContent;
    if (!ch) continue;
    try {
      const rect = span.getBoundingClientRect();
      if (rect && typeof rect.left === 'number' && typeof rect.top === 'number') {
        points.push({ ch, x: rect.left, y: rect.top });
      }
    } catch (error) {
      // 跳过无法测量的字符
    }
  }
  if (!points.length) {
    // 极少数情况下字符 span 无法测量坐标时，保留逐字聚合兜底。
    return chunker.normalizeText(passage.textContent || passage.innerText || '');
  }

  points.sort((a, b) => a.y - b.y || a.x - b.x);
  const threshold = getTextLayerLineThreshold(spans[0]);
  const lines = [];
  for (const point of points) {
    const last = lines[lines.length - 1];
    if (!last || point.y - last.centroid > threshold) {
      lines.push({ centroid: point.y, points: [point] });
    } else {
      last.points.push(point);
      last.centroid = last.points.reduce((sum, item) => sum + item.y, 0) / last.points.length;
    }
  }

  return chunker.normalizeText(
    lines.map((line) => {
      line.points.sort((a, b) => a.x - b.x);
      return line.points.map((item) => item.ch).join('');
    }).join('')
  );
}

function collectVueInstances() {
  const seen = new Set();
  const list = [];

  function push(vm) {
    if (!vm || typeof vm !== 'object' || seen.has(vm)) return;
    seen.add(vm);
    list.push(vm);
  }

  function getSubTree(vm) {
    if (!vm) return null;
    if (vm.$subTree) return vm.$subTree;
    if (vm.$.subTree) return vm.$.subTree;
    if (vm._instance && vm._instance.subTree) return vm._instance.subTree;
    if (vm.proxy && vm.proxy.$subTree) return vm.proxy.$subTree;
    if (vm.proxy && vm.proxy.$.subTree) return vm.proxy.$.subTree;
    return null;
  }

  function walkVNode(vnode) {
    if (!vnode || typeof vnode !== 'object') return;
    if (vnode.component) push(vnode.component.proxy || vnode.component);
    if (vnode.component && vnode.component.subTree) walkVNode(vnode.component.subTree);
    if (vnode.subTree) walkVNode(vnode.subTree);
    if (Array.isArray(vnode.children)) vnode.children.forEach(walkVNode);
    if (Array.isArray(vnode.dynamicChildren)) vnode.dynamicChildren.forEach(walkVNode);
    if (vnode.suspense && vnode.suspense.activeBranch) walkVNode(vnode.suspense.activeBranch);
  }

  const app = findAppElement();
  if (app) {
    if (app.__vue__) push(app.__vue__);
    if (app.__vue_app__ && app.__vue_app__._instance) {
      const root = app.__vue_app__._instance;
      push(root.proxy || root);
    }
    if (app.__vueParentComponent) {
      push(app.__vueParentComponent.proxy || app.__vueParentComponent);
    }
  }

  for (let i = 0; i < list.length; i += 1) {
    const vm = list[i];
    const children = vm.$children || [];
    for (const child of children) push(child);
    const subTree = getSubTree(vm);
    if (subTree) walkVNode(subTree);
  }

  const elements = app && app.querySelectorAll ? app.querySelectorAll('*') : document.querySelectorAll('*');
  for (const el of elements) {
    const owner = el.__vueParentComponent;
    if (owner) push(owner.proxy || owner);
  }

  return list;
}

function getStore(instances) {
  const candidates = [];
  const push = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  for (const vm of instances) {
    push(readProperty(vm, '$store'));
    push(readProperty(vm, 'store'));
    push(readProperty(vm, 'readerStore'));
    const proxy = readProperty(vm, 'proxy');
    if (isObjectLike(proxy)) {
      push(readProperty(proxy, '$store'));
      push(readProperty(proxy, 'store'));
      push(readProperty(proxy, 'readerStore'));
    }
    const data = readProperty(vm, '$data');
    if (isObjectLike(data)) {
      push(readProperty(data, '$store'));
      push(readProperty(data, 'store'));
      push(readProperty(data, 'readerStore'));
    }
  }

  for (const candidate of candidates) {
    if (isStoreLike(candidate)) return candidate;
  }
  for (const candidate of candidates) {
    if (candidate && readProperty(candidate, 'state')) return candidate;
  }
  return null;
}

function getReaderState(store, vm) {
  const state = store ? readProperty(store, 'state') : null;
  if (isObjectLike(state)) {
    for (const holderKey of ['book', 'books']) {
      const holder = readProperty(state, holderKey);
      if (!isObjectLike(holder)) continue;
      for (const key of ['reader', 'readerState', 'readerData', 'readerStore', 'bookReader', 'read']) {
        const candidate = readProperty(holder, key);
        if (isReaderStateLike(candidate)) return candidate;
      }
    }
    for (const key of ['reader', 'readerState', 'readerData', 'readerStore', 'bookReader', 'read']) {
      const candidate = readProperty(state, key);
      if (isReaderStateLike(candidate)) return candidate;
    }
    for (const key of safeObjectKeys(state)) {
      const candidate = readProperty(state, key);
      if (isReaderStateLike(candidate)) return candidate;
    }
  }

  for (const source of [vm, vm ? readProperty(vm, 'proxy') : null, vm ? readProperty(vm, '$data') : null]) {
    if (!isObjectLike(source)) continue;
    for (const key of ['reader', 'readerState', 'readerData', 'readerStore', 'bookReader', 'read']) {
      const candidate = readProperty(source, key);
      if (isReaderStateLike(candidate)) return candidate;
    }
    for (const key of safeObjectKeys(source)) {
      const candidate = readProperty(source, key);
      if (isReaderStateLike(candidate)) return candidate;
    }
  }
  return null;
}

function findReaderVms(instances) {
  const candidates = [];
  const isReaderVm = (vm) => {
    if (!isObjectLike(vm)) return false;
    if (typeof readProperty(vm, 'decryptRenderHtml') === 'function') return true;
    if (typeof readProperty(vm, 'preRender') === 'function') {
      if (readProperty(vm, 'preRenderHtml') !== undefined) return true;
      const refs = readProperty(vm, '$refs');
      if (isObjectLike(refs) && (readProperty(refs, 'preRenderContainer') || readProperty(refs, 'renderTargetCanvasContainer'))) {
        return true;
      }
    }
    for (const key of [
      'tempContent',
      'isShowPreRender',
      'preRenderHtml',
      'renderHtml',
      'chapterContentHtml',
      'horizontalReaderChapterContentHtml',
      'currentChapter',
      'currentSection',
      'currentBookSection',
      'currentChapterUid',
      'chapterUid',
      'chapterContent'
    ]) {
      if (readProperty(vm, key) !== undefined) return true;
    }
    if (readProperty(vm, 'getCurrentSection') != null || readProperty(vm, 'getCurrentSectionIdx') != null) return true;
    return false;
  };

  for (const vm of instances) {
    if (isReaderVm(vm)) candidates.push(vm);
    const proxy = readProperty(vm, 'proxy');
    if (isObjectLike(proxy) && isReaderVm(proxy)) candidates.push(proxy);
  }

  return uniqueObjects(candidates);
}

function findReaderVm(instances) {
  return findReaderVms(instances)[0] || null;
}

function getUidFromHolder(holder) {
  if (Array.isArray(holder)) {
    for (const item of holder) {
      const uid = getUidFromHolder(item);
      if (uid) return uid;
    }
    return '';
  }
  if (!isObjectLike(holder)) return '';
  for (const key of ['chapterUid', 'chapterId', 'uid', 'id']) {
    const value = readProperty(holder, key);
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text && text !== '0' && text !== 'undefined' && text !== 'null') return text;
    }
  }
  return '';
}

function getChapterUidFromLocation() {
  if (typeof location === 'undefined' || !location || !location.href) return '';

  try {
    const href = String(location.href || '');
    const pathMatch = href.match(/\/reader\/[^/?#]+?k([A-Za-z0-9_-]+)/i);
    if (pathMatch) return pathMatch[1];

    const url = new URL(href);
    return String(url.searchParams.get('chapterUid') || url.searchParams.get('chapterId') || '');
  } catch (error) {
    return '';
  }
}

function getCurrentChapterUid(readerState, vm) {
  const holders = [];
  if (isObjectLike(readerState)) {
    for (const key of ['currentChapter', 'currentSection', 'currentBookSection', 'bookSection', 'chapter']) {
      const holder = readProperty(readerState, key);
      if (holder) holders.push(holder);
    }
    const direct = getUidFromHolder(readerState);
    if (direct) return direct;
  }

  for (const source of [vm, vm ? readProperty(vm, 'proxy') : null, vm ? readProperty(vm, '$data') : null]) {
    if (!isObjectLike(source)) continue;
    for (const key of ['currentChapter', 'currentSection', 'currentBookSection', 'bookSection', 'chapter']) {
      const holder = readProperty(source, key);
      if (holder) holders.push(holder);
    }
    for (const key of ['currentChapterUid', 'chapterUid', 'currentSectionUid', 'chapterId']) {
      const value = readProperty(source, key);
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        if (text) return text;
      }
    }
  }

  for (const holder of holders) {
    const uid = getUidFromHolder(holder);
    if (uid) return uid;
  }
  return getChapterUidFromLocation();
}

function resetPreRenderCache() {
  extractorState.cachedPreRenderHtml = null;
  extractorState.cachedPreRenderNode = null;
}

function getLiveCachedChapterUid() {
  const readerState = getReaderState(extractorState.cachedStore, extractorState.cachedVm);
  return getCurrentChapterUid(readerState, extractorState.cachedVm);
}

function getPageWindow() {
  try {
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
  } catch (error) {
    // 未授予 unsafeWindow 时使用当前 window
  }
  return window;
}

function captureWebpackRequire() {
  if (
    extractorState.webpackRequire &&
    extractorState.webpackStore &&
    extractorState.webpackDecryption
  ) {
    return extractorState.webpackRequire;
  }

  const pageWindow = getPageWindow();
  const webpackJsonp = pageWindow && pageWindow.webpackJsonp;
  const diagnostic = {
    hasUnsafeWindow: pageWindow !== window,
    hasWebpackJsonp: Boolean(webpackJsonp && typeof webpackJsonp.push === 'function'),
    capturedRequire: Boolean(extractorState.webpackRequire),
    moduleCount: 0,
    foundStore: Boolean(extractorState.webpackStore),
    foundDecryption: Boolean(extractorState.webpackDecryption),
    error: ''
  };
  extractorState.webpackDiagnostic = diagnostic;
  if (!webpackJsonp || typeof webpackJsonp.push !== 'function') {
    return extractorState.webpackRequire;
  }

  let captured = null;
  let bridge = null;
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const chunkId = 'wr_tts_chunk_' + suffix;
  const moduleId = 'wr_tts_module_' + suffix;

  try {
    // 捕获和扫描都必须在页面主世界执行。跨 Tampermonkey 沙箱枚举模块缓存会得到空对象。
    if (typeof pageWindow.Function === 'function') {
      const bootstrap = pageWindow.Function(
        'chunkId',
        'moduleId',
        [
          'var result = {',
          '  webpackRequire: null,',
          '  store: null,',
          '  decryption: null,',
          '  diagnostic: { capturedRequire: false, moduleCount: 0, foundStore: false, foundDecryption: false, error: "" }',
          '};',
          'try {',
          'var modules = {};',
          'modules[moduleId] = function(module, exports, webpackRequire) {',
          '  result.webpackRequire = webpackRequire;',
          '};',
          'window.webpackJsonp.push([[chunkId], modules, [[moduleId]]]);',
          'result.diagnostic.capturedRequire = !!result.webpackRequire;',
          'var cache = result.webpackRequire && result.webpackRequire.c;',
          'var moduleIds = cache && typeof cache === "object" ? Object.keys(cache) : [];',
          'result.diagnostic.moduleCount = moduleIds.length;',
          'var seen = [];',
          'var inspected = 0;',
          'function inspect(value, depth) {',
          '  if (!value || (typeof value !== "object" && typeof value !== "function")) return;',
          '  if (result.store && result.decryption) return;',
          '  if (seen.indexOf(value) >= 0 || inspected >= 60000) return;',
          '  seen.push(value);',
          '  inspected += 1;',
          '  if (!result.store) {',
          '    try {',
          '      if (value.state && value.state.reader && typeof value.dispatch === "function" && typeof value.commit === "function") {',
          '        result.store = value;',
          '      }',
          '    } catch (error) {}',
          '  }',
          '  if (!result.decryption) {',
          '    try {',
          '      var decrypt = value.decryption;',
          '      if (typeof decrypt === "function") {',
          '        result.decryption = function() { return decrypt.apply(value, arguments); };',
          '      }',
          '    } catch (error) {}',
          '  }',
          '  if (depth <= 0 || (result.store && result.decryption)) return;',
          '  var keys = [];',
          '  try { keys = Object.keys(value).slice(0, 100); } catch (error) { return; }',
          '  for (var i = 0; i < keys.length; i += 1) {',
          '    try { inspect(value[keys[i]], depth - 1); } catch (error) {}',
          '    if (result.store && result.decryption) return;',
          '  }',
          '}',
          'for (var i = 0; i < moduleIds.length; i += 1) {',
          '  var cachedModule = cache[moduleIds[i]];',
          '  inspect(cachedModule && cachedModule.exports, 3);',
          '  if (result.store && result.decryption) break;',
          '}',
          'result.diagnostic.foundStore = !!result.store;',
          'result.diagnostic.foundDecryption = !!result.decryption;',
          '} catch (error) {',
          '  result.diagnostic.error = String(error && (error.stack || error.message) || error);',
          '}',
          'return result;'
        ].join('\n')
      );
      bridge = bootstrap(chunkId, moduleId);
      captured = bridge && bridge.webpackRequire;
    } else {
      const modules = {};
      modules[moduleId] = function captureRequire(module, exports, webpackRequire) {
        captured = webpackRequire;
      };
      webpackJsonp.push([[chunkId], modules, [[moduleId]]]);
    }
  } catch (error) {
    diagnostic.error = String(error && (error.stack || error.message) || error);
    return extractorState.webpackRequire;
  }

  if (captured && captured.c) extractorState.webpackRequire = captured;
  if (bridge?.store) extractorState.webpackStore = bridge.store;
  if (bridge?.decryption) extractorState.webpackDecryption = bridge.decryption;
  if (bridge?.diagnostic) {
    diagnostic.capturedRequire = Boolean(bridge.diagnostic.capturedRequire);
    diagnostic.moduleCount = Number(bridge.diagnostic.moduleCount) || 0;
    diagnostic.foundStore = Boolean(bridge.diagnostic.foundStore);
    diagnostic.foundDecryption = Boolean(bridge.diagnostic.foundDecryption);
    diagnostic.error = String(bridge.diagnostic.error || '');
  } else if (extractorState.webpackRequire?.c) {
    diagnostic.capturedRequire = true;
    try {
      diagnostic.moduleCount = Object.keys(extractorState.webpackRequire.c).length;
    } catch (error) {
      diagnostic.error = String(error && (error.stack || error.message) || error);
    }
  }
  return extractorState.webpackRequire;
}

function inspectWebpackExport(value, found) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return;

  if (!found.store) {
    try {
      const state = value.state;
      if (
        state &&
        state.reader &&
        typeof value.dispatch === 'function' &&
        typeof value.commit === 'function'
      ) {
        found.store = value;
      }
    } catch (error) {
      // 某些模块导出使用会抛错的 getter，跳过即可
    }
  }

  if (!found.decryption) {
    try {
      if (typeof value.decryption === 'function') found.decryption = value.decryption;
    } catch (error) {
      // 同上
    }
  }
}

function findWebpackReaderBridge() {
  if (extractorState.webpackStore && extractorState.webpackDecryption) {
    return {
      store: extractorState.webpackStore,
      decryption: extractorState.webpackDecryption,
      vm: extractorState.webpackVm
    };
  }

  const webpackRequire = captureWebpackRequire();
  const cache = webpackRequire && webpackRequire.c;
  if (!cache || typeof cache !== 'object') return null;

  const found = {
    store: extractorState.webpackStore,
    decryption: extractorState.webpackDecryption
  };

  for (const module of Object.values(cache)) {
    const exported = module && module.exports;
    inspectWebpackExport(exported, found);
    if (exported && (typeof exported === 'object' || typeof exported === 'function')) {
      try {
        inspectWebpackExport(exported.default, found);
        if (!found.store || !found.decryption) {
          Object.keys(exported).slice(0, 100).forEach((key) => {
            inspectWebpackExport(exported[key], found);
          });
        }
      } catch (error) {
        // 当前模块不可枚举时继续下一个模块
      }
    }
    if (found.store && found.decryption) break;
  }

  if (extractorState.webpackDiagnostic) {
    extractorState.webpackDiagnostic.foundStore = Boolean(found.store);
    extractorState.webpackDiagnostic.foundDecryption = Boolean(found.decryption);
  }

  if (!found.store || !found.decryption) return null;

  extractorState.webpackStore = found.store;
  extractorState.webpackDecryption = found.decryption;
  if (!extractorState.webpackVm) {
    extractorState.webpackVm = {
      isWereadWebpackBridge: true,
      get $store() {
        return extractorState.webpackStore;
      },
      get bookId() {
        return String(extractorState.webpackStore?.state?.reader?.bookId || '');
      },
      decryptRenderHtml(value, chapterUid, sectionIndex) {
        return extractorState.webpackDecryption(
          value,
          this.bookId,
          chapterUid,
          sectionIndex
        );
      }
    };
  }

  return {
    store: extractorState.webpackStore,
    decryption: extractorState.webpackDecryption,
    vm: extractorState.webpackVm
  };
}

function warnExtractionFailure(details) {
  const canvas = Boolean(document.querySelector('.wr_canvasContainer, .readerChapterContent canvas'));
  const textLayerNodeCount = document.querySelectorAll('#renderTargetContent [data-wr-role="text"]').length;
  const diagnostic = {
    ...extractorState.webpackDiagnostic,
    ...details,
    canvas,
    textLayerNodeCount
  };
  const signature = JSON.stringify(diagnostic);
  if (signature === extractorState.lastDiagnosticSignature) return;
  extractorState.lastDiagnosticSignature = signature;
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[WereadTTS] 未找到章节正文', diagnostic);
  }
}

function refreshReaderContext() {
  const instances = collectVueInstances();
  let store = getStore(instances);
  const readerVms = findReaderVms(instances);
  let source = 'Vue';
  const hasVueDecryptor = readerVms.some(
    (candidate) => typeof readProperty(candidate, 'decryptRenderHtml') === 'function'
  );
  const bridge = findWebpackReaderBridge();
  if (bridge) {
    if (!store) store = bridge.store;
    if (!readerVms.some((candidate) => candidate === bridge.vm)) readerVms.push(bridge.vm);
    if (!hasVueDecryptor) source = 'WeReadStore';
  }
  const vm = readerVms[0] || null;
  const readerState = getReaderState(store, vm);
  const uid = getCurrentChapterUid(readerState, vm);
  const previousUid = extractorState.currentChapterUid;

  extractorState.cachedStore = store;
  extractorState.cachedVm = vm;
  extractorState.cachedReaderState = readerState;
  extractorState.currentChapterUid = uid;

  if (previousUid !== uid && (previousUid || uid)) {
    resetPreRenderCache();
  }

  return { instances, store, readerVms, vm, readerState, uid, source };
}

function isStaleTextForChapter(uid, text) {
  if (!uid || !extractorState.lastResult?.chapterUid) return false;
  if (uid === extractorState.lastResult.chapterUid) return false;
  return chunker.normalizeText(text) === extractorState.lastResult.text;
}

function rememberResult(result) {
  const text = chunker.normalizeText(result?.text);
  if (!chunker.isLikelyChapterText(text)) return result;
  extractorState.lastResult = {
    chapterUid: String(result.chapterUid || ''),
    text
  };
  return { ...result, text };
}

function findCachedPlaintext(instances, uid) {
  let best = null;
  let bestScore = -Infinity;

  for (const vm of instances) {
    const candidates = [];
    for (const key of RENDER_FIELD_KEYS) {
      const raw = readProperty(vm, key);
      if (typeof raw === 'string' && raw) {
        candidates.push({ raw, key });
      } else if (isObjectLike(raw) && typeof readProperty(raw, 'html') === 'string') {
        candidates.push({ raw: readProperty(raw, 'html'), key });
      }
    }

    for (const candidate of candidates) {
      const text = htmlToText(candidate.raw);
      if (!chunker.isLikelyChapterText(text)) continue;
      const vmUid = getCurrentChapterUid(getReaderState(null, vm), vm);
      if (uid && vmUid !== uid) continue;
      if (isStaleTextForChapter(uid, text)) continue;
      const score = chunker.scoreChapterText(text);
      if (score > bestScore) {
        best = { text, source: 'Vue:' + candidate.key, score };
        bestScore = score;
      }
    }
  }

  return best ? { text: best.text, source: best.source } : null;
}

const ENCRYPTED_STRING_KEYS = ['value', 'data', 'html', 'content', 'raw', 'ciphertext', 'encrypted', 'text'];

function readEncryptedString(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'string') return value;
  if (!isObjectLike(value) || seen.has(value) || depth > 3) return '';
  seen.add(value);

  for (const key of ENCRYPTED_STRING_KEYS) {
    const candidate = readProperty(value, key);
    if (typeof candidate === 'string' && candidate) return candidate;
    if (Array.isArray(candidate)) {
      const joined = candidate.filter((item) => typeof item === 'string').join('');
      if (joined) return joined;
      for (const item of candidate) {
        const nested = readEncryptedString(item, seen, depth + 1);
        if (nested) return nested;
      }
    }
    if (isObjectLike(candidate)) {
      const nested = readEncryptedString(candidate, seen, depth + 1);
      if (nested) return nested;
    }
  }
  return '';
}

function resolveEntryValue(entry) {
  if (typeof entry === 'string') return entry;
  if (!isObjectLike(entry)) return '';
  const direct = readProperty(entry, 'value');
  if (typeof direct === 'string') return direct;
  if (isObjectLike(direct)) {
    const extracted = readEncryptedString(direct);
    if (extracted) return extracted;
  }
  for (const key of ENCRYPTED_STRING_KEYS) {
    const candidate = readProperty(entry, key);
    if (typeof candidate === 'string' && candidate) return candidate;
    if (isObjectLike(candidate)) {
      const extracted = readEncryptedString(candidate);
      if (extracted) return extracted;
    }
  }
  return '';
}

function getEntryChapterUid(entry, containerUid, fallbackUid) {
  if (isObjectLike(entry)) {
    for (const holder of [entry, readProperty(entry, 'chapter'), readProperty(entry, 'section')]) {
      if (!isObjectLike(holder)) continue;
      for (const key of ['chapterUid', 'chapterId', 'uid']) {
        const value = readProperty(holder, key);
        if (typeof value === 'string' || typeof value === 'number') {
          const text = String(value).trim();
          if (text) return text;
        }
      }
    }
  }
  if (containerUid) return String(containerUid);
  return fallbackUid ? String(fallbackUid) : '';
}

function countCjk(value) {
  return (String(value).match(/[\u3400-\u9FFF]/g) || []).length;
}

function isLikelyEncryptedEntry(entry) {
  if (!isObjectLike(entry)) return Boolean(resolveEntryValue(entry));
  if (typeof readProperty(entry, 'valueHasStr') === 'function') return true;
  const value = resolveEntryValue(entry);
  if (!value) return false;
  if (value.length < 8) return false;
  const cjkCount = countCjk(value);
  if (cjkCount > 0 && cjkCount / value.length > 0.8 && value.length < 80) return false;
  return true;
}

function createEntryItem(entry, containerUid, fallbackUid, index) {
  const value = resolveEntryValue(entry);
  if (!value || !isLikelyEncryptedEntry(entry)) return null;
  return {
    entry: isObjectLike(entry) ? entry : { value },
    value,
    chapterUid: getEntryChapterUid(entry, containerUid, fallbackUid),
    index,
    valueType: isObjectLike(entry) ? typeof readProperty(entry, 'value') : typeof entry,
    hasValueHasStr: isObjectLike(entry) && typeof readProperty(entry, 'valueHasStr') === 'function'
  };
}

function normalizeEntries(value, fallbackUid, containerUid = '') {
  const result = [];
  if (!value) return result;

  if (typeof value === 'string') {
    const item = createEntryItem({ value }, containerUid, fallbackUid, 0);
    if (item) result.push(item);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      // 数组本身是“字段容器”，条目 uid 应优先取条目自带字段或当前章节，
      // 不能用字段名（如 chapterContentHtml）冒充章节 uid。
      const item = createEntryItem(entry, '', fallbackUid, index);
      if (item) result.push(item);
    });
    return result;
  }

  if (isObjectLike(value)) {
    if (resolveEntryValue(value)) {
      const item = createEntryItem(value, '', fallbackUid, 0);
      if (item) result.push(item);
      return result;
    }

    safeObjectKeys(value).forEach((uid) => {
      const item = readProperty(value, uid);
      const list = Array.isArray(item) ? item : [item];
      list.forEach((entry, index) => {
        const normalized = createEntryItem(entry, uid, fallbackUid, index);
        if (normalized) result.push(normalized);
      });
    });
  }

  return result;
}

function collectEntries(readerState, vm, currentUid, instances = []) {
  const result = [];
  const seen = new Set();

  function hasContentField(value, depth = 0) {
    if (!isObjectLike(value) || depth > 1) return false;
    for (const key of safeObjectKeys(value)) {
      if (NOISE_KEY_RE.test(key) || METADATA_KEY_RE.test(key)) continue;
      if (CONTENT_KEY_RE.test(key)) return true;
      if (
        depth === 0 &&
        isObjectLike(readProperty(value, key)) &&
        hasContentField(readProperty(value, key), 1)
      ) {
        return true;
      }
    }
    return false;
  }

  function add(value, fallbackUid, containerUid = '') {
    const items = normalizeEntries(value, fallbackUid, containerUid);
    for (const item of items) {
      const key = String(item.value).slice(0, 200) + '|' + item.chapterUid + '|' + item.index;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }

  function addKnownFields(source) {
    if (!isObjectLike(source)) return;
    for (const key of ['horizontalReaderChapterContentHtml', 'chapterContentHtml']) {
      add(readProperty(source, key), currentUid, key);
    }
  }

  function scanContent(source, seenObjects = new WeakSet(), depth = 0) {
    if (!isObjectLike(source) || depth > 2 || seenObjects.has(source)) return;
    seenObjects.add(source);
    const keys = safeObjectKeys(source).slice(0, 400);
    for (const key of keys) {
      if (METADATA_KEY_RE.test(key)) {
        const value = readProperty(source, key);
        if (!hasContentField(value)) continue;
        if (depth < 2 && isObjectLike(value)) {
          scanContent(value, seenObjects, depth + 1);
        }
        continue;
      }
      if (NOISE_KEY_RE.test(key)) continue;
      const value = readProperty(source, key);
      if (CONTENT_KEY_RE.test(key)) {
        if (/(Target|Highlight|Selection)/i.test(key)) continue;
        add(value, currentUid, key);
      } else if (depth < 2 && isObjectLike(value)) {
        scanContent(value, seenObjects, depth + 1);
      }
    }
  }

  const sources = [readerState, vm, ...(Array.isArray(instances) ? instances : [])];
  for (const source of sources) {
    if (!isObjectLike(source)) continue;
    addKnownFields(source);
    scanContent(source);
  }

  return result;
}

function getRenderResultString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => getRenderResultString(item)).filter(Boolean).join('');
  }
  if (isObjectLike(value)) {
    for (const key of ['html', 'content', 'text', 'value', 'result', 'data']) {
      const text = getRenderResultString(readProperty(value, key));
      if (text) return text;
    }
  }
  return '';
}

function snapshotRenderFields(vm) {
  const before = {};
  for (const key of RENDER_FIELD_KEYS) before[key] = readProperty(vm, key);
  return before;
}

function getRenderedHtml(returned, vm, before, rejectedValues = []) {
  const candidates = [];
  const rejectedTexts = new Set(rejectedValues.map((value) => htmlToText(value)).filter(Boolean));
  const returnedString = getRenderResultString(returned);
  if (returnedString) candidates.push(returnedString);
  for (const key of RENDER_FIELD_KEYS) {
    const current = readProperty(vm, key);
    if (before && current !== before[key]) {
      const currentString = getRenderResultString(current);
      if (currentString) candidates.push(currentString);
    }
  }
  let best = '';
  let bestScore = -Infinity;
  for (const html of candidates) {
    const text = htmlToText(html);
    if (!chunker.isLikelyChapterText(text) || rejectedTexts.has(text)) continue;
    const score = chunker.scoreChapterText(text);
    if (score > bestScore) {
      best = html;
      bestScore = score;
    }
  }
  return best;
}

async function runRenderer(vm, action, rejectedValues) {
  const before = snapshotRenderFields(vm);
  const returned = await Promise.resolve(action());
  const immediate = getRenderedHtml(returned, vm, before, rejectedValues);
  if (immediate) return immediate;
  await nextTick(80);
  return getRenderedHtml(returned, vm, before, rejectedValues);
}

async function decryptEntry(vms, entry, uid, index, probe, extraVms = []) {
  const vmList = uniqueObjects([
    ...(Array.isArray(vms) ? vms : (vms ? [vms] : [])),
    ...(Array.isArray(extraVms) ? extraVms : (extraVms ? [extraVms] : []))
  ]);
  const value = resolveEntryValue(entry);
  if (!value) return '';

  const pushError = (step, error) => {
    if (!probe) return;
    if (!Array.isArray(probe.errors)) probe.errors = [];
    if (probe.errors.length >= 20) return;
    probe.errors.push({
      step,
      message: String((error && (error.stack || error.message)) || error)
    });
  };

  for (const vm of vmList) {
    if (typeof readProperty(vm, 'decryptRenderHtml') !== 'function') continue;
    const decryptRenderHtml = readProperty(vm, 'decryptRenderHtml');
    const bookId = readProperty(vm, 'bookId') || '';
    const sectionIndex = getSectionIndex(vm, index || 0);
    const calls = {
      4: () => decryptRenderHtml.call(vm, value, bookId, uid || '0', sectionIndex),
      3: () => decryptRenderHtml.call(vm, value, uid || '0', sectionIndex),
      2: () => decryptRenderHtml.call(vm, value, uid || '0'),
      1: () => decryptRenderHtml.call(vm, value)
    };

    let order;
    if (vm.isWereadWebpackBridge) {
      // 桥接方法固定为 (value, chapterUid, sectionIndex)，内部再补 bookId。
      order = [3, 2, 1, 4];
    } else if (typeof decryptRenderHtml.length === 'number' && decryptRenderHtml.length >= 2) {
      order = decryptRenderHtml.length >= 4
        ? [4, 3, 2, 1]
        : decryptRenderHtml.length === 3
          ? [3, 2, 1, 4]
          : [2, 1, 3, 4];
    } else {
      // 参数长度不可信（例如箭头函数/rest 参数）时，优先线上沿用多年的 3 参调用。
      order = [3, 2, 4, 1];
    }

    const attempts = order
      .filter((key) => key !== 4 || bookId)
      .map((key) => calls[key]);

    for (const attempt of attempts) {
      try {
        const html = await runRenderer(vm, attempt, [value]);
        if (html) return html;
      } catch (error) {
        pushError('decryptRenderHtml', error);
      }
    }
  }

  for (const vm of vmList) {
    if (readProperty(vm, 'isShowPreRender') === undefined || vm.isShowPreRender) continue;
    if (probe?.toggleAttempted?.has(vm)) continue;
    probe?.toggleAttempted?.add(vm);
    const previous = vm.isShowPreRender;
    try {
      const html = await runRenderer(vm, () => {
        vm.isShowPreRender = true;
      });
      if (html) return html;
    } catch (error) {
      pushError('isShowPreRender', error);
    } finally {
      if (vm.isShowPreRender !== previous) vm.isShowPreRender = previous;
    }
  }

  for (const vm of vmList) {
    if (typeof readProperty(vm, 'preRender') !== 'function' || readProperty(vm, 'preRenderHtml') === undefined) continue;
    if (probe?.preRenderAttempted?.has(vm)) continue;
    probe?.preRenderAttempted?.add(vm);

    const previousShouldPreRender = vm.shouldPreRender;
    try {
      const html = await runRenderer(vm, () => vm.preRender(uid || '0'));
      if (html) return html;
    } catch (error) {
      pushError('preRender', error);
    } finally {
      if (previousShouldPreRender !== undefined) vm.shouldPreRender = previousShouldPreRender;
    }
  }

  return '';
}

function getSectionIndex(vm, fallback) {
  const entryIndex = Number(fallback);
  if (Number.isInteger(entryIndex) && entryIndex >= 0) return entryIndex;
  if (!vm) return 0;
  try {
    if (typeof vm.getCurrentSectionIdx === 'function') {
      const value = vm.getCurrentSectionIdx();
      if (typeof value === 'number') return value;
    } else if (typeof vm.getCurrentSectionIdx === 'number') {
      return vm.getCurrentSectionIdx;
    }
  } catch (error) {
    // 取当前分段序号失败时回退到首段
  }
  return 0;
}

function capturePreRenderDom(root, chapterUid = getLiveCachedChapterUid()) {
  const selectors = ['#preRenderContent', '#preRenderContents', '.preRenderContent', '.preRenderContainer'];
  const nodes = root && root.querySelectorAll ? Array.from(root.querySelectorAll(selectors.join(','))) : [];
  let best = null;
  let bestScore = -Infinity;
  for (const el of nodes) {
    const text = getPreRenderDomText(el);
    const score = chunker.scoreChapterText(text);
    if (score > bestScore) {
      best = { text, html: el.innerHTML || '', node: el };
      bestScore = score;
    }
  }
  if (!best || bestScore <= 0) return null;
  extractorState.cachedPreRenderHtml = {
    text: best.text,
    html: best.html,
    source: 'preRenderDOM',
    capturedAt: Date.now(),
    chapterUid: String(chapterUid || '')
  };
  extractorState.cachedPreRenderNode = best.node;
  return extractorState.cachedPreRenderHtml;
}

function readPreRenderDom(chapterUid) {
  const uid = String(chapterUid || '');
  const captured = capturePreRenderDom(findAppElement(), uid);
  const cached = captured || extractorState.cachedPreRenderHtml;
  if (!cached?.text || !chunker.isLikelyChapterText(cached.text)) return null;
  if (uid && cached.chapterUid !== uid) return null;
  if (isStaleTextForChapter(uid, cached.text)) return null;
  return {
    text: cached.text,
    source: !captured && cached.source === 'preRenderDOM' ? 'preRenderDOM:cache' : cached.source,
    chapterUid: uid
  };
}

function getElementTextExcluding(el) {
  if (!el) return '';
  try {
    if (typeof el.cloneNode === 'function') {
      const clone = el.cloneNode(true);
      if (typeof clone.querySelectorAll === 'function') {
        clone.querySelectorAll(
          'script, style, noscript, svg, canvas, audio, video, iframe, button, input, textarea, select, a, nav, header, footer, aside, .readerTopBar, .catalog, .bookReview, .recommend, .bookIntro, .bookInfo, .bookComment, .readerMenu, .readerToolbar'
        ).forEach((node) => node.remove());
        const text = chunker.normalizeText(clone.innerText || clone.textContent || '');
        if (text) return text;
      }
    }
  } catch (error) {
    // 克隆失败时回退到原节点文本
  }
  return chunker.normalizeText(el.innerText || el.textContent || '');
}

function getLegacyDomText() {
  const selectors = ['.readerChapterContent', '.readerContent', '.readerChapter', '.app_content', '.readerContainer'];
  let bestKnown = null;
  let bestKnownScore = -Infinity;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (el.querySelector && el.querySelector('canvas, button, input, textarea, select')) continue;
    const text = chunker.normalizeText(el.innerText);
    const score = chunker.scoreChapterText(text);
    if (score > bestKnownScore) {
      bestKnown = { text, source: 'DOM' };
      bestKnownScore = score;
    }
  }
  if (bestKnown) return bestKnown;

  const hasCanvas = Boolean(document.querySelector('.wr_canvasContainer, .readerChapterContent canvas'));
  if (hasCanvas) {
    // Canvas 阅读器先读文本层；文本层不存在时不冒险使用容器导航文字。
    const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
    const visiblePages = passages.filter(isTextLayerPageVisible);
    const selectedPages = visiblePages.length ? visiblePages : passages;
    const pageTexts = [];
    const seenTexts = new Set();
    for (const passage of selectedPages) {
      const text = reconstructTextLayerPageText(passage);
      if (text && !seenTexts.has(text)) {
        seenTexts.add(text);
        pageTexts.push(text);
      }
    }
    const joined = chunker.normalizeText(pageTexts.join('\n'));
    if (joined && chunker.isLikelyChapterText(joined)) {
      return { text: joined, source: 'DOM:textLayer' };
    }

    const preRenderTexts = [];
    for (const container of queryUniqueContainers(PRE_RENDER_CONTAINER_SELECTORS)) {
      const text = chunker.normalizeText(getPreRenderDomText(container));
      if (text && !preRenderTexts.includes(text)) preRenderTexts.push(text);
    }
    const preRenderJoined = chunker.normalizeText(preRenderTexts.join('\n'));
    if (preRenderJoined && chunker.isLikelyChapterText(preRenderJoined)) {
      return { text: preRenderJoined, source: 'DOM:textLayer' };
    }
    for (const selector of TEXT_LAYER_SELECTORS) {
      const nodes = typeof document.querySelectorAll === 'function'
        ? Array.from(document.querySelectorAll(selector))
        : [];
      const text = chunker.normalizeText(nodes.map((node) => getPreRenderDomText(node)).join(''));
      if (chunker.isLikelyChapterText(text)) return { text, source: 'DOM:textLayer' };
    }
    const preRender = capturePreRenderDom(findAppElement());
    if (preRender && chunker.isLikelyChapterText(preRender.text)) {
      return { text: preRender.text, source: 'DOM:preRender' };
    }
    return null;
  }

  let best = null;
  let bestScore = -Infinity;
  const app = findAppElement();
  const candidates = app ? app.querySelectorAll('div, article, main, section') : document.querySelectorAll('div, article, main, section');

  for (const el of candidates) {
    if (typeof el.closest === 'function') {
      if (el.closest('#' + LEGACY_TTS_PANEL_ID)) continue;
      if (el.closest('#' + VOICE_QUICK_ID)) continue;
      if (el.closest(UI_CONTAINER_SELECTORS.join(','))) continue;
    }
    const text = getElementTextExcluding(el);
    const score = chunker.scoreChapterText(text);
    if (score <= 0) continue;
    if (score > bestScore) {
      best = { text, source: 'DOM' };
      bestScore = score;
    }
  }

  return best;
}

async function extractCurrentChapterText(options = {}) {
  const { instances, readerVms, vm, readerState, uid, source } = refreshReaderContext();
  const expectedChapterUid = String(options.expectedChapterUid || '');
  if (expectedChapterUid && uid && expectedChapterUid !== uid) {
    return { text: '', source: '', chapterUid: uid };
  }

  const bookId = String(
    readProperty(readerState, 'bookId') ||
    readProperty(vm, 'bookId') ||
    ''
  );

  // Canvas 阅读器章节正文最终由 /web/book/chapter/e_* 接口下发。
  // 旧解密链在部分章节会得到“像中文但实为乱码”的候选，因此先用主世界
  // 网络 hook 捕获到的接口正文；没有捕获到时再走旧链路。
  if (uid) {
    const apiResult = await apiChapter.waitForChapter(uid, {
      bookId,
      timeout: Number(options.apiTimeout ?? 1200),
      interval: 80
    });
    if (apiResult && String(apiResult.chapterUid) === String(uid)) {
      return rememberResult({
        text: apiResult.text,
        source: apiResult.source,
        chapterUid: uid
      });
    }
  }

  const entries = collectEntries(readerState, vm, uid, instances);
  const preferred = uid ? entries.filter((item) => item.chapterUid === uid) : [];
  const pool = uid ? preferred : entries;
  const texts = [];
  const seenTexts = new Set();
  const probe = {
    preRenderAttempted: new WeakSet(),
    toggleAttempted: new WeakSet(),
    errors: []
  };

  for (const item of pool.slice(0, 20)) {
    const html = await decryptEntry(readerVms, item, item.chapterUid || uid || '0', item.index || 0, probe, instances);
    const text = htmlToText(html);
    if (
      !chunker.isLikelyChapterText(text) ||
      isStaleTextForChapter(uid, text) ||
      seenTexts.has(text)
    ) {
      continue;
    }
    seenTexts.add(text);
    texts.push(text);
  }

  const text = chunker.normalizeText(texts.join('\n'));
  if (chunker.isLikelyChapterText(text)) {
    return rememberResult({
      text,
      source: uid ? source + ':' + uid : source,
      chapterUid: uid
    });
  }

  const dom = readPreRenderDom(uid);
  if (dom) return rememberResult(dom);

  const cached = findCachedPlaintext(uniqueObjects([...instances, ...readerVms]), uid);
  if (cached) {
    return rememberResult({
      text: cached.text,
      source: cached.source,
      chapterUid: uid
    });
  }

  const decryptorCount = uniqueObjects([...readerVms, ...instances])
    .filter((candidate) => typeof readProperty(candidate, 'decryptRenderHtml') === 'function')
    .length;
  const textLayerCount = typeof document.querySelectorAll === 'function'
    ? document.querySelectorAll('#renderTargetContent [data-wr-role="text"], [data-wr-role="text"]').length
    : 0;
  warnExtractionFailure({
    uid,
    expectedChapterUid,
    source,
    vueInstanceCount: instances.length,
    readerVmCount: readerVms.length,
    decryptorCount,
    entryCount: entries.length,
    preferredEntryCount: preferred.length,
    readerStateKeys: readerState ? safeObjectKeys(readerState).slice(0, 80) : [],
    entryValueTypes: entries.slice(0, 20).map((item) => item.valueType || typeof item.value),
    decryptErrors: probe.errors.slice(0, 10),
    domHits: {
      preRender: queryPreRenderNodes().length,
      textLayer: textLayerCount,
      canvas: Boolean(document.querySelector('.wr_canvasContainer, .readerChapterContent canvas'))
    }
  });
  return { text: '', source: '', chapterUid: uid };
}

// ============================================================================
// 正文文本位置定位（供限定范围朗读时把页面滚动到“从文字”起点）
// 思路：canvas 阅读器渲染前会先生成一份预渲染 DOM（#preRenderContent 等），
// canvas 排版结果与这份 DOM 一致，因此在 DOM 里量出短语的像素位置即可换算滚动目标。
// 拿不到 DOM 或测量失效时返回 null，由调用方降级为按字符占比的比例估算。
// ============================================================================

const PRE_RENDER_SELECTORS = ['#preRenderContent', '#preRenderContents', '.preRenderContent', '.preRenderContainer'];

function queryPreRenderNodes(root) {
  const base = root || document;
  return base.querySelectorAll ? Array.from(base.querySelectorAll(PRE_RENDER_SELECTORS.join(','))) : [];
}

// ============================================================================
// 当前页边界提取（Canvas 阅读器没有文本层时的 DOM 分页依据）
// ============================================================================

function isDoubleColumnReading() {
  return typeof document !== 'undefined' && Boolean(
    document.querySelector('.wr_horizontalReader, .wr_horizontalReader_app_content')
  );
}

function getCanvasPageRects() {
  const nodes = typeof document.querySelectorAll === 'function'
    ? Array.from(document.querySelectorAll('.wr_canvasContainer canvas, .readerChapterContent canvas'))
    : [];
  const rects = [];
  for (const canvas of nodes) {
    try {
      const rect = canvas.getBoundingClientRect();
      const top = rect.top + (window.scrollY || document.scrollingElement?.scrollTop || 0);
      const bottom = top + rect.height;
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top + 1) continue;
      rects.push({
        top,
        bottom,
        width: rect.width,
        height: rect.height
      });
    } catch (error) {
      // 单个 canvas 测量失败时跳过
    }
  }
  rects.sort((a, b) => a.top - b.top);
  if (!rects.length) return [];
  const firstTop = rects[0].top;
  return rects.map((rect) => ({
    ...rect,
    relativeTop: rect.top - firstTop,
    relativeBottom: rect.bottom - firstTop
  }));
}

function getCurrentPageIndex(rects) {
  if (!rects || !rects.length) return 0;
  const doc = document.scrollingElement || document.documentElement;
  const scrollY = window.scrollY || doc?.scrollTop || 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 800;
  const focusY = scrollY + Math.max(80, viewportHeight * 0.4);
  let bestIndex = 0;
  let bestOverlap = -1;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    const overlap = Math.min(focusY, rect.bottom) - Math.max(focusY, rect.top);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestIndex = index;
    }
  }
  if (bestOverlap > 0) return bestIndex;
  if (focusY < rects[0].top) return 0;
  if (focusY >= rects[rects.length - 1].bottom) return rects.length - 1;
  let nearest = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < rects.length; index += 1) {
    const distance = Math.min(Math.abs(focusY - rects[index].top), Math.abs(focusY - rects[index].bottom));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  }
  return nearest;
}

function getPageControlSignature() {
  if (typeof document.querySelectorAll !== 'function') return '';
  const labels = Array.from(document.querySelectorAll('button, a, [class*="button"], [class*="paging"]'))
    .map((el) => (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
    .filter((text) => /上一页|下一页|下一章|上一章|下一页|下一章/.test(text));
  return labels.join(',');
}

function isLastChapterPageByControls() {
  if (typeof document.querySelectorAll !== 'function') return null;
  const labels = Array.from(document.querySelectorAll('button, a, [class*="button"], [class*="paging"]'))
    .map((el) => (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const hasNextPage = labels.some((text) => text.includes('下一页'));
  const hasNextChapter = labels.some((text) => text.includes('下一章'));
  if (hasNextPage) return false;
  if (hasNextChapter) return true;
  return null;
}

function getCurrentPageSignature() {
  const rects = getCanvasPageRects();
  const doc = document.scrollingElement || document.documentElement;
  const scrollY = Math.round(window.scrollY || doc?.scrollTop || 0);
  return [
    rects.map((rect) => `${Math.round(rect.top)}:${Math.round(rect.bottom)}`).join('|'),
    getCurrentPageIndex(rects),
    scrollY,
    getPageControlSignature()
  ].join('#');
}

/**
 * 从页面现存的动态排版样式中提取 Canvas 阅读器正文字体/行高。
 * 微信读书会在 #renderTargetContent 里注入按会话生成的字符样式
 * （如 font:21px/40px wr_default_font; line-height:31px），隐藏测量 DOM
 * 必须复用同一排版参数，否则整章高度和 canvas 页高对不上。
 */
function getDynamicReaderStyleText() {
  try {
    const styleEl = document.querySelector('#renderTargetContent style, .renderTargetContent style');
    const css = styleEl?.textContent || '';
    if (!css) return '';
    const fontMatch = /font\s*:\s*([^;]+);/.exec(css);
    const lineHeightMatch = /line-height\s*:\s*([^;]+);/.exec(css);
    if (!fontMatch && !lineHeightMatch) return '';
    const rules = [];
    if (fontMatch) rules.push('font:' + fontMatch[1].trim() + ';');
    if (lineHeightMatch) rules.push('line-height:' + lineHeightMatch[1].trim() + ';');
    if (!rules.length) return '';
    return '.readerChapterContent .content{' + rules.join('') + '}';
  } catch (error) {
    return '';
  }
}

function createMeasuredChapterRoot(html, width, top) {
  if (!html || typeof DOMParser === 'undefined' || !document?.body) return null;
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch (error) {
    return null;
  }
  if (!doc?.body) return null;
  const root = document.createElement('div');
  root.className = 'readerChapterContent wr-tts-measure-root';
  root.style.cssText = [
    'position:absolute',
    'left:-100000px',
    'top:' + (Number.isFinite(Number(top)) ? Number(top) : 0) + 'px',
    'width:' + (Number(width) > 0 ? Number(width) : 600) + 'px',
    'opacity:0',
    'pointer-events:none',
    'z-index:-1'
  ].join(';') + ';';
  while (doc.body.firstChild) root.appendChild(doc.body.firstChild);
  const dynamicCss = getDynamicReaderStyleText();
  if (dynamicCss) {
    const style = document.createElement('style');
    style.textContent = dynamicCss;
    root.appendChild(style);
  }
  document.body.appendChild(root);
  // 强制同步排版，确保后续 Range 测量可用
  void root.offsetHeight;
  return root;
}

async function withMeasurableChapterDom(callback, options = {}) {
  const preRenderResult = await withPreRenderDomNode(async (root) => {
    const result = await callback(root, { hidden: false });
    return result === undefined ? null : result;
  }, { probe: options.probe === false ? false : true });
  if (preRenderResult !== null) return preRenderResult;

  const uid = getLiveCachedChapterUid();
  const htmlInfo = apiChapter.getChapterHtml(uid, { requireChapterStart: true });
  if (!htmlInfo?.html) return null;

  const rects = getCanvasPageRects();
  const firstCanvas = rects[0];
  const width = firstCanvas?.width || document.querySelector('.wr_canvasContainer')?.clientWidth || 600;
  const root = createMeasuredChapterRoot(htmlInfo.html, width, firstCanvas?.top);
  if (!root) return null;
  try {
    const result = await callback(root, { hidden: true });
    return result === undefined ? null : result;
  } finally {
    root.remove();
  }
}

/**
 * 把归一化文本内的偏移映射回原始文本偏移（与 chunker.normalizeText 口径一致）：
 * - 零宽字符（\u200B/\uFEFF）在归一化中直接移除，不占位，纯跳过；
 * - 空白（含 NBSP）运行折叠为一个空格，占一个归一化位置；
 * - 前导空白被 trim 掉，不占位。
 * 返回 normOffset 对应字符在 raw 中的起始下标；越界时返回 raw 末尾。
 */
function mapNormToRaw(raw, normOffset) {
  let rawIndex = 0;
  let normIndex = 0;
  let inWsRun = true; // 开头视作空白运行（trim 会移除前导空白）
  while (rawIndex < raw.length) {
    const ch = raw[rawIndex];
    if (ch === '\u200B' || ch === '\uFEFF') {
      rawIndex += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (!inWsRun) {
        inWsRun = true;
        if (normIndex === normOffset) return rawIndex; // 目标就是这个折叠空格
        normIndex += 1;
      }
      rawIndex += 1;
      continue;
    }
    inWsRun = false;
    if (normIndex === normOffset) return rawIndex;
    normIndex += 1;
    rawIndex += 1;
  }
  return raw.length;
}

function collectAlignedTextSegments(root) {
  const normalizedText = chunker.normalizeText(root?.innerText || root?.textContent || '');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments = [];
  let searchFrom = 0;
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue || '';
    const norm = chunker.normalizeText(raw);
    if (!norm) continue;
    const normStartInAcc = normalizedText.indexOf(norm, searchFrom);
    if (normStartInAcc < 0) continue;
    segments.push({ node, raw, norm, normStartInAcc });
    searchFrom = normStartInAcc + norm.length;
  }
  return { normalizedText, segments };
}

/**
 * 在 DOM 中按「归一化文本」搜索短语，返回 { node, rawOffset, normOffset }。
 * 允许短语跨文本节点（如 <em>/<span> 边界）；fromNormOffset 用于限定搜索起点，
 * 与 applyRange 的 indexOf 口径一致（起点短语从 0 找首次出现，终点短语从起点之后找）。
 */
function findPhraseInDom(root, normPhrase, fromNormOffset) {
  if (!root || !normPhrase) return null;
  const { normalizedText, segments } = collectAlignedTextSegments(root);
  const matchIndex = normalizedText.indexOf(normPhrase, Math.max(0, fromNormOffset || 0));
  if (matchIndex < 0) return null;

  let segment = segments[segments.length - 1];
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].normStartInAcc + segments[i].norm.length > matchIndex) {
      segment = segments[i];
      break;
    }
  }

  const localNormStart = matchIndex - segment.normStartInAcc;
  return {
    node: segment.node,
    rawOffset: mapNormToRaw(segment.raw, localNormStart),
    normOffset: matchIndex
  };
}

/**
 * 纯偏移定位：在 DOM 的归一化文本中定位 normOffset 处的文本节点与原始偏移。
 */
function findNormOffsetInDom(root, normOffset) {
  if (!root) return null;
  const { segments } = collectAlignedTextSegments(root);
  for (const segment of segments) {
    const segmentEnd = segment.normStartInAcc + segment.norm.length;
    if (segmentEnd > normOffset) {
      const localOffset = Math.max(0, normOffset - segment.normStartInAcc);
      return { node: segment.node, rawOffset: mapNormToRaw(segment.raw, localOffset), normOffset };
    }
  }
  return null;
}

/**
 * 计算某文本偏移在文档流中的 y 坐标（相对视口 + 当前滚动），并做基本合理性校验。
 * 返回 null 表示测量失效（节点隐藏/已移除/坐标越界），调用方应降级。
 */
function getFlowY(node, rawOffset) {
  if (!node || !node.nodeValue) return null;
  const range = document.createRange();
  const textLength = node.nodeValue.length;
  range.setStart(node, Math.min(Math.max(0, rawOffset), textLength));
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;

  const doc = document.scrollingElement || document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const y = rect.top + scrollTop;
  const maxY = Math.max(doc.scrollHeight || 0, document.body.scrollHeight || 0);
  if (y < 0 || y > maxY + 50) return null;
  return y;
}

/**
 * 获取可用于定位的预渲染 DOM 根节点。
 * 优先级：观察器捕获的存活节点 → 页面现存节点 → 触发一次预渲染（复用解密探测模式）。
 * 全部拿不到返回 null。
 */
async function ensurePreRenderDomNode() {
  const liveUid = getLiveCachedChapterUid();
  const cachedUid = extractorState.cachedPreRenderHtml?.chapterUid || '';
  if (
    extractorState.cachedPreRenderNode?.isConnected &&
    (!liveUid || cachedUid === liveUid)
  ) {
    return extractorState.cachedPreRenderNode;
  }
  const existing = queryPreRenderNodes()[0];
  if (existing) return existing;

  const instances = collectVueInstances();
  const store = getStore(instances);
  const readerVms = findReaderVms(instances);
  const vm = readerVms[0] || null;
  const uid = getCurrentChapterUid(getReaderState(store, vm), vm);

  for (const candidate of readerVms) {
    const canProbe = typeof candidate.preRender === 'function' || 'isShowPreRender' in candidate;
    if (!canProbe) continue;

    const prevShouldPreRender = candidate.shouldPreRender;
    const prevShowPreRender = candidate.isShowPreRender;
    try {
      if (typeof candidate.preRender === 'function') {
        candidate.preRender(uid || '0');
      }
      if ('isShowPreRender' in candidate && !candidate.isShowPreRender) {
        candidate.isShowPreRender = true;
      }
      await nextTick(120);
      const found = queryPreRenderNodes()[0];
      if (found) return found;
    } catch (error) {
      // 触发失败继续尝试下一个实例
    } finally {
      if (prevShouldPreRender !== undefined) candidate.shouldPreRender = prevShouldPreRender;
      if (prevShowPreRender !== undefined && candidate.isShowPreRender !== prevShowPreRender) {
        candidate.isShowPreRender = prevShowPreRender;
      }
    }
  }
  return null;
}

/**
 * 在预渲染 DOM 仍处于可测状态时执行回调。若现成节点已隐藏且测量失败，
 * 会临时触发预渲染，并在 finally 中恢复微信读书原状态。
 */
async function withPreRenderDomNode(callback, options = {}) {
  const tryNode = async (node) => {
    if (!node || !node.isConnected) return null;
    try {
      const result = await callback(node);
      return result === undefined ? null : result;
    } catch (error) {
      return null;
    }
  };

  const immediate = [];
  const liveUid = getLiveCachedChapterUid();
  const cachedUid = extractorState.cachedPreRenderHtml?.chapterUid || '';
  if (
    extractorState.cachedPreRenderNode?.isConnected &&
    (!liveUid || cachedUid === liveUid)
  ) {
    immediate.push(extractorState.cachedPreRenderNode);
  }
  for (const node of queryPreRenderNodes()) {
    if (!immediate.includes(node)) immediate.push(node);
  }
  for (const node of immediate) {
    const result = await tryNode(node);
    if (result !== null) return result;
  }
  if (options.probe === false) return null;

  const instances = collectVueInstances();
  const store = getStore(instances);
  const readerVms = findReaderVms(instances);
  const vm = readerVms[0] || null;
  const uid = getCurrentChapterUid(getReaderState(store, vm), vm);

  for (const candidate of readerVms) {
    const canProbe = typeof candidate.preRender === 'function' || 'isShowPreRender' in candidate;
    if (!canProbe) continue;
    const prevShouldPreRender = candidate.shouldPreRender;
    const prevShowPreRender = candidate.isShowPreRender;
    try {
      if (typeof candidate.preRender === 'function') candidate.preRender(uid || '0');
      if ('isShowPreRender' in candidate && !candidate.isShowPreRender) candidate.isShowPreRender = true;
      await nextTick(120);
      for (const node of queryPreRenderNodes()) {
        const result = await tryNode(node);
        if (result !== null) return result;
      }
    } catch (error) {
      // 当前实例不可测时继续尝试下一个实例
    } finally {
      if (prevShouldPreRender !== undefined) candidate.shouldPreRender = prevShouldPreRender;
      if (prevShowPreRender !== undefined && candidate.isShowPreRender !== prevShowPreRender) {
        candidate.isShowPreRender = prevShowPreRender;
      }
    }
  }
  return null;
}

/**
 * 提取“当前可见页”在整章归一化文本中的起止偏移。
 * 优先级：
 * 1. 文本层 DOM（data-wr-role=text）直接重建当前页文本；
 * 2. 预渲染 DOM / 由 API XHTML 重建的隐藏排版 DOM，按当前页 canvas 边界反查偏移；
 * 3. canvas 高度占整章高度的比例估算（兜底，不再把整章当成第一页）。
 */
function rememberFirstPageEnd(chapterUid, pageCount, endIndex) {
  if (!chapterUid || !pageCount || !Number.isFinite(endIndex)) return;
  const key = chapterUid + ':' + pageCount;
  // 直接用最新文本层实测值覆盖旧值。旧版本可能存过被 ratio 撑大的错误页尾，
  // 如果保留“只增不减”会永远无法纠正。
  pageBoundaryCache.set(key, { firstPageEndIndex: endIndex, updatedAt: Date.now() });
  writePageBoundaryCacheToStorage();
}

function getCachedFirstPageEnd(chapterUid, pageCount) {
  if (!chapterUid || !pageCount) return null;
  const key = chapterUid + ':' + pageCount;
  if (pageBoundaryCache.has(key)) {
    const entry = pageBoundaryCache.get(key);
    return entry ? entry.firstPageEndIndex : null;
  }
  const stored = readPageBoundaryCacheFromStorage();
  const entry = stored[key];
  if (entry && Number.isFinite(entry.firstPageEndIndex)) {
    pageBoundaryCache.set(key, entry);
    return entry.firstPageEndIndex;
  }
  return null;
}

async function extractCurrentPageContext(options = {}) {
  const text = chunker.normalizeText(options.text || '');
  if (!chunker.isPlausibleText(text)) return null;
  const chapterUid = String(options.chapterUid || getLiveCachedChapterUid());
  const rects = getCanvasPageRects();
  const pageCount = Math.max(1, rects.length);
  let pageIndex = rects.length ? getCurrentPageIndex(rects) : 0;
  const controlsLast = isLastChapterPageByControls();
  const isLastChapterPage = controlsLast === null
    ? pageIndex >= pageCount - 1
    : controlsLast;
  // 页面控制按钮比 canvas 位置更可靠：有“下一页”就不是末页，有“下一章”就是末页。
  if (controlsLast !== null && pageCount > 1) {
    pageIndex = controlsLast ? pageCount - 1 : 0;
  }
  const currentRect = rects[pageIndex] || null;
  const pageStartY = currentRect?.top ?? null;
  const pageEndY = currentRect?.bottom ?? null;
  const pageSignature = getCurrentPageSignature();

  // 双栏阅读没有纵向滚动，canvas 无法提供真实页边界；
  // 先按 pageCount 等分整章，避免把整章都当成当前页。
  if (isDoubleColumnReading() && pageCount > 1) {
    const split = Math.round(text.length / pageCount);
    const pageStartIndex = isLastChapterPage ? Math.max(0, text.length - split) : 0;
    const pageEndIndex = isLastChapterPage ? text.length : split;
    return {
      pageStartIndex,
      pageEndIndex,
      pageIndex: isLastChapterPage ? pageCount - 1 : 0,
      pageCount,
      isLastChapterPage,
      pageStartY,
      pageEndY,
      pageSignature,
      pageSource: 'double-column-ratio'
    };
  }

  // 0.5) 不再直接使用“第一页页尾缓存”覆盖文本层实测。
  // 旧版本可能写入过被 ratio 撑大的错误缓存（如 20415），会阻碍跨页判断。
  // 文本层可见时以文本层实测为准；不可见时再走比例/缓存兜底。

  // 1) 文本层：能直接拿到当前页可见字符时最准确。
  if (typeof document.querySelectorAll === 'function') {
    const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
    const visible = passages.filter(isTextLayerPageVisible);
    const selected = visible.length ? visible : passages;
    const pageTexts = [];
    for (const passage of selected) {
      const pageText = reconstructTextLayerPageText(passage);
      if (pageText) pageTexts.push(pageText);
    }
    if (pageTexts.length) {
      // 优先把当前页所有 passage 按 DOM 顺序合并后做整体匹配；
      // 单 passage 重建偶有中段坏字，整体匹配失败时用近似前缀/后缀定位。
      const combinedText = pageTexts.join('');
      const range = findApproximateTextRange(text, combinedText)
        || pageTexts.map((item) => findApproximateTextRange(text, item)).find(Boolean);
      if (range) {
        let pageStartIndex = Math.max(0, Math.min(text.length, range.start));
        let pageEndIndex = Math.max(pageStartIndex + 1, Math.min(text.length, range.end));
        // 非末页（第一页）时，文本层可见窗口的起点不是整页起点。
        // 页首修正为 0；页尾只取文本层实测值，不要用缓存/比例去撑大，
        // 否则跨页文字会被误判为当前页内。
        if (!isLastChapterPage && pageIndex === 0 && pageCount > 1) {
          pageStartIndex = 0;
        }
        if (!isLastChapterPage) {
          rememberFirstPageEnd(chapterUid, pageCount, pageEndIndex);
        }
        return {
          pageStartIndex,
          pageEndIndex,
          pageIndex,
          pageCount,
          isLastChapterPage,
          pageStartY,
          pageEndY,
          pageSignature,
          pageSource: 'text-layer'
        };
      }
    }
  }

  // 2) 预渲染/隐藏排版 DOM + canvas 边界。
  // 注意：该路径在分页 Canvas 模型下会把第一页页尾算成 ~2944 而不是真实页尾，
  // 导致中间文字被错误夹到页顶/页底。因此这里不再使用 layout 反查页边界。
  // 文本层不可用时直接走比例兜底；有缓存时走缓存页边界。

  // 2.5) 末页且之前在同一会话里记录过第一页页尾时，直接恢复为“上一页页尾 -> 章末”。
  if (isLastChapterPage && pageCount > 1) {
    const cachedEnd = getCachedFirstPageEnd(chapterUid, pageCount);
    if (cachedEnd && cachedEnd > 0 && cachedEnd < text.length) {
      return {
        pageStartIndex: cachedEnd,
        pageEndIndex: text.length,
        pageIndex: pageCount - 1,
        pageCount,
        isLastChapterPage: true,
        pageStartY,
        pageEndY,
        pageSignature,
        pageSource: 'cached-page-boundary'
      };
    }
  }

  // 3) 无任何测量来源时按 canvas 高度比例切分整章，至少不再从整章开头硬读。
  if (rects.length > 1 && currentRect) {
    const totalHeight = rects[rects.length - 1].relativeBottom;
    if (Number.isFinite(totalHeight) && totalHeight > 0) {
      const startFraction = Math.min(1, Math.max(0, currentRect.relativeTop / totalHeight));
      const endFraction = Math.min(1, Math.max(startFraction, currentRect.relativeBottom / totalHeight));
      const pageStartIndex = Math.min(text.length, Math.round(text.length * startFraction));
      const pageEndIndex = Math.max(pageStartIndex + 1, Math.min(text.length, Math.round(text.length * endFraction)));
      return {
        pageStartIndex,
        pageEndIndex,
        pageIndex,
        pageCount,
        isLastChapterPage,
        pageStartY,
        pageEndY,
        pageSignature,
        pageSource: 'ratio'
      };
    }
  }

  return {
    pageStartIndex: 0,
    pageEndIndex: text.length,
    pageIndex,
    pageCount,
    isLastChapterPage,
    pageStartY,
    pageEndY,
    pageSignature,
    pageSource: 'whole-chapter'
  };
}

export const extractor = {
  clearCache() {
    extractorState.cachedStore = null;
    extractorState.cachedVm = null;
    extractorState.cachedReaderState = null;
    resetPreRenderCache();
    extractorState.currentChapterUid = '';
    extractorState.lastResult = null;
    extractorState.webpackRequire = null;
    extractorState.webpackStore = null;
    extractorState.webpackDecryption = null;
    extractorState.webpackVm = null;
    extractorState.webpackDiagnostic = null;
    extractorState.lastDiagnosticSignature = '';
    apiChapter.clearCache();
  },

  getCurrentChapterUid(options = {}) {
    if (options.refresh) return refreshReaderContext().uid;
    const uid = getLiveCachedChapterUid();
    if (uid) return uid;
    return options.refreshIfMissing ? refreshReaderContext().uid : '';
  },

  getLegacyDomText,

  getDiagnostics() {
    return extractorState.webpackDiagnostic
      ? { ...extractorState.webpackDiagnostic }
      : null;
  },

  /**
   * 轻量获取当前可用的预渲染 DOM 节点（不做任何渲染触发）。
   * 用于朗读中逐块校准：拿不到就跳过本次校准，避免干扰阅读器渲染。
   */
  peekPreRenderDom() {
    const liveUid = getLiveCachedChapterUid();
    const cachedUid = extractorState.cachedPreRenderHtml?.chapterUid || '';
    if (
      extractorState.cachedPreRenderNode?.isConnected &&
      (!liveUid || cachedUid === liveUid)
    ) {
      return extractorState.cachedPreRenderNode;
    }
    return queryPreRenderNodes()[0] || null;
  },

  /** 播放前获取可测量的预渲染 DOM；运行中可传 probe:false，禁止触发渲染。 */
  async getPreRenderDom(options = {}) {
    if (options.probe === false) return this.peekPreRenderDom();
    return ensurePreRenderDomNode();
  },

  async withPreRenderDom(callback, options = {}) {
    if (typeof callback !== 'function') return null;
    return withMeasurableChapterDom(callback, options);
  },

  startPreRenderObserver() {
    if (extractorState.preRenderObserver || typeof MutationObserver === 'undefined') return;
    const target = document.documentElement || document.body;
    if (!target) return;

    extractorState.preRenderObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes) continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          capturePreRenderDom(node);
        }
      }
      capturePreRenderDom(document);
    });
    extractorState.preRenderObserver.observe(target, { subtree: true, childList: true });
    capturePreRenderDom(document);
  },

  async extractCurrentChapterText(options = {}) {
    return extractCurrentChapterText(options);
  },

    extractCurrentPageContext(options = {}) {
      return extractCurrentPageContext(options);
    },

    getCurrentPageSignature() {
      return getCurrentPageSignature();
    },

    getCanvasPageRects() {
      return getCanvasPageRects();
    },


  /**
   * 定位正文中某归一化文本偏移处的页面位置（文档流 y 坐标）。
   * - phrase 非空时优先按短语在预渲染 DOM 中搜索（与 applyRange 匹配口径一致）；
   * - 短语搜索失败再退化为纯偏移定位；
   * - 仍失败返回 null（调用方降级为比例估算）。
   * @param {number} normOffset 整章归一化文本中的字符偏移
   * @param {string} [phrase] 该偏移附近的短语（用于校验与搜索）
   * @param {number} [fromNormOffset] 短语搜索起点（归一化偏移）
   * @returns {Promise<{ y: number } | null>}
   */
  locateTextOffsetInTextLayer(normOffset, phrase) {
    if (phrase) return locatePhraseInTextLayer(chunker.normalizeText(phrase));
    return null;
  },

  findTextLayerBoundary(text) {
    return findTextLayerBoundary(text);
  },

  getFirstTextLayerOffsetAtCurrentScroll(text) {
    const normText = chunker.normalizeText(text || '');
    if (!normText || typeof document.querySelectorAll !== 'function') return null;
    const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
    for (const passage of passages) {
      const pageText = reconstructTextLayerPageText(passage);
      if (!pageText) continue;
      const range = findApproximateTextRange(normText, pageText);
      if (range) {
        const doc = document.scrollingElement || document.documentElement;
        return { scroll: window.scrollY || doc.scrollTop || 0, offset: range.start };
      }
    }
    return null;
  },

  /** 当前滚动位置下，文本层可见文本在整章中的 [start, end) 偏移，以及首字符文档流 y。 */
  getTextLayerRangeAtCurrentScroll(text) {
    const normText = chunker.normalizeText(text || '');
    if (!normText || typeof document.querySelectorAll !== 'function') return null;
    const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
    for (const passage of passages) {
      const pageText = reconstructTextLayerPageText(passage);
      if (!pageText) continue;
      const range = findApproximateTextRange(normText, pageText);
      if (!range) continue;
      const spans = passage.querySelectorAll
        ? Array.from(passage.querySelectorAll('[data-wr-role="text"]'))
        : [];
      const doc = document.scrollingElement || document.documentElement;
      const scrollY = window.scrollY || doc?.scrollTop || 0;
      let y = null;
      for (const span of spans) {
        if (!span.textContent || !span.getBoundingClientRect) continue;
        const rect = span.getBoundingClientRect();
        if (rect && Number.isFinite(rect.top)) {
          y = rect.top + scrollY;
          break;
        }
      }
      return { start: range.start, end: range.end, y };
    }
    return null;
  },

  async locateTextOffset(normOffset, phrase, fromNormOffset, options = {}) {
    // 文本层是当前可见页最准确的坐标来源；优先用它定位“从文字”。
    if (phrase) {
      const layerLoc = locatePhraseInTextLayer(chunker.normalizeText(phrase));
      if (layerLoc) return layerLoc;
    }
    return withPreRenderDomNode((root) => {
      const safeOffset = Math.max(0, Number(normOffset) || 0);
      let found = null;
      if (phrase) {
        found = findPhraseInDom(root, chunker.normalizeText(phrase), fromNormOffset);
      }
      if (!found) found = findNormOffsetInDom(root, safeOffset);
      if (!found) return null;
      const y = getFlowY(found.node, found.rawOffset);
      return y === null ? null : { y };
    }, options);
  }
};
