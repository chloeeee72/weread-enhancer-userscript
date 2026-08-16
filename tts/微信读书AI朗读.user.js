// ==UserScript==
// @name         微信读书网页版 AI 朗读
// @namespace    https://weread.qq.com/
// @version      0.4.0
// @description  适配微信读书 canvas 正文，从阅读器内部状态提取章节文本并自动朗读，支持暂停、语速、音色和章节续读
// @author       Codex
// @match        https://weread.qq.com/web/reader/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'wr-tts-settings';
  const PANEL_ID = 'wr-tts-panel';

  const state = {
    text: '',
    chunks: [],
    index: 0,
    chapterUid: '',
    chapterTitle: '',
    source: '',
    rate: 1,
    voiceURI: '',
    playing: false,
    paused: false,
    stopped: true,
    follow: true,
    utterance: null
  };

  const ui = {
    panel: null,
    playBtn: null,
    stopBtn: null,
    pickBtn: null,
    rateSelect: null,
    voiceSelect: null,
    followCheckbox: null,
    status: null
  };

  let cachedStore = null;
  let cachedVm = null;
  let cachedReaderState = null;
  let cachedPreRenderHtml = null;
  let preRenderObserver = null;
  let chapterWatcher = null;

  function normalizeText(raw) {
    return String(raw || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitSentences(text) {
    const parts = text.match(/[^。！？!?；;…]+[。！？!?；;…]?/g) || [];
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  function splitLongSentence(sentence) {
    if (sentence.length <= 220) return [sentence];
    const parts = sentence.match(/[^，、：:，。！？!?；;…]+[，、：:，。！？!?；;…]?/g) || [sentence];
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  function chunkText(text) {
    const chunks = [];
    let current = '';

    for (const sentence of splitSentences(text)) {
      const pieces = splitLongSentence(sentence);
      for (const piece of pieces) {
        if ((current + piece).length > 220 && current) {
          chunks.push(current);
          current = piece;
        } else {
          current += piece;
        }
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  function findAppElement() {
    return document.querySelector('#app') || document.body;
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
    for (const vm of instances) {
      const store = vm.$store || (vm.proxy && vm.proxy.$store);
      if (store && store.state) return store;
    }
    return null;
  }

  function getReaderState(store, vm) {
    if (store && store.state && store.state.reader) return store.state.reader;
    if (vm && vm.$store && vm.$store.state && vm.$store.state.reader) return vm.$store.state.reader;
    return null;
  }

  function findReaderVms(instances) {
    let newRenderer = null;
    let decryptor = null;
    let fallbackDecryptor = null;
    let preRenderer = null;
    let preRendererRef = null;
    let refOwner = null;

    for (const vm of instances) {
      const isNewRenderer =
        vm &&
        (('tempContent' in vm) ||
          ('isShowPreRender' in vm) ||
          vm.getCurrentSection != null ||
          (vm.currentChapter && vm.currentChapter.chapterUid));
      if (!newRenderer && isNewRenderer) newRenderer = vm;
      if (!decryptor && typeof vm.decryptRenderHtml === 'function' && vm.bookId) decryptor = vm;
      if (!fallbackDecryptor && typeof vm.decryptRenderHtml === 'function') fallbackDecryptor = vm;
      if (!preRenderer && typeof vm.preRender === 'function' && 'preRenderHtml' in vm) preRenderer = vm;
      if (!preRendererRef && vm.$refs && vm.$refs.preRenderContainer && typeof vm.preRender === 'function') preRendererRef = vm;
      if (!refOwner && vm.$refs && (vm.$refs.preRenderContainer || vm.$refs.renderTargetCanvasContainer)) {
        refOwner = vm;
      }
    }

    const result = [];
    const seen = new Set();
    for (const vm of [newRenderer, preRendererRef, preRenderer, decryptor, fallbackDecryptor, refOwner]) {
      if (vm && !seen.has(vm)) {
        seen.add(vm);
        result.push(vm);
      }
    }
    return result;
  }

  function findReaderVm(instances) {
    return findReaderVms(instances)[0] || null;
  }

  function getCurrentChapterUid(readerState, vm) {
    if (readerState) {
      const current = readerState.currentChapter;
      if (current && current.chapterUid) return String(current.chapterUid);
      const section = readerState.currentSection;
      if (section && section.chapterUid) return String(section.chapterUid);
    }
    if (vm) {
      if (vm.currentChapterUid) return String(vm.currentChapterUid);
      if (vm.currentChapter && vm.currentChapter.chapterUid) return String(vm.currentChapter.chapterUid);
    }
    return '';
  }

  function findCachedPlaintext(instances, uid) {
    let best = null;

    for (const vm of instances) {
      const candidates = [];
      if (typeof vm.preRenderHtml === 'string' && vm.preRenderHtml) {
        candidates.push({ raw: vm.preRenderHtml, key: 'preRenderHtml' });
      }
      if (typeof vm.tempContent === 'string' && vm.tempContent) {
        candidates.push({ raw: vm.tempContent, key: 'tempContent' });
      }

      for (const candidate of candidates) {
        const text = htmlToText(candidate.raw);
        if (!isPlausibleText(text)) continue;
        const vmUid = getCurrentChapterUid(getReaderState(null, vm), vm);
        const mismatch = uid && vmUid && vmUid !== uid ? 20 : 0;
        const score = (candidate.key === 'preRenderHtml' ? 0 : 1) + mismatch;
        if (!best || score < best.score) {
          best = { text, source: 'Vue:' + candidate.key, score };
        }
      }
    }

    return best ? { text: best.text, source: best.source } : null;
  }

  function normalizeEntries(value, fallbackUid) {
    const result = [];
    if (!value) return result;

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (!entry || typeof entry.value !== 'string' || typeof entry.valueHasStr !== 'function') return;
        result.push({
          entry,
          chapterUid: entry.chapterUid != null ? String(entry.chapterUid) : fallbackUid,
          index
        });
      });
      return result;
    }

    Object.keys(value).forEach((uid) => {
      const item = value[uid];
      const list = Array.isArray(item) ? item : [item];
      list.forEach((entry, index) => {
        if (!entry || typeof entry.value !== 'string' || typeof entry.valueHasStr !== 'function') return;
        result.push({ entry, chapterUid: String(uid), index });
      });
    });

    return result;
  }

  function collectEntries(readerState, vm) {
    const result = [];
    const seen = new Set();

    function add(value, fallbackUid) {
      const items = normalizeEntries(value, fallbackUid);
      for (const item of items) {
        const key = item.entry.value.slice(0, 200) + '|' + item.chapterUid + '|' + item.index;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
      }
    }

    if (readerState) {
      add(readerState.horizontalReaderChapterContentHtml, '');
      add(readerState.chapterContentHtml, '');
      Object.keys(readerState).forEach((key) => {
        if (!/(ContentHtml|ChapterContent|RenderContent)/i.test(key)) return;
        if (/Target|Highlight|Selection/i.test(key)) return;
        add(readerState[key], '');
      });
    }

    if (vm) {
      add(vm.horizontalReaderChapterContentHtml, '');
      add(vm.chapterContentHtml, '');
    }

    return result;
  }

  function isPlausibleText(text) {
    const value = normalizeText(text);
    if (value.length < 12) return false;
    return /[\u3400-\u9FFF]/.test(value) || /[A-Za-z]{4,}/.test(value);
  }

  function htmlToText(html) {
    if (!html) return '';
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, noscript, svg, canvas, audio, video, iframe').forEach((el) => el.remove());
      const bodyText = doc.body && (doc.body.innerText || doc.body.textContent);
      return normalizeText(bodyText || html.replace(/<[^>]+>/g, ' '));
    } catch (error) {
      return normalizeText(html.replace(/<[^>]+>/g, ' '));
    }
  }

  async function decryptEntry(vms, entry, uid, index, probe) {
    const vmList = Array.isArray(vms) ? vms : (vms ? [vms] : []);

    for (const vm of vmList) {
      if (!vm || (!('tempContent' in vm) && !('isShowPreRender' in vm))) continue;
      if (typeof vm.tempContent === 'string' && isPlausibleText(htmlToText(vm.tempContent))) {
        return vm.tempContent;
      }
      if ('isShowPreRender' in vm && probe && !probe.toggleAttempted) {
        probe.toggleAttempted = true;
        const previous = vm.isShowPreRender;
        if (!previous) {
          try {
            vm.isShowPreRender = true;
            await nextTick();
            if (typeof vm.tempContent === 'string' && vm.tempContent) return vm.tempContent;
          } catch (error) {
            // 切换失败时继续走其他解密路径
          } finally {
            if (vm.isShowPreRender !== previous) vm.isShowPreRender = previous;
          }
        }
      }
    }

    for (const vm of vmList) {
      if (typeof vm.decryptRenderHtml !== 'function') continue;
      try {
        vm.decryptRenderHtml(entry.value, uid || '0', getSectionIndex(vm, index || 0));
        if (typeof vm.tempContent === 'string' && vm.tempContent) return vm.tempContent;
        if (typeof vm.preRenderHtml === 'string' && vm.preRenderHtml) return vm.preRenderHtml;
      } catch (error) {
        // 该实例解密失败时换下一个实例
      }
    }

    for (const vm of vmList) {
      if (typeof vm.preRender !== 'function' || !('preRenderHtml' in vm)) continue;
      if (typeof vm.preRenderHtml === 'string' && vm.preRenderHtml) return vm.preRenderHtml;
      if (probe && probe.preRenderAttempted) continue;
      if (probe) probe.preRenderAttempted = true;

      const previousShouldPreRender = vm.shouldPreRender;
      try {
        vm.preRender(uid || '0');
        if (typeof vm.preRenderHtml === 'string' && vm.preRenderHtml) return vm.preRenderHtml;
      } catch (error) {
        // preRender 失败时继续下一个实例
      } finally {
        if (previousShouldPreRender !== undefined) vm.shouldPreRender = previousShouldPreRender;
      }
    }

    return '';
  }

  function getSectionIndex(vm, fallback) {
    if (!vm) return fallback || 0;
    try {
      if (typeof vm.getCurrentSectionIdx === 'function') {
        const value = vm.getCurrentSectionIdx();
        if (typeof value === 'number') return value;
      } else if (typeof vm.getCurrentSectionIdx === 'number') {
        return vm.getCurrentSectionIdx;
      }
    } catch (error) {
      // 取章节序号失败时使用传入的 fallback
    }
    return fallback || 0;
  }

  function nextTick(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms || 50));
  }

  function capturePreRenderDom(root) {
    const selectors = ['#preRenderContent', '#preRenderContents', '.preRenderContent', '.preRenderContainer'];
    const nodes = root && root.querySelectorAll ? Array.from(root.querySelectorAll(selectors.join(','))) : [];
    for (const el of nodes) {
      const text = normalizeText(el.innerText || el.textContent);
      if (isPlausibleText(text)) {
        cachedPreRenderHtml = {
          text,
          html: el.innerHTML || '',
          source: 'preRenderDOM',
          capturedAt: Date.now()
        };
        return cachedPreRenderHtml;
      }
    }
    return cachedPreRenderHtml;
  }

  function readPreRenderDom() {
    const captured = capturePreRenderDom(findAppElement());
    if (captured && captured.text) {
      return { text: captured.text, source: captured.source };
    }
    return null;
  }

  function startPreRenderObserver() {
    if (preRenderObserver || typeof MutationObserver === 'undefined') return;
    const target = document.documentElement || document.body;
    if (!target) return;
    preRenderObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes) continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          capturePreRenderDom(node);
        }
      }
      capturePreRenderDom(document);
    });
    preRenderObserver.observe(target, { subtree: true, childList: true });
    capturePreRenderDom(document);
  }

  function getLegacyDomText() {
    const selectors = ['.readerChapterContent', '.readerContent', '.readerChapter', '.app_content', '.readerContainer'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = normalizeText(el.innerText);
      if (isPlausibleText(text)) return { text, source: 'DOM' };
    }

    let best = null;
    let bestLength = 0;
    const app = findAppElement();
    const candidates = app ? app.querySelectorAll('div, article, main, section') : document.querySelectorAll('div, article, main, section');

    for (const el of candidates) {
      if (el.closest('#' + PANEL_ID)) continue;
      if (el.querySelector('canvas, iframe, button, input, textarea, select')) continue;
      const text = normalizeText(el.innerText);
      if (!isPlausibleText(text)) continue;
      const cjkCount = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
      if (cjkCount < text.length * 0.2) continue;
      if (text.length > bestLength) {
        best = { text, source: 'DOM' };
        bestLength = text.length;
      }
    }

    return best;
  }

  async function extractCurrentChapterText() {
    const dom = readPreRenderDom();
    if (dom) return dom;

    const instances = collectVueInstances();
    const store = getStore(instances);
    cachedStore = store;

    const readerVms = findReaderVms(instances);
    const vm = readerVms[0] || null;
    cachedVm = vm;

    const readerState = getReaderState(store, vm);
    cachedReaderState = readerState;

    const uid = getCurrentChapterUid(readerState, vm);
    const cached = findCachedPlaintext(instances, uid);
    if (cached) {
      return {
        text: cached.text,
        source: cached.source,
        chapterUid: uid
      };
    }

    const entries = collectEntries(readerState, vm);
    const preferred = uid ? entries.filter((item) => item.chapterUid === uid) : [];
    const pool = preferred.length ? preferred : entries;
    const texts = [];
    const probe = { preRenderAttempted: false, toggleAttempted: false };

    for (const item of pool.slice(0, 20)) {
      const html = await decryptEntry(readerVms, item.entry, item.chapterUid || uid || '0', item.index || 0, probe);
      const text = htmlToText(html);
      if (isPlausibleText(text)) texts.push(text);
    }

    const text = normalizeText(texts.join('\n'));
    if (isPlausibleText(text)) {
      return {
        text,
        source: uid ? 'Vue:' + uid : 'Vue',
        chapterUid: uid
      };
    }

    return { text: '', source: '', chapterUid: uid };
  }

  function getSelectedVoice() {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return voices.find((voice) => voice.voiceURI === state.voiceURI) || null;
  }

  function refreshVoices() {
    if (!ui.voiceSelect) return;
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const chineseVoices = voices.filter((voice) =>
      (voice.lang || '').toLowerCase().startsWith('zh')
    );
    const usableVoices = chineseVoices.length ? chineseVoices : voices;
    const selected = state.voiceURI;

    ui.voiceSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '系统默认音色';
    ui.voiceSelect.appendChild(defaultOption);

    usableVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = voice.name + ' (' + voice.lang + ')';
      if (voice.voiceURI === selected) option.selected = true;
      ui.voiceSelect.appendChild(option);
    });
  }

  function saveSettings() {
    const settings = {
      rate: Number(ui.rateSelect.value),
      voiceURI: ui.voiceSelect.value,
      follow: ui.followCheckbox.checked
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      // 无痕模式或受限存储时忽略
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const settings = JSON.parse(raw);
      if (typeof settings.rate === 'number') state.rate = settings.rate;
      if (typeof settings.voiceURI === 'string') state.voiceURI = settings.voiceURI;
      if (typeof settings.follow === 'boolean') state.follow = settings.follow;
    } catch (error) {
      // 设置损坏时使用默认值
    }
  }

  function showToast(message) {
    let toast = document.getElementById('wr-tts-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wr-tts-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('wr-tts-show');
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      toast.classList.remove('wr-tts-show');
    }, 2400);
  }

  function updateUI() {
    if (!ui.playBtn) return;
    if (state.paused) {
      ui.playBtn.textContent = '继续';
    } else if (state.playing) {
      ui.playBtn.textContent = '暂停';
    } else {
      ui.playBtn.textContent = '朗读';
    }
    ui.status.textContent = state.chunks.length
      ? Math.min(state.index + 1, state.chunks.length) + '/' + state.chunks.length
      : '就绪';
    ui.status.title = state.source ? state.source : '';
  }

  function stopChapterWatcher() {
    if (chapterWatcher) {
      window.clearInterval(chapterWatcher);
      chapterWatcher = null;
    }
  }

  function startChapterWatcher() {
    if (chapterWatcher) return;
    chapterWatcher = window.setInterval(() => {
      if (!state.playing && !state.paused) return;
      const uid = getCurrentChapterUid(cachedReaderState, cachedVm);
      if (!uid || !state.chapterUid || uid === state.chapterUid) return;
      if (state.follow) {
        showToast('章节已切换，继续朗读');
        startReading();
      } else {
        stopReading();
        showToast('章节已切换，已停止朗读');
      }
    }, 700);
  }

  function startReadingFromText(text, source, chapterUid) {
    const chunks = chunkText(text);
    if (!chunks.length) {
      showToast('所选章节没有可朗读的文本');
      return;
    }

    stopSpeechSilently();
    state.text = text;
    state.source = source;
    state.chunks = chunks;
    state.index = 0;
    state.chapterUid = chapterUid || '';
    state.stopped = false;
    state.paused = false;
    startChapterWatcher();
    speakChunk(0);
    showToast('已提取正文 ' + text.length + ' 字');
  }

  function speakChunk(index) {
    if (state.stopped) return;
    if (index >= state.chunks.length) {
      finishReading();
      return;
    }

    const chunk = state.chunks[index];
    const utterance = new SpeechSynthesisUtterance(chunk);
    const voice = getSelectedVoice();

    utterance.rate = state.rate;
    utterance.pitch = 1;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'zh-CN';
    }

    utterance.onstart = () => {
      state.playing = true;
      state.paused = false;
      state.index = index;
      updateUI();
    };

    utterance.onend = () => {
      if (state.stopped || state.paused) return;
      state.index += 1;
      speakChunk(state.index);
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      if (event.error === 'not-allowed') {
        showToast('浏览器阻止语音，请先点击页面任意位置');
      }
      state.playing = false;
      state.paused = false;
      updateUI();
    };

    state.utterance = utterance;
    window.speechSynthesis.speak(utterance);
    state.playing = true;
    state.paused = false;
    updateUI();
  }

  async function startReading() {
    const result = await extractCurrentChapterText();
    let text = result.text;
    let source = result.source;
    let chapterUid = result.chapterUid;

    if (!isPlausibleText(text)) {
      const legacy = getLegacyDomText();
      if (legacy) {
        text = legacy.text;
        source = legacy.source;
        chapterUid = '';
      }
    }

    if (!isPlausibleText(text)) {
      showToast('未找到章节正文，请打开书籍正文页后重试');
      return;
    }

    startReadingFromText(text, source, chapterUid);
  }

  function stopSpeechSilently() {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      // 忽略旧朗读的取消错误
    }
  }

  function pauseReading() {
    if (typeof window.speechSynthesis.pause === 'function') {
      window.speechSynthesis.pause();
      state.paused = true;
      updateUI();
      return;
    }
    state.paused = true;
    stopSpeechSilently();
    updateUI();
  }

  function resumeReading() {
    if (typeof window.speechSynthesis.resume === 'function') {
      window.speechSynthesis.resume();
      state.paused = false;
      updateUI();
      return;
    }
    state.paused = false;
    speakChunk(state.index);
  }

  function stopReading() {
    state.stopped = true;
    state.paused = false;
    state.playing = false;
    state.chunks = [];
    state.index = 0;
    stopSpeechSilently();
    stopChapterWatcher();
    updateUI();
  }

  function finishReading() {
    state.stopped = true;
    state.paused = false;
    state.playing = false;
    updateUI();
    showToast('本章朗读完成');
  }

  async function toggleReading() {
    if (state.playing && !state.paused) {
      pauseReading();
    } else if (state.paused) {
      resumeReading();
    } else {
      await startReading();
    }
  }

  function addStyle() {
    const style = document.createElement('style');
    style.id = 'wr-tts-style';
    style.textContent = [
      '#' + PANEL_ID + '{',
      'position:fixed;right:16px;bottom:24px;z-index:2147483647;',
      'display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
      'max-width:min(92vw,600px);padding:10px 12px;',
      'background:rgba(24,24,27,.94);color:#fff;',
      'border:1px solid rgba(255,255,255,.18);border-radius:8px;',
      'box-shadow:0 10px 28px rgba(0,0,0,.32);',
      'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      '}',
      '#' + PANEL_ID + ' button,#' + PANEL_ID + ' select{',
      'height:30px;border:1px solid rgba(255,255,255,.24);border-radius:6px;',
      'background:#3f3f46;color:#fff;font:inherit;',
      '}',
      '#' + PANEL_ID + ' button{min-width:54px;cursor:pointer;}',
      '#' + PANEL_ID + ' button:hover{background:#52525b;}',
      '#' + PANEL_ID + ' select{max-width:220px;padding:0 6px;}',
      '#' + PANEL_ID + ' label{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}',
      '#' + PANEL_ID + ' input{accent-color:#4f8cff;}',
      '#wr-tts-status{color:#cbd5e1;min-width:52px;text-align:right;}',
      '#wr-tts-toast{',
      'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);',
      'z-index:2147483647;padding:8px 14px;border-radius:6px;',
      'background:rgba(24,24,27,.94);color:#fff;opacity:0;pointer-events:none;',
      'transition:opacity .2s ease;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      '}',
      '#wr-tts-toast.wr-tts-show{opacity:1;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function buildPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = [
      '<button type="button" id="wr-tts-play" title="朗读或暂停">朗读</button>',
      '<button type="button" id="wr-tts-stop" title="停止朗读">停止</button>',
      '<button type="button" id="wr-tts-pick" title="重新从阅读器内部状态提取当前章节正文">重试</button>',
      '<label>语速<select id="wr-tts-rate">',
      '<option value="0.75">0.75x</option>',
      '<option value="1" selected>1x</option>',
      '<option value="1.25">1.25x</option>',
      '<option value="1.5">1.5x</option>',
      '<option value="2">2x</option>',
      '</select></label>',
      '<label>音色<select id="wr-tts-voice"></select></label>',
      '<label><input type="checkbox" id="wr-tts-follow" checked>章节续读</label>',
      '<span id="wr-tts-status">就绪</span>'
    ].join('');

    document.body.appendChild(panel);

    ui.panel = panel;
    ui.playBtn = document.getElementById('wr-tts-play');
    ui.stopBtn = document.getElementById('wr-tts-stop');
    ui.pickBtn = document.getElementById('wr-tts-pick');
    ui.rateSelect = document.getElementById('wr-tts-rate');
    ui.voiceSelect = document.getElementById('wr-tts-voice');
    ui.followCheckbox = document.getElementById('wr-tts-follow');
    ui.status = document.getElementById('wr-tts-status');

    loadSettings();

    ui.rateSelect.value = String(state.rate);
    ui.followCheckbox.checked = state.follow;

    ui.playBtn.addEventListener('click', toggleReading);
    ui.stopBtn.addEventListener('click', stopReading);
    ui.pickBtn.addEventListener('click', () => {
      if (state.playing || state.paused) stopReading();
      startReading();
    });
    ui.rateSelect.addEventListener('change', () => {
      state.rate = Number(ui.rateSelect.value);
      saveSettings();
    });
    ui.voiceSelect.addEventListener('change', () => {
      state.voiceURI = ui.voiceSelect.value;
      saveSettings();
    });
    ui.followCheckbox.addEventListener('change', () => {
      state.follow = ui.followCheckbox.checked;
      saveSettings();
    });

    refreshVoices();
    updateUI();
  }

  function init() {
    if (!('speechSynthesis' in window)) {
      showToast('当前浏览器不支持语音合成');
      return;
    }

    addStyle();
    startPreRenderObserver();
    buildPanel();
    refreshVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    } else {
      window.setInterval(refreshVoices, 3000);
    }

    window.setTimeout(refreshVoices, 500);
  }

  init();
})();
