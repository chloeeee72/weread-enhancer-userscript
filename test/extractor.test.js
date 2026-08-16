import test from 'node:test';
import assert from 'node:assert/strict';

let importId = 0;

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function installDom() {
  globalThis.DOMParser = class DOMParser {
    parseFromString(html) {
      return {
        querySelectorAll: () => [],
        body: { textContent: stripHtml(html) }
      };
    }
  };
}

function createFixture(textByUid, options = {}) {
  installDom();
  delete globalThis.unsafeWindow;

  const reader = {
    currentChapter: { chapterUid: options.initialUid || 'chapter-1' },
    chapterContentHtml: {}
  };
  const store = { state: { reader } };
  let preRenderNodes = [];
  const decryptCalls = [];

  function makePreRenderNode(options = {}) {
    const clone = {
      innerText: options.innerText || '',
      textContent: options.textContent || '',
      querySelectorAll(selector) {
        if (!selector.includes('style') || !/<style[\s>]/i.test(options.innerHTML || '')) return [];
        return [{
          remove() {
            clone.textContent = options.textAfterStyle || '';
          }
        }];
      }
    };
    return {
      id: options.id || 'preRenderContent',
      innerText: options.innerText || '',
      textContent: options.textContent || '',
      innerHTML: options.innerHTML || '',
      isConnected: true,
      cloneNode() {
        return clone;
      }
    };
  }

  const renderer = {
    $: { subTree: null },
    $store: store,
    bookId: 'book-1',
    tempContent: options.tempContent || '',
    preRenderHtml: options.preRenderHtml || '',
    decryptRenderHtml(value, uid, index) {
      decryptCalls.push({ value, uid, index });
      if (options.returnEncryptedValue) return value;
      const render = () => {
        this.tempContent = typeof options.decryptText === 'function'
          ? options.decryptText({ value, uid, index })
          : textByUid[uid] || '';
      };
      if (options.asyncDecrypt) {
        return new Promise((resolve) => {
          setTimeout(() => {
            render();
            resolve();
          }, 5);
        });
      }
      render();
      return undefined;
    }
  };
  Object.defineProperty(renderer, 'currentChapterUid', {
    get: () => String(reader.currentChapter.chapterUid || '')
  });

  const rootVm = {
    $: { subTree: null },
    $store: store,
    $children: [renderer]
  };
  const app = {
    __vue__: rootVm,
    querySelectorAll(selector) {
      if (selector === '*') return [];
      if (selector.includes('preRender')) return preRenderNodes;
      return [];
    }
  };

  globalThis.document = {
    body: app,
    querySelector: (selector) => selector === '#app' ? app : null,
    querySelectorAll: () => []
  };
  globalThis.window = {
    setTimeout,
    clearTimeout
  };

  function setEntries(uid, count = 1) {
    reader.chapterContentHtml[uid] = Array.from({ length: count }, (_, index) => ({
      chapterUid: uid,
      value: `encrypted-${uid}-${index}`,
      valueHasStr() { return false; }
    }));
  }

  return {
    decryptCalls,
    reader,
    renderer,
    store,
    setEntries,
    setPreRenderText(text) {
      preRenderNodes = text
        ? [makePreRenderNode({ innerHTML: text, innerText: text, textContent: text })]
        : [];
    },
    setPreRenderStyleOnly(css) {
      preRenderNodes = [makePreRenderNode({
        id: 'preRenderContainer',
        innerHTML: '<style>' + css + '</style>',
        textContent: css
      })];
    },
    setPreRenderWithStyle(css, body) {
      preRenderNodes = [makePreRenderNode({
        id: 'preRenderContainer',
        innerHTML: '<style>' + css + '</style>' + body,
        textContent: css + body,
        textAfterStyle: body
      })];
    },
    switchChapter(uid) {
      reader.currentChapter = { chapterUid: uid };
    }
  };
}

