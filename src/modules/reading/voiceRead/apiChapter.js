import { chunker } from './chunker.js';

/**
 * 微信读书 Canvas 阅读器章节正文由 /web/book/chapter/e_* 接口下发。
 * 响应体是“随机前缀 + base64 明文”，同一章节会返回多个资源，
 * 其中包含封面 XHTML、正文 XHTML、CSS 等。本模块在页面主世界
 * hook fetch / XMLHttpRequest，只截获该接口，按 chapterUid 缓存
 * 解析出的正文，供正文提取器作为最终兜底。
 */

const CHAPTER_API_RE = /\/web\/book\/chapter\/e_[^/]*/;
const PREFIX_SCAN_LIMIT = 160;
const HTML_START_RE = /<(?:\!DOCTYPE|html|head|body)\b|<p(?:\s|>)/i;
const HTML_FRAGMENT_START_RE = /^(?:[A-Za-z_:][A-Za-z0-9_:.-]*\s*=|>|\/>)/;
const CHAPTER_START_RE = /<h1\b[^>]*class\s*=\s*["'][^"']*\bfirstTitle\b[^"']*["'][^>]*>/i;
const COVER_CLASS_RE = /class\s*=\s*["'][^"']*\bfrontCover\b[^"']*["']/i;
const READABLE_FRAGMENT_PREFIX_RE = /[\u3400-\u9FFF][\u3400-\u9FFF0-9A-Za-z，。！？、；：“”‘’（）《》…·\s]*/;

const cache = new Map();
/** 章节排版 CSS 缓存：e_* 响应里包含 stylesheets.css 的 base64 资源 */
const cssCache = new Map();
let sequence = 0;

const CACHE_MAX_SIZE = 40;
const CACHE_MAX_ITEMS_PER_CHAPTER = 32;

function getPageWindow() {
  try {
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
  } catch (error) {
    // 未授予 unsafeWindow 时使用当前 window
  }
  return typeof window !== 'undefined' ? window : null;
}

function base64ToBytes(value) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = {};
  for (let i = 0; i < chars.length; i += 1) map[chars[i]] = i;
  const cleaned = String(value || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  let bits = 0;
  let buffer = 0;
  for (const ch of cleaned) {
    if (ch === '=') break;
    const code = map[ch];
    if (code === undefined) continue;
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function decodeBase64Text(value) {
  try {
    if (typeof Buffer !== 'undefined') {
      const cleaned = String(value || '').replace(/[^A-Za-z0-9+/=]/g, '');
      if (!cleaned) return '';
      const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    const bytes = base64ToBytes(value);
    if (!bytes.length) return '';
    if (typeof TextDecoder === 'function') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return decodeURIComponent(escape(binary));
  } catch (error) {
    // 偏移不对或解码失败时跳过该偏移
    return '';
  }
}

function htmlToText(html) {
  // 统一使用正则剥离，避免浏览器 DOMParser 解析微信读书 XHTML 片段时
  // 因自闭合/损坏标签导致正文为空，造成 e_* 片段被误判为不可用。
  return chunker.normalizeText(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function hasChapterContentMark(decoded) {
  return (
    /<\s*p\b[^>]*class\s*=\s*["'][^"']*\bcontent\b[^"']*["']/i.test(decoded) ||
    /class\s*=\s*["'][^"']*\bcontent\b[^"']*["'][^>]*>/i.test(decoded) ||
    /<\s*p[\s>]/i.test(decoded)
  );
}

function cleanDecodedText(value) {
  return chunker.normalizeText(
    String(value || '')
      .replace(/\uFFFD+/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  );
}

/**
 * 片段资源的首个 <p> 前偶尔会带一小段可读中文（缺失首字符的残句）。
 * 它比完整标签更早开始，保留它能让章节拼接少漏一段内容。
 */
function extractReadableFragmentPrefix(decodedBeforeHtml) {
  const match = READABLE_FRAGMENT_PREFIX_RE.exec(String(decodedBeforeHtml || ''));
  return match ? cleanDecodedText(match[0]) : '';
}

function isCoverLike(decoded) {
  return COVER_CLASS_RE.test(decoded);
}

function isCssLike(decoded) {
  const head = decoded.slice(0, 400);
  return (
    /^\s*\/\*/.test(decoded) ||
    /(?:^|[\s}])[\w.#:@*][^{};]*\{[^}]*\}/.test(head)
  );
}

function htmlStructureRank(html) {
  if (/^<\s*!DOCTYPE/i.test(html)) return 3;
  if (/^<\s*html\b/i.test(html)) return 2;
  if (/^<\s*(?:head|body)\b/i.test(html)) return 1;
  return 0;
}

/**
 * 清洗抓包 XHTML 中的“假标签”起始符。
 * 真实章节 XHTML 偶尔会出现 `字<�后臀...` 这类损坏字符：`<` 后跟的不是
 * 标签名而是替换符/中文，DOMParser 和正则剥标签都会误把它当成标签开头，
 * 导致其后正文被吞掉。这里只移除不是合法标签起始的 `<`，保留正文文字。
 */
function sanitizeMalformedHtml(html) {
  return String(html || '').replace(/<(?![A-Za-z/!?])/g, '');
}

function scoreDecoded(decoded) {
  if (!decoded || !hasChapterContentMark(decoded)) return null;
  const htmlMatch = HTML_START_RE.exec(decoded);
  const rawHtml = htmlMatch ? decoded.slice(htmlMatch.index) : null;
  const html = rawHtml ? sanitizeMalformedHtml(rawHtml) : null;
  if (!html) return null;
  if (isCoverLike(decoded) || isCssLike(decoded)) return null;
  const prefixText = extractReadableFragmentPrefix(decoded.slice(0, htmlMatch.index));
  const htmlText = htmlToText(html);
  let text = cleanDecodedText(prefixText ? prefixText + ' ' + htmlText : htmlText);
  // 去掉片段末尾因截断产生的半截标签残文，如 `6p class="conte`。
  text = text.replace(/\s*[A-Za-z0-9][A-Za-z0-9]*\s+class="[^"]*$/g, '').trim();
  if (HTML_FRAGMENT_START_RE.test(text)) return null;
  if (!chunker.isLikelyChapterText(text)) return null;
  const chapterStart = CHAPTER_START_RE.test(html);
  return {
    html,
    text,
    chapterStart,
    structure: htmlStructureRank(html) + (chapterStart ? 10 : 0),
    score: chunker.scoreChapterText(text)
  };
}

function findBestCandidate(raw) {
  let best = null;
  let containsCover = false;
  const limit = Math.min(PREFIX_SCAN_LIMIT, Math.max(0, raw.length - 1));
  for (let offset = 0; offset <= limit; offset += 1) {
    const decoded = decodeBase64Text(raw.slice(offset));
    if (!decoded) continue;
    if (isCoverLike(decoded)) {
      containsCover = true;
    }
    const candidate = scoreDecoded(decoded);
    if (!candidate) continue;
    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.structure > best.structure)
    ) {
      best = candidate;
    }
  }
  if (containsCover) return null;
  return best;
}

/**
 * 在 e_* 响应中查找排版 CSS。CSS 资源同样带随机前缀，需要扫描 base64 偏移。
 * 找到后从第一个注释（或可识别规则）开始截取，去掉前缀噪声。
 */
function findCssCandidate(raw) {
  const limit = Math.min(PREFIX_SCAN_LIMIT, Math.max(0, raw.length - 1));
  let best = '';
  for (let offset = 0; offset <= limit; offset += 1) {
    const decoded = decodeBase64Text(raw.slice(offset));
    if (!decoded || decoded.length < 50 || !isCssLike(decoded)) continue;
    const commentStart = decoded.indexOf('/*');
    const css = commentStart >= 0 ? decoded.slice(commentStart) : decoded;
    if (css.length > best.length) best = css;
  }
  return best || null;
}

function collectStrings(value, out, depth, seen) {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1, seen);
    return;
  }
  let keys = [];
  try {
    keys = Object.keys(value);
  } catch (error) {
    return;
  }
  for (const key of keys) {
    try {
      collectStrings(value[key], out, depth + 1, seen);
    } catch (error) {
      // 个别 getter 可能抛错，跳过
    }
  }
}

function collectResponseStrings(responseBody) {
  const result = [];
  if (typeof responseBody === 'string') {
    let parsed = null;
    try {
      parsed = JSON.parse(responseBody);
    } catch (error) {
      parsed = null;
    }
    if (parsed !== null) {
      collectStrings(parsed, result, 0, new WeakSet());
      if (result.length) return result;
    }
    result.push(responseBody);
    return result;
  }
  collectStrings(responseBody, result, 0, new WeakSet());
  return result;
}

function extractChapterUid(requestBody) {
  if (!requestBody) return '';
  const body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  try {
    const parsed = JSON.parse(body);
    const uid = parsed && (parsed.c || parsed.chapterUid || parsed.chapterId);
    return String(uid || '').trim();
  } catch (error) {
    return '';
  }
}

function extractBookId(requestBody) {
  if (!requestBody) return '';
  const body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  try {
    const parsed = JSON.parse(body);
    const bookId = parsed && (parsed.b || parsed.bookId);
    return String(bookId || '').trim();
  } catch (error) {
    return '';
  }
}

function getResourceOrder(url) {
  const match = String(url || '').match(/\/e_(\d+)/i);
  const order = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function storeResponse(url, requestBody, responseBody) {
  const chapterUid = extractChapterUid(requestBody);
  if (!chapterUid) return null;
  const bookId = extractBookId(requestBody);

  const strings = collectResponseStrings(responseBody);
  const candidates = [];
  for (const raw of strings) {
    const best = findBestCandidate(raw);
    if (best) candidates.push(best);
    const css = findCssCandidate(raw);
    if (css) {
      const existing = cssCache.get(chapterUid) || '';
      if (css.length > existing.length) cssCache.set(chapterUid, css);
    }
  }
  if (!candidates.length) return null;

  sequence += 1;
  const list = cache.get(chapterUid) || [];
  for (const candidate of candidates) {
    const item = {
      ...candidate,
      url: String(url || ''),
      bookId,
      sequence,
      resourceOrder: getResourceOrder(url),
      fetchedAt: Date.now()
    };
    const duplicate = list.some(
      (existing) =>
        existing.url === item.url &&
        existing.bookId === item.bookId &&
        existing.text === item.text
    );
    if (!duplicate) list.push(item);
  }
  cache.set(chapterUid, list);
  if (list.length > CACHE_MAX_ITEMS_PER_CHAPTER) {
    list.splice(0, list.length - CACHE_MAX_ITEMS_PER_CHAPTER);
    cache.set(chapterUid, list);
  }
  if (cache.size > CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  return list;
}

function mergeChapterTexts(items) {
  const parts = [];
  let combined = '';
  for (const item of items) {
    const text = chunker.normalizeText(item.text);
    if (!text) continue;
    if (combined && combined.includes(text)) continue;

    const last = parts.length ? parts[parts.length - 1] : '';
    const maxOverlap = Math.min(80, text.length, last.length);
    let overlap = 0;
    for (let length = maxOverlap; length > 0; length -= 1) {
      if (last.endsWith(text.slice(0, length))) {
        overlap = length;
        break;
      }
    }
    if (overlap > 0) {
      parts.push(text.slice(overlap));
    } else {
      parts.push(text);
    }
    combined = chunker.normalizeText(parts.join(' '));
  }
  return combined;
}

function getChapterText(chapterUid, options = {}) {
  const uid = String(chapterUid || '');
  const bookId = String(options.bookId || '');
  const requireChapterStart = Boolean(options.requireChapterStart);
  const list = (cache.get(uid) || []).filter((item) => !bookId || item.bookId === bookId);
  if (!list.length) return null;

  const accepted = list
    .filter(
      (item) =>
        item.html &&
        item.text &&
        chunker.isLikelyChapterText(item.text)
    )
    .sort((a, b) => {
      const startDiff = Number(Boolean(b.chapterStart)) - Number(Boolean(a.chapterStart));
      if (startDiff !== 0) return startDiff;
      if (a.resourceOrder !== b.resourceOrder) return a.resourceOrder - b.resourceOrder;
      return a.fetchedAt - b.fetchedAt || a.sequence - b.sequence;
    });
  if (requireChapterStart && !accepted.some((item) => item.chapterStart)) return null;
  if (!accepted.length) return null;

  const text = mergeChapterTexts(accepted);
  if (!chunker.isLikelyChapterText(text)) return null;
  return {
    text,
    source: 'API:chapter',
    chapterUid: uid
  };
}

/**
 * 从接口 XHTML 中取出 <body> 内部内容；没有 <body> 的续文片段原样返回。
 * 不能依赖 DOMParser 解析微信读书的 XHTML：自闭合 <title/> 会被 text/html
 * 解析器误吞后续内容，导致 body 为空。
 * 抓包片段是“流式”的：章首片段只有 <body> 开头没有 </body>，末段只有
 * </body> 没有 <body>，中段完全没有 body 标签，因此按开/闭标签单独处理。
 */
/**
 * 片段末尾偶尔带有损坏的控制字符/半截标签（如 \u000e6�p class="conte"），
 * 这些内容会污染 htmlToText，导致 prefix 识别失败。如果控制字符之后没有合法标签，
 * 直接丢弃这一段尾部。
 */
function cleanFragmentTail(body) {
  // 排除 \t \n \r 等正常空白控制符，只处理损坏控制符（如 \u000e）。
  const idx = String(body).search(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
  if (idx >= 0) {
    const tail = String(body).slice(idx);
    if (!tail.includes('<')) return String(body).slice(0, idx);
  }
  return body;
}

function extractHtmlBody(html) {
  if (!html) return '';
  const lower = html.toLowerCase();
  const openMatch = /<body[^>]*>/i.exec(html);
  const closeIndex = lower.indexOf('</body>');
  if (openMatch) {
    const start = openMatch.index + openMatch[0].length;
    const end = closeIndex >= start ? closeIndex : html.length;
    return cleanFragmentTail(html.slice(start, end));
  }
  if (closeIndex >= 0) return cleanFragmentTail(html.slice(0, closeIndex));
  return cleanFragmentTail(html);
}

/**
 * 计算接口片段中位于 HTML 之前的可读前缀。
 * 微信读书的 e_* 响应中，HTML 之前可能带上一小段残句（上一片段末尾的续文），
 * 这段文字不会出现在 item.html 里，但会出现在 item.text 里。
 */
function extractFragmentPrefix(item) {
  if (!item?.html || !item?.text) return '';
  const bodyText = chunker.normalizeText(htmlToText(extractHtmlBody(item.html)).replace(/\uFFFD+/g, ''));
  if (!bodyText || bodyText.length >= item.text.length) return '';
  if (!item.text.endsWith(bodyText)) return '';
  return chunker.normalizeText(item.text.slice(0, item.text.length - bodyText.length));
}

/**
 * 片段可能在段落中间被截断（如章首片段以未闭合的 <p> 结尾）。
 * 补上缺失的 </p>，避免后续片段被浏览器嵌套进上一个段落。
 */
function closeOpenParagraphs(body) {
  const opens = (body.match(/<p\b[^>]*>/gi) || []).length;
  const closes = (body.match(/<\/p>/gi) || []).length;
  if (opens <= closes) return body;
  return body + '</p>'.repeat(opens - closes);
}

/**
 * 提取章首 XHTML <head> 里的样式表 <link>。
 * 微信读书 Canvas 排版依赖自己的 stylesheets.css；隐藏测量 DOM 必须带上它，
 * 否则默认 UA 样式会让整章高度远高于实际 canvas，导致 y 坐标无法对齐。
 * 只取 <link>，避免 <title/> 这类 XHTML 自闭合标签破坏 HTML 解析。
 */
function extractHeadLinks(html) {
  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html || '');
  if (!headMatch) return '';
  const links = (headMatch[1] || '').match(/<link\b[^>]*>/gi) || [];
  return links.join('');
}

/**
 * 按章节正文片段顺序拼接完整 XHTML。
 * 片段文本在整章中的位置由 getChapterText 的 mergeChapterTexts 验证过，
 * 这里同样按章节起始优先 + resourceOrder 排序后拼接 body 内容。
 * 每个片段的 HTML 前缀（残句）会补成独立段落；原始 HTML 中的替换符会清掉，
 * 以便隐藏排版 DOM 的 innerText 与整章归一化文本一致。
 */
function mergeChapterHtmls(accepted, css) {
  const bodies = accepted.map((item) => {
    const prefix = extractFragmentPrefix(item);
    const body = closeOpenParagraphs(extractHtmlBody(item.html || '').replace(/\uFFFD+/g, ''));
    return (prefix ? '<p class="content">' + prefix + '</p>' : '') + body;
  }).join('');
  const head = extractHeadLinks(accepted[0]?.html || '');
  // 样式放在 <body> 开头而不是 <head>：createMeasuredChapterRoot 只会把 body
  // 子节点搬进测量根节点，放在 head 里的 <style> 会丢失。
  const style = css ? '<style>' + css + '</style>' : '';
  return '<!DOCTYPE html><html><head>' + head + '</head><body>' + style + bodies + '</body></html>';
}

/**
 * 返回可用于重建隐藏排版 DOM 的整章 XHTML。
 * 接口本身不提供分页信息，但完整 HTML 配合当前页 canvas 边界，
 * 可以在运行时测量“当前页对应的正文偏移”，弥补 Canvas 模式下文本层缺失。
 */
function getChapterHtml(chapterUid, options = {}) {
  const uid = String(chapterUid || '');
  const bookId = String(options.bookId || '');
  const requireChapterStart = Boolean(options.requireChapterStart);
  const list = (cache.get(uid) || []).filter((item) => !bookId || item.bookId === bookId);
  if (!list.length) return null;

  const accepted = list
    .filter(
      (item) =>
        item.html &&
        item.text &&
        chunker.isLikelyChapterText(item.text)
    )
    .sort((a, b) => {
      const startDiff = Number(Boolean(b.chapterStart)) - Number(Boolean(a.chapterStart));
      if (startDiff !== 0) return startDiff;
      if (a.resourceOrder !== b.resourceOrder) return a.resourceOrder - b.resourceOrder;
      return a.fetchedAt - b.fetchedAt || a.sequence - b.sequence;
    });
  if (requireChapterStart && !accepted.some((item) => item.chapterStart)) return null;
  if (!accepted.length) return null;

  return {
    html: mergeChapterHtmls(accepted, cssCache.get(uid) || ''),
    source: 'API:chapter',
    chapterUid: uid
  };
}

async function waitForChapter(chapterUid, options = {}) {
  const uid = String(chapterUid || '');
  if (!uid) return null;
  const chapterStartOptions = { ...options, requireChapterStart: true };
  const immediate = getChapterText(uid, chapterStartOptions);
  if (immediate) return immediate;

  const timeout = Math.max(0, Number(options.timeout ?? 1200));
  const interval = Math.max(20, Number(options.interval ?? 80));
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const result = getChapterText(uid, chapterStartOptions);
    if (result) return result;
  }
  return null;
}

function installHooks(pageWindow) {
  if (!pageWindow || pageWindow.__wrApiHooked) return;
  let hooked = false;

  if (typeof pageWindow.fetch === 'function') {
    hooked = true;
    const originalFetch = pageWindow.fetch;
    pageWindow.fetch = function wrApiFetch(...args) {
      const [input, init = {}] = args;
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (
        CHAPTER_API_RE.test(url) &&
        typeof init.body === 'string' &&
        extractChapterUid(init.body)
      ) {
        const requestBody = init.body;
        const promise = originalFetch.call(pageWindow, ...args);
        if (promise && typeof promise.then === 'function') {
          promise
            .then((response) => {
              if (!response || typeof response.clone !== 'function') return;
              try {
                const clone = response.clone();
                clone.text().then((text) => {
                  storeResponse(url, requestBody, text);
                }).catch(() => {});
              } catch (error) {
                // 克隆失败不影响原响应
              }
            })
            .catch(() => {});
        }
        return promise;
      }
      return originalFetch.call(pageWindow, ...args);
    };
  }

  const xhr = pageWindow.XMLHttpRequest;
  if (xhr && xhr.prototype && typeof xhr.prototype.open === 'function') {
    const originalOpen = xhr.prototype.open;
    const originalSend = xhr.prototype.send;
    xhr.prototype.open = function wrApiXhrOpen(method, url, ...rest) {
      this.__wrApiUrl = String(url || '');
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    xhr.prototype.send = function wrApiXhrSend(body) {
      const url = this.__wrApiUrl || '';
      if (CHAPTER_API_RE.test(url) && extractChapterUid(body)) {
        const requestBody = body;
        this.addEventListener('loadend', function wrApiXhrLoadEnd() {
          try {
            if (this.responseText) {
              storeResponse(url, requestBody, this.responseText);
            }
          } catch (error) {
            // 读取响应失败时放弃本次缓存
          }
        });
      }
      return originalSend.apply(this, arguments);
    };
  }

  // 只在确实包装了至少一个传输层后标记，避免页面 fetch 尚未赋值时
  // 提前打上“已 hook”标记，导致后续初始化无法补挂。
  if (hooked) pageWindow.__wrApiHooked = true;
}

let hookRetryTimer = null;

function ensureHooked() {
  const pageWindow = getPageWindow();
  if (!pageWindow) return;
  installHooks(pageWindow);
  if (pageWindow.__wrApiHooked) {
    if (hookRetryTimer !== null) {
      clearTimeout(hookRetryTimer);
      hookRetryTimer = null;
    }
    return;
  }
  // Node 单元测试没有浏览器页面，不安排重试，避免测试进程被定时器拖住。
  if (typeof document === 'undefined') return;
  if (!pageWindow.document) return;
  if (hookRetryTimer !== null) return;
  hookRetryTimer = setTimeout(() => {
    hookRetryTimer = null;
    ensureHooked();
  }, 300);
}

function clearCache() {
  cache.clear();
  cssCache.clear();
}

// 模块加载时尽早安装；页面后续翻章发出的请求都会经过 hook。
ensureHooked();

export const apiChapter = {
  clearCache,
  ensureHooked,
  getChapterHtml,
  getChapterText,
  installHooks,
  storeResponse,
  waitForChapter
};