function createWebpackFixture(textByUid, options = {}) {
  installDom();

  const reader = {
    bookId: options.bookId || 'book-1',
    currentChapter: { chapterUid: options.initialUid || 'chapter-1' },
    chapterContentHtml: []
  };
  const store = {
    state: { reader },
    dispatch() {},
    commit() {}
  };
  const decryptCalls = [];
  const modules = {};
  const decryption = (value, bookId, uid, index) => {
    decryptCalls.push({ value, bookId, uid, index });
    return textByUid[uid]?.[index] || '';
  };
  const cache = options.nestedExports
    ? {
        store: { exports: { bridge: { default: store } } },
        decrypt: { exports: { helpers: { crypto: { decryption } } } }
      }
    : {
        store: { exports: { default: store } },
        decrypt: { exports: { decryption } }
      };
  const webpackRequire = (id) => {
    if (cache[id]) return cache[id].exports;
    const module = { exports: {} };
    cache[id] = module;
    modules[id](module, module.exports, webpackRequire);
    return module.exports;
  };
  webpackRequire.c = cache;

  const webpackJsonp = [];
  webpackJsonp.push = (payload) => {
    Object.assign(modules, payload[1] || {});
    (payload[2] || []).forEach((entry) => webpackRequire(Array.isArray(entry) ? entry[0] : entry));
    return Array.prototype.push.call(webpackJsonp, payload);
  };
  const pageWindow = { webpackJsonp, Function, setTimeout, clearTimeout };
  globalThis.unsafeWindow = pageWindow;

  const app = {
    querySelectorAll(selector) {
      if (selector === '*') return [];
      return [];
    }
  };
  globalThis.document = {
    body: app,
    querySelector: (selector) => selector === '#app' ? app : null,
    querySelectorAll: () => []
  };
  globalThis.window = pageWindow;

  return {
    decryptCalls,
    reader,
    setEntries(count = 1) {
      reader.chapterContentHtml = Array.from({ length: count }, (_, index) => ({
        value: `encrypted-${reader.currentChapter.chapterUid}-${index}`,
        valueHasStr() { return false; }
      }));
    }
  };
}

async function importExtractor() {
  importId += 1;
  return (await import(`../src/modules/reading/voiceRead/extractor.js?test=${importId}`)).extractor;
}

async function importSharedApiChapter() {
  return (await import('../src/modules/reading/voiceRead/apiChapter.js')).apiChapter;
}

test('章节切换后忽略旧 tempContent，重新解密当前章节', async () => {
  const first = '第一章正文内容。这里是第一章的完整原文。';
  const second = '第二章正文内容。这里是第二章的完整原文。';
  const fixture = createFixture({ 'chapter-1': first, 'chapter-2': second });
  fixture.setEntries('chapter-1');
  fixture.setEntries('chapter-2');
  const extractor = await importExtractor();

  const firstResult = await extractor.extractCurrentChapterText();
  assert.equal(firstResult.text, first);

  fixture.switchChapter('chapter-2');
  fixture.renderer.preRenderHtml = first;
  const secondResult = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-2' });

  assert.equal(secondResult.chapterUid, 'chapter-2');
  assert.equal(secondResult.text, second);
  assert.equal(secondResult.text.includes(first), false);
});

test('等待异步解密完成，不读取调用前遗留文本', async () => {
  const stale = '上一章遗留正文，不应作为当前章节朗读内容。';
  const current = '当前章节异步解密后的正确正文内容。';
  const fixture = createFixture(
    { 'chapter-2': current },
    { initialUid: 'chapter-2', tempContent: stale, asyncDecrypt: true }
  );
  fixture.setEntries('chapter-2');
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-2' });

  assert.equal(result.text, current);
});

test('相同解密分段只拼接一次', async () => {
  const current = '当前章节唯一正文，不应因重复条目连续朗读多次。';
  const fixture = createFixture({ 'chapter-2': current }, { initialUid: 'chapter-2' });
  fixture.setEntries('chapter-2', 2);
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText();

  assert.equal(result.text, current);
});

test('每个加密分段使用自身索引，不复用当前页索引', async () => {
  const sections = [
    '当前章节第一分段的正确正文内容。',
    '当前章节第二分段的正确正文内容。'
  ];
  const fixture = createFixture({}, {
    initialUid: 'chapter-2',
    decryptText: ({ value, index }) => {
      const entryIndex = Number(value.split('-').at(-1));
      return entryIndex === index ? sections[index] : '错误索引解密出的无效乱码内容。';
    }
  });
  fixture.renderer.getCurrentSectionIdx = () => 1;
  fixture.setEntries('chapter-2', 2);
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText();

  assert.equal(result.text, sections.join(' '));
  assert.deepEqual(fixture.decryptCalls.map((call) => call.index), [0, 1]);
});

test('解密函数返回原始密文时拒绝作为朗读正文', async () => {
  const fixture = createFixture({}, {
    initialUid: 'chapter-2',
    returnEncryptedValue: true
  });
  fixture.setEntries('chapter-2');
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText();

  assert.equal(result.text, '');
});

test('条目解密失败时仍可使用 vm 缓存明文兜底', async () => {
  const cached = '这是一段已经渲染好的章节缓存正文，用于解密失败时兜底。';
  const fixture = createFixture({}, {
    initialUid: 'chapter-7',
    returnEncryptedValue: true
  });
  fixture.renderer.tempContent = cached;
  fixture.setEntries('chapter-7');
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-7' });

  assert.equal(result.text, cached);
  assert.equal(result.source, 'Vue:tempContent');
});

test('章节变化后不复用已移除的预渲染 DOM 缓存', async () => {
  const stale = '第一章预渲染缓存正文，不属于新的章节。';
  const fixture = createFixture({}, { initialUid: 'chapter-1', tempContent: stale });
  fixture.setPreRenderText(stale);
  const extractor = await importExtractor();

  const firstResult = await extractor.extractCurrentChapterText();
  assert.equal(firstResult.text, stale);

  fixture.switchChapter('chapter-2');
  fixture.setPreRenderText('');
  const secondResult = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-2' });

  assert.equal(secondResult.chapterUid, 'chapter-2');
  assert.equal(secondResult.text, '');
});

test('生产页面无 Vue DOM 引用时在主世界扫描两层 Webpack 导出并解密正文', async () => {
  const sections = [
    '生产页面第一分段的原始正文内容。',
    '生产页面第二分段的原始正文内容。'
  ];
  const fixture = createWebpackFixture(
    { 'chapter-16': sections },
    { initialUid: 'chapter-16', nestedExports: true }
  );
  fixture.setEntries(2);
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-16' });

  assert.equal(result.text, sections.join(' '));
  assert.equal(result.source, 'WeReadStore:chapter-16');
  assert.deepEqual(fixture.decryptCalls, [
    { value: 'encrypted-chapter-16-0', bookId: 'book-1', uid: 'chapter-16', index: 0 },
    { value: 'encrypted-chapter-16-1', bookId: 'book-1', uid: 'chapter-16', index: 1 }
  ]);
});

test('新版条目对象结构可从嵌套 data.ciphertext 解密', async () => {
  const current = '新版条目对象解出的正文内容。';
  const fixture = createFixture({ 'chapter-3': current }, { initialUid: 'chapter-3' });
  fixture.reader.chapterContentHtml = {
    'chapter-3': [{ data: { ciphertext: 'encrypted-chapter-3-0' } }]
  };
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-3' });

  assert.equal(result.text, current);
});

test('嵌套渲染字段中的加密条目可被扫描并解密', async () => {
  const current = '嵌套渲染字段解出的正文内容。';
  const fixture = createFixture({ 'chapter-4': current }, { initialUid: 'chapter-4' });
  fixture.reader.renderData = {
    chapterContents: [{ value: 'encrypted-chapter-4-0' }]
  };
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-4' });

  assert.equal(result.text, current);
});

test('章节 uid 兼容 chapterId 字段', async () => {
  const fixture = createFixture({}, { initialUid: 'chapter-5' });
  fixture.reader.currentChapter = { chapterId: 'chapter-5' };
  const extractor = await importExtractor();

  assert.equal(extractor.getCurrentChapterUid({ refresh: true }), 'chapter-5');
});

test('章节 uid 可从 reader URL 末尾回退获取', async () => {
  const fixture = createFixture({});
  fixture.reader.currentChapter = {};
  const previousLocation = globalThis.location;
  globalThis.location = {
    href: 'https://weread.qq.com/web/reader/49432980720c671f4941767ka6832360236a684eceeee20'
  };
  const extractor = await importExtractor();

  try {
    assert.equal(extractor.getCurrentChapterUid({ refresh: true }), 'a6832360236a684eceeee20');
  } finally {
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test('无 uid 时单个预渲染 DOM 可作为正文兜底', async () => {
  const fixture = createFixture({});
  fixture.reader.currentChapter = {};
  fixture.setPreRenderText('这是一段仅有的预渲染正文内容，足够满足正文长度判断。');
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: '' });

  assert.equal(result.text, '这是一段仅有的预渲染正文内容，足够满足正文长度判断。');
  assert.equal(result.source, 'preRenderDOM');
});

test('预渲染 DOM 里只有 style 文本时不得作为正文', async () => {
  const css = '.readerChapterContent .frontCover{qrfullpage:1;text-align:center}.readerChapterContent .copyRightTitle{font-family:"汉仪旗黑65S","PingFang SC",sans-serif;line-height:1.2em;text-align:center;text-indent:0}.readerChapterContent .contentCR{font-family:"汉仪旗黑50S","PingFang SC",sans-serif;text-indent:0;text-align:center}';
  const fixture = createFixture({}, { initialUid: 'chapter-12', returnEncryptedValue: true });
  fixture.setPreRenderStyleOnly(css);
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-12' });

  assert.equal(result.text, '');
});

test('预渲染 DOM 中 style 与正文共存时只取正文', async () => {
  const css = '.readerChapterContent .frontCover{qrfullpage:1;text-align:center}';
  const body = '第十五章正文从这里开始。吴定缘和苏荆溪从船头跌落的同时，便好巧不巧地被坍塌的木料埋住，四周只剩一片漆黑。';
  const fixture = createFixture({}, { initialUid: 'chapter-12', returnEncryptedValue: true });
  fixture.setPreRenderWithStyle(css, body);
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-12' });

  assert.equal(result.text.includes(body), true);
  assert.equal(result.source, 'preRenderDOM');
});

test('store.state.book.reader 可被识别为阅读器状态', async () => {
  const current = '嵌套 book.reader 状态解出的正文内容。';
  const fixture = createFixture({ 'chapter-6': current }, { initialUid: 'chapter-6' });
  fixture.reader.chapterContentHtml = {
    'chapter-6': [{ value: 'encrypted-chapter-6-0' }]
  };
  delete fixture.store.state.reader;
  fixture.store.state.book = { reader: fixture.reader };
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-6' });

  assert.equal(result.text, current);
});

test('章节元数据字段不作为加密正文条目扫描', async () => {
  const fixture = createFixture({}, { initialUid: 'chapter-9' });
  fixture.reader.chapterInfo = {
    title: '第九章 长风',
    value: '这是一段长度足够像正文的章节简介文本，用于验证元数据字段不会被脚本当成加密正文扫描，也不应该触发任何解密调用。更多内容请查看正文。'
  };
  fixture.reader.chapterContentHtml = {};
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText();

  assert.equal(result.text, '');
  assert.deepEqual(fixture.decryptCalls, []);
});

test('缓存候选按正文度选正文，不因 preRenderHtml 字段优先而朗读 UI 文案', async () => {
  const body = '夜风从窗缝里钻进来，桌上的灯芯跳了两下。她披上外衣走到窗前，看见街道尽头亮起一点微光。那是父亲留下的旧铺子，灯下还坐着一个人影。';
  const intro = '这是本书的简介：主人公在风雨中成长，最终成为一代宗师。读者评价很高，值得一看。作者文笔细腻，叙事节奏紧凑，结尾令人回味。';
  const fixture = createFixture({}, {
    initialUid: 'chapter-10',
    returnEncryptedValue: true
  });
  fixture.renderer.preRenderHtml = intro;
  fixture.renderer.tempContent = body;
  fixture.setEntries('chapter-10');
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText();

  assert.equal(result.text.includes(body), true);
  assert.equal(result.source, 'Vue:tempContent');
});

test('解密结果是 UI 文案时拒绝，并降级到预渲染 DOM 正文', async () => {
  const ui = '书名 第一章 我的书架 目录 上一章 下一章 加入书架 书评 推荐 简介 阅读进度 免费试读 最新章节 完本 排行 分类 搜索 登录 注册 会员 充值 购买 下载 设置 朗读 语音 暂停 停止 语速 音色 作者有话说 本章导读 查看全部 听书 笔记 想法 划线 翻译';
  const body = '这一章从一场晚归开始。巷口的灯坏了，她只能借着月色辨认路。远处传来狗叫，她加快脚步，却在转角撞见一个不该出现的人。';
  const fixture = createFixture({}, {
    initialUid: 'chapter-11',
    decryptText: () => ui
  });
  fixture.setPreRenderText(body);
  fixture.setEntries('chapter-11');
  const extractor = await importExtractor();

  const result = await extractor.extractCurrentChapterText();

  assert.equal(result.text, body);
  assert.equal(result.source, 'preRenderDOM');
});

test('DOM 兜底不把长 UI 容器当正文', async () => {
  installDom();
  delete globalThis.unsafeWindow;

  const uiText = '书名 第一章 我的书架 目录 上一章 下一章 加入书架 书评 推荐 简介 阅读进度 免费试读 最新章节 完本 排行 分类 搜索 登录 注册 会员 充值 购买 下载 设置 朗读 语音 暂停 停止 语速 音色 作者有话说 本章导读 查看全部 听书 笔记 想法 划线 翻译';
  const bodyText = '夜风从窗缝里钻进来，桌上的灯芯跳了两下。她披上外衣走到窗前，看见街道尽头亮起一点微光。那是父亲留下的旧铺子，灯下还坐着一个人影。';
  const makeNode = (text, closest) => ({
    innerText: text,
    textContent: text,
    closest,
    cloneNode() {
      return {
        innerText: text,
        textContent: text,
        querySelectorAll: () => []
      };
    }
  });
  const app = {
    querySelectorAll(selector) {
      if (selector === 'div, article, main, section') {
        return [
          makeNode(uiText, (selectorString) => selectorString.includes('bookReview') ? {} : null),
          makeNode(bodyText, () => null)
        ];
      }
      return [];
    }
  };
  globalThis.document = {
    body: app,
    querySelector(selector) {
      if (selector === '#app') return app;
      return null;
    },
    querySelectorAll: () => []
  };
  globalThis.window = { setTimeout, clearTimeout };
  const extractor = await importExtractor();

  const result = extractor.getLegacyDomText();

  assert.equal(result.text, bodyText);
  assert.equal(result.source, 'DOM');
});

test('Canvas 阅读器不把标题和按钮文字当作正文', async () => {
  installDom();
  delete globalThis.unsafeWindow;
  const canvasContainer = { querySelector: () => ({}) };
  globalThis.document = {
    body: canvasContainer,
    querySelector(selector) {
      if (selector === '#app') return canvasContainer;
      if (selector === '.readerContent') {
        return {
          innerText: '书名 第十六章 首页 我的书架 上一章 下一页',
          querySelector: () => ({})
        };
      }
      if (selector === '.wr_canvasContainer, .readerChapterContent canvas') return {};
      return null;
    },
    querySelectorAll: () => []
  };
  globalThis.window = { setTimeout, clearTimeout };
  const extractor = await importExtractor();

  assert.equal(extractor.getLegacyDomText(), null);
});

test('Canvas 阅读器文本层按视觉坐标重排乱序字符 span', async () => {
  installDom();
  delete globalThis.unsafeWindow;

  const passageTexts = [
    '说，太子之前就掉下船了？',
    '具体位置？就在漕船被拽到礼字坝的'
  ];
  const charSpans = [];
  const passageNodes = passageTexts.map((text, pageIndex) => {
    const chars = Array.from(text);
    const spans = chars.map((ch, index) => {
      const line = Math.floor(index / 8);
      const column = index % 8;
      const left = pageIndex * 600 + column * 20;
      const top = 100 + pageIndex * 200 + line * 24;
      return makeTextLayerSpan(ch, left, top);
    });
    charSpans.push(...spans);

    // DOM 顺序故意与视觉顺序相反：上一页反向、下一页隔行错位。
    const domOrder = pageIndex === 0
      ? spans.map((_, index) => spans.length - 1 - index)
      : [8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7];
    return {
      textContent: text,
      innerText: text,
      cloneNode() {
        return { textContent: text, innerText: text, querySelectorAll: () => [] };
      },
      querySelectorAll(selector) {
        if (!selector.includes('[data-wr-role="text"]')) return [];
        return domOrder.map((index) => spans[index]);
      }
    };
  });
  const canvasContainer = { querySelector: () => ({}) };

  globalThis.document = {
    body: canvasContainer,
    querySelector(selector) {
      if (selector === '#app') return canvasContainer;
      if (selector === '.wr_canvasContainer, .readerChapterContent canvas') return {};
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#renderTargetContent .passage-content' || selector === '.passage-content') {
        return passageNodes;
      }
      if (selector === '#renderTargetContent [data-wr-role="text"]' || selector === '[data-wr-role="text"]') {
        return charSpans;
      }
      return [];
    }
  };
  globalThis.window = { setTimeout, clearTimeout, innerHeight: 450 };
  globalThis.document.documentElement = { clientHeight: 450 };

  const extractor = await importExtractor();
  const result = extractor.getLegacyDomText();

  assert.equal(result.source, 'DOM:textLayer');
  assert.equal(result.text, passageTexts.join(' '));
  assert.equal(result.text.includes('狱是河'), false);
});

function makeTextLayerSpan(text, left, top) {
  return {
    innerText: text,
    textContent: text,
    getBoundingClientRect() {
      return { left, top, right: left + 20, bottom: top + 24, height: 24, width: 20 };
    },
    cloneNode() {
      return {
        innerText: text,
        textContent: text,
        querySelectorAll: () => []
      };
    }
  };
}

test('解密、预渲染 DOM、缓存全失败时用 e_* 接口正文兜底', async () => {
  const body = '吴定缘肯定还活着。他从船舷边探出半个身子，看着黑黢黢的江水从指缝间流过，脑子里只剩这一个念头。';
  const fixture = createFixture({}, {
    initialUid: 'chapter-api-fallback',
    returnEncryptedValue: true
  });
  fixture.setEntries('chapter-api-fallback');
  const extractor = await importExtractor();
  const apiChapter = await importSharedApiChapter();
  const raw = Buffer.from(
    [
      '<!DOCTYPE html><html><body>',
      '<p class="content">' + body + '</p>',
      '</body></html>'
    ].join(''),
    'utf8'
  ).toString('base64');
  const chapterStartRaw = Buffer.from(
    [
      '<!DOCTYPE html><html><body>',
      '<h1 class="firstTitle">第十六章</h1>',
      '<p class="content">' + body + '</p>',
      '</body></html>'
    ].join(''),
    'utf8'
  ).toString('base64');
  const prefix = 'wr-api-prefix-' + 'x'.repeat(24) + '-';
  apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_0',
    JSON.stringify({ b: 'book-1', c: 'chapter-api-fallback' }),
    prefix + chapterStartRaw
  );
  apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_1',
    JSON.stringify({ b: 'book-1', c: 'chapter-api-fallback' }),
    prefix + raw
  );
  const stored = apiChapter.getChapterText('chapter-api-fallback');
  assert.ok(stored, '注入的接口响应必须能被同一 apiChapter 实例读取');
  assert.equal(stored.text.includes(body), true);

  const result = await extractor.extractCurrentChapterText({ expectedChapterUid: 'chapter-api-fallback' });

  assert.equal(result.text.includes(body), true);
  assert.equal(result.source, 'API:chapter');
  assert.equal(result.chapterUid, 'chapter-api-fallback');
  apiChapter.clearCache();
});
