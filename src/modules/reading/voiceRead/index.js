import { appState } from '../../../runtime/state.js';
import { moduleRegistry } from '../../../runtime/registry.js';
import { utils } from '../../../utils/index.js';
import { pace } from '../pace/index.js';
import { chunker } from './chunker.js';
import { extractor } from './extractor.js';
import { apiChapter } from './apiChapter.js';
import { speechEngine } from './speechEngine.js';
import { ttsSettings } from './settings.js';
import { initQuickBarDrag } from './quickBarDrag.js';
import { SpeechClock } from './speechClock.js';
import { buildLayoutMap, getLayoutY } from './layoutMap.js';
import { scrollFollower, getScrollRoot } from './scrollFollower.js';

const QUICK_BAR_ID = 'wr-voice-quick';
const CPS_PROFILES_KEY = 'weread_tts_cps_profiles';
const CHAPTER_WAIT_TIMEOUT_MS = 15000;
const CHAPTER_LOAD_RETRY_COUNT = 4;
/** 无历史语速模型时，先用一小段静音样本实测当前音色的真实字/秒，避免首块滚动跑飞 */
const CPS_PROBE_TEXT = '这是一段用于校准语音速度的短文本。今天天气很好，我们一起去公园散步。';
const CPS_PROBE_TIMEOUT_MS = 12000;
/** 定位“从文字”起点后，滚动时给顶部固定栏预留的像素 */
const RANGE_SCROLL_TOP_PADDING = 80;

/** quickBarDrag 返回的控制器，用于清理旧版本遗留的隐藏状态 */
let quickBarController = null;

const voiceState = {
  chapterUid: '',
  source: '',
  rangePolicy: 'dynamic',
  loading: false,
  waitingForChapter: false,
  chapterWatcher: null,
  chapterWaitTimer: null,
  initialized: false,
  /** 当前正在朗读的正文长度（字符数），用于 pace 估算朗读时长以匹配滚动速度 */
  textLength: 0,
  /** 范围定位：起止文字在整章归一化文本中的绝对偏移与总长 */
  rangeStartIndex: 0,
  rangeEndIndex: 0,
  rangeTotalLength: 0,
    /** 当前可见页在整章归一化文本中的边界（Canvas 分页朗读的核心） */
    pageStartIndex: 0,
    pageEndIndex: 0,
    pageIndex: 0,
    pageCount: 1,
    isLastChapterPage: true,
    pageSignature: '',
    /** 当前页 canvas 在文档流中的 y 范围（pageContext 提供）；分页阅读下必须用它换算 scrollTop */
    pageStartY: null,
    pageEndY: null,

  /** 预渲染 DOM 实测到的起止 y 坐标（文档流内），null 表示未定位成功 */
  rangeStartY: null,
  rangeEndY: null,
  /** 朗读开始时已经用文本层真实坐标对齐过的 scrollTop；滚动跟随以此为锚点 */
  rangeStartScrollTop: null,
  /** 是否正在异步定位“从文字”起点（期间滚动保持原位，避免两次跳变） */
  locatePending: false,
  /** 会话序号：每次开始/停止朗读自增，用于丢弃过期的异步定位结果 */
  sessionId: 0,
  /** 跳转序号：每次点击“确定范围”/“清除范围”自增，丢弃过期的定位跳转结果 */
  jumpToken: 0,
  /** L1 检测：当前音色是否支持 boundary 事件（null=未检测，false=不支持） */
  boundarySupported: null,
  /** L2 校准：归一化到 1x 语速的字/秒样本（最近完成 chunk 的真实耗时反推） */
  cpsSamples: [],
  /** L2 当前预测的 1x 字/秒；未校准时为 pace 默认常量 */
  calibratedCps: pace.CHARS_PER_SECOND_AT_1X,
  /** L3 锚点表：[{ charOffset, err }] 升序，err = DOM 实测 y - 线性映射 y */
  scrollAnchors: [],
  /** 是否正在异步测量锚点（防并发重复测量） */
  anchorMeasuring: false,
  /** 锚点源校验缓存：{ node, textLength }，避免每个块边界重复读取 innerText 造成卡顿 */
  anchorSourceCache: { node: null, textLength: 0 },
  /** 当前整章规范化文本与带绝对偏移的语音块 */
  chapterText: '',
  timelineChunks: [],
  /** 连续语音字符时钟。boundary 只作观测，不直接改页面位置。 */
  speechClock: new SpeechClock(),
  /** 播放前建立的真实行 y 表；不可用时降级到线性映射 + 锚点。 */
  layoutMap: null,
  layoutMode: 'ratio',
  layoutVersion: 0,
  layoutResizeObserver: null,
  layoutRefreshTimer: null,
  sessionAbortController: null,
  realigning: false,
  autoPausedReason: '',
  manualResumeTimer: null,
  settingResumeTimer: null,
  manualPointerActive: false,
  visibilityShouldResume: false,
  lastDebugSampleAt: 0
};

function setButtonDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (el) el.disabled = disabled;
}

export const voiceRead = {
  isActive() {
    return Boolean(
      speechEngine.playing ||
      speechEngine.paused ||
      voiceState.loading ||
      voiceState.waitingForChapter
    );
  },

  init() {
    if (voiceState.initialized) return;
    voiceState.initialized = true;

    ttsSettings.load();
    pace.applyRate(ttsSettings.rate);
    apiChapter.ensureHooked();
    extractor.startPreRenderObserver();
    speechEngine.setHandlers({
      onStateChange: () => this.syncPlaybackUI(),
      onChunkStart: (index, event) => {
        voiceState.speechClock.startChunk(index, event?.at || performance.now(), event?.chunk?.startOffset);
        this.scheduleAnchorMeasurement(index);
      },
      onBoundary: (index, event) => {
        voiceState.boundarySupported = true;
        voiceState.speechClock.observeBoundary(index, event?.charIndex, event?.at || performance.now());
      },
      onChunkEnd: (index, event) => {
        voiceState.speechClock.finishChunk(index, event?.at || performance.now());
      },
      onFinish: () => this.handleFinish(),
      onError: (message, retryable) => {
        utils.notificationManager.show(message);
        // retryable（如浏览器尚未授权语音）时保留快捷条，用户点击页面后可立即重试
        this.stop({ silent: true, hideBar: !retryable });
      }
    });

    this.buildQuickBar();
    this.bindControlEvents();
    this.refreshVoices();

    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this.refreshVoices();
    } else {
      window.setInterval(() => this.refreshVoices(), 3000);
    }
    window.setTimeout(() => this.refreshVoices(), 500);

    this.syncAllUI();
    this.syncRangeInputs();

    $(window).on('resize', () => this.scheduleLayoutRefresh('resize'));
    document.fonts?.addEventListener?.('loadingdone', () => this.scheduleLayoutRefresh('fonts'));
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    document.addEventListener('wheel', () => this.handleManualScroll(), { passive: true });
    document.addEventListener('touchstart', () => {
      voiceState.manualPointerActive = true;
      this.handleManualScroll();
    }, { passive: true });
    document.addEventListener('touchend', () => {
      voiceState.manualPointerActive = false;
      this.handleManualScroll();
    }, { passive: true });
    document.addEventListener('pointerdown', (event) => {
      if (event.target?.closest?.('.voice-quick, .control-panel')) return;
      if (event.clientX < (window.innerWidth || 0) - 24) return;
      voiceState.manualPointerActive = true;
      this.handleManualScroll();
    }, { passive: true });
    document.addEventListener('pointerup', () => {
      if (!voiceState.manualPointerActive) return;
      voiceState.manualPointerActive = false;
      this.handleManualScroll();
    }, { passive: true });
    document.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
        this.handleManualScroll();
      }
    });
  },

  start(options = {}) {
    if (!speechEngine.available) {
      utils.notificationManager.show('当前浏览器不支持语音合成');
      return Promise.resolve();
    }
    return this.loadAndSpeak(options);
  },

  waitForPageTurn(signal) {
    if (!appState.isPageTurning) return Promise.resolve(true);
    const startedAt = performance.now();
    return new Promise((resolve) => {
      const check = () => {
        if (signal?.aborted) {
          resolve(false);
          return;
        }
        if (!appState.isPageTurning || performance.now() - startedAt > 5000) {
          resolve(true);
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
  },

  async extractReadableChapter(options, signal) {
    const expectedChapterUid = String(options.expectedChapterUid || '');
    const rejectedText = chunker.normalizeText(options.rejectText || '');
    const attempts = options.continuation
      ? CHAPTER_LOAD_RETRY_COUNT
      : Math.max(CHAPTER_LOAD_RETRY_COUNT, 5);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (signal?.aborted) return null;

      try {
        const result = await extractor.extractCurrentChapterText({ expectedChapterUid });
        const resultUid = String(result?.chapterUid || '');
        const normalizedText = chunker.normalizeText(result?.text);
        const uidMatches = !expectedChapterUid || resultUid === expectedChapterUid;
        const isRejectedText = rejectedText && normalizedText === rejectedText;
        if (uidMatches && !isRejectedText && chunker.isLikelyChapterText(normalizedText)) {
          return { ...result, text: normalizedText };
        }

        if (uidMatches && !resultUid) {
          const legacy = extractor.getLegacyDomText();
          const legacyText = chunker.normalizeText(legacy?.text);
          if (legacy && legacyText !== rejectedText && chunker.isLikelyChapterText(legacyText)) {
            return { ...legacy, chapterUid: resultUid };
          }
        }
      } catch (error) {
        this.debugLog('章节正文提取失败，准备重试', error);
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 + attempt * 250));
      }
    }

    return null;
  },

  async loadAndSpeak(options = {}) {
    if (voiceState.loading) return;
    this.clearChapterWaitTimer();
    voiceState.loading = true;
    voiceState.waitingForChapter = false;
    voiceState.sessionId += 1;
    const sessionId = voiceState.sessionId;
    voiceState.sessionAbortController?.abort();
    const abortController = new AbortController();
    voiceState.sessionAbortController = abortController;

    try {
      await this.waitForPageTurn(abortController.signal);
      if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
      const result = await this.extractReadableChapter(options, abortController.signal);
      if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
      if (!result) {
        const message = options.continuation
          ? '下一章正文加载失败，连续朗读已停止，请重试'
          : '未找到章节正文，请打开书籍正文页后重试';
        utils.notificationManager.show(message);
        this.stop({ silent: true, hideBar: false });
        return;
      }
      const { text, source, chapterUid = '' } = result;

      const chapterText = chunker.normalizeText(text);
      const pageContext = await extractor.extractCurrentPageContext({ text: chapterText, chapterUid, probe: false });
      if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
      // 同章跨页续读/下一章续读时，不再套用用户“从文字/到文字”，
      // 否则第二页会从上一页末尾的句子再读一遍。
      // 双栏阅读下同样隐藏/忽略“从文字”，按当前页正文起止朗读。
      const isContinuation = Boolean(options.continuation);
      const isDoubleColumn = Boolean(moduleRegistry.autoRead?.isDoubleColumnReading?.());
      const usePageRangeOnly = isContinuation || isDoubleColumn;
      const rangeResult = usePageRangeOnly
        ? { text: chapterText, rangePolicy: 'dynamic', startIndex: 0, endIndex: 0, totalLength: chapterText.length }
        : chunker.applyRange(chapterText, ttsSettings.rangeStart, ttsSettings.rangeEnd);
      if (!usePageRangeOnly && rangeResult.warning === 'start-not-found') {
        utils.notificationManager.show('未找到开始文字，将朗读当前页');
      } else if (rangeResult.warning === 'end-not-found') {
        utils.notificationManager.show('未找到结束文字，将朗读到当前页末尾');
      }

      let pageStartIndex = Math.max(0, Number(pageContext?.pageStartIndex) || 0);
      let pageEndIndex = Math.min(
        chapterText.length,
        Math.max(pageStartIndex + 1, Number(pageContext?.pageEndIndex) || chapterText.length)
      );

      // 语音朗读不再自动滚动/自动定位，页范围直接用页面上下文估算，
      // 不再做任何会滚动页面的页边界校准。

      // 双栏阅读手动翻页后，如果页面上下文退化成整章，尝试用文本层第一个 passage 收敛页首。
      if (isDoubleColumn && !isContinuation && pageStartIndex === 0 && pageEndIndex >= chapterText.length) {
        const boundary = await extractor.findTextLayerBoundary(chapterText);
        if (boundary && boundary.offset > 0 && boundary.offset < chapterText.length) {
          pageStartIndex = boundary.offset;
        }
      }

      // 同章跨页续读时，缓存的第一页页尾可能不准，导致第二页又从上一页末尾句子开始。
      // 这里用“新页面文本层第一个 passage”的位置作为页首，避免重复朗读和滚到空白处。
      let continuationBoundary = null;
      if (isContinuation) {
        // 同章翻页时，上一页的 rangeEndIndex 就是下一页的权威页首，
        // 不能用文本层第一个 passage 覆盖它（文本层可能从页中段才开始）。
        if (Number.isFinite(options.previousRangeEndIndex) && options.previousRangeEndIndex > 0) {
          pageStartIndex = Math.min(chapterText.length, Math.floor(Number(options.previousRangeEndIndex)));
        } else {
          continuationBoundary = await extractor.findTextLayerBoundary(chapterText);
          if (continuationBoundary && continuationBoundary.offset > pageStartIndex) {
            pageStartIndex = continuationBoundary.offset;
          }
        }
      }
      const userStartOffset = rangeResult.startIndex || 0;
      const userEndOffset = rangeResult.endIndex > 0
        ? rangeResult.endIndex
        : chapterText.length;
      const effectiveStart = Math.max(userStartOffset, pageStartIndex);
      const effectiveEnd = Math.min(pageEndIndex, Math.max(effectiveStart, userEndOffset));
      const rangeText = chapterText.slice(effectiveStart, effectiveEnd);
      const chunks = chunker.chunkTextWithOffsets(rangeText, effectiveStart);
      if (!chunks.length) {
        utils.notificationManager.show('所选范围没有可朗读的文本');
        return;
      }

      const explicitRangeFitsPage = Boolean(
        rangeResult.rangePolicy === 'explicit' &&
        userEndOffset > userStartOffset &&
        userStartOffset >= pageStartIndex &&
        userEndOffset <= pageEndIndex
      );

      voiceState.chapterUid = chapterUid || '';
      voiceState.source = source;
      voiceState.rangePolicy = explicitRangeFitsPage ? 'explicit' : 'dynamic';
      voiceState.textLength = rangeText.length;
      voiceState.chapterText = chapterText;
      voiceState.timelineChunks = chunks;
      voiceState.rangeStartIndex = effectiveStart;
      voiceState.rangeEndIndex = effectiveEnd;
      voiceState.rangeTotalLength = rangeResult.totalLength || chapterText.length;
      voiceState.pageStartIndex = pageStartIndex;
      voiceState.pageEndIndex = pageEndIndex;
      voiceState.pageIndex = Number(pageContext?.pageIndex) || 0;
      voiceState.pageCount = Math.max(1, Number(pageContext?.pageCount) || 1);
      voiceState.isLastChapterPage = Boolean(pageContext?.isLastChapterPage ?? (voiceState.pageIndex >= voiceState.pageCount - 1));
      voiceState.pageSignature = String(pageContext?.pageSignature || extractor.getCurrentPageSignature());
      voiceState.pageStartY = Number.isFinite(Number(pageContext?.pageStartY)) ? Number(pageContext.pageStartY) : null;
      voiceState.pageEndY = Number.isFinite(Number(pageContext?.pageEndY)) ? Number(pageContext.pageEndY) : null;
      voiceState.rangeStartY = null;
      voiceState.rangeEndY = null;
      voiceState.rangeStartScrollTop = null;
      voiceState.locatePending = true;
      voiceState.scrollAnchors = [];
      voiceState.anchorMeasuring = false;
      voiceState.anchorSourceCache = { node: null, textLength: 0 };
      voiceState.layoutMap = null;
      voiceState.layoutMode = 'ratio';
      voiceState.layoutResizeObserver?.disconnect();
      voiceState.layoutResizeObserver = null;
      voiceState.layoutVersion += 1;
      voiceState.calibratedCps = this.loadCpsProfile();
      voiceState.speechClock.configure({
        chunks,
        rate: ttsSettings.rate,
        fallbackCps: this.getEffectiveCps(),
        rangeStart: effectiveStart,
        rangeEnd: effectiveEnd
      });

      // 语音朗读不再自动滚动：跳过布局测量、初始定位和语速校准滚动。
      voiceState.locatePending = false;

      const debugTarget = typeof unsafeWindow !== 'undefined' && unsafeWindow ? unsafeWindow : window;
      const speechDebug = {
        source,
        chapterUid,
        textLength: text.length,
        head: text.slice(0, 160),
        fullText: text
      };
      window.__wrLastSpeechDebug = speechDebug;
      debugTarget.__wrLastSpeechDebug = speechDebug;
      speechEngine.speak(chunks, ttsSettings.rate, ttsSettings.voiceURI);
      this.startChapterWatcher();
      this.showQuickBar();
      this.syncAllUI();
      this.debugLog('正文提取完成 uid=' + (chapterUid || 'unknown') + ' source=' + source + ' chars=' + text.length);
      utils.notificationManager.show('已提取正文 ' + text.length + ' 字');
    } catch (error) {
      if (!abortController.signal.aborted && sessionId === voiceState.sessionId) {
        this.debugLog('朗读准备失败', error);
        utils.notificationManager.show('朗读准备失败，请重试');
        this.stop({ silent: true, hideBar: false });
      }
    } finally {
      if (sessionId === voiceState.sessionId) voiceState.loading = false;
    }
  },

  toggle() {
    if (voiceState.loading) {
      this.stop({ silent: true });
      return;
    }
    if (speechEngine.playing && !speechEngine.paused) {
      this.pause();
    } else if (speechEngine.paused) {
      this.resume();
    } else {
      this.start();
    }
  },

  pause(options = {}) {
    if (!speechEngine.playing) return;
    voiceState.speechClock.pause(performance.now());
    speechEngine.pause();
    voiceState.autoPausedReason = options.reason || '';
    this.syncAllUI();
  },

  async resume() {
    if (!speechEngine.paused) return;
    const sessionId = voiceState.sessionId;
    const signal = voiceState.sessionAbortController?.signal;
    if (signal?.aborted || sessionId !== voiceState.sessionId || !speechEngine.paused) return;
    const waitsForRestart = Number.isFinite(speechEngine.pendingRestartOffset);
    if (!waitsForRestart) voiceState.speechClock.resume(performance.now());
    speechEngine.resume();
    voiceState.autoPausedReason = '';
    this.syncAllUI();
  },

  stop(options = {}) {
    voiceState.sessionAbortController?.abort();
    voiceState.sessionAbortController = null;
    window.clearTimeout(voiceState.layoutRefreshTimer);
    window.clearTimeout(voiceState.manualResumeTimer);
    window.clearTimeout(voiceState.settingResumeTimer);
    scrollFollower.stop();
    speechEngine.stop();
    this.stopChapterWatcher();
    this.clearChapterWaitTimer();
    voiceState.chapterUid = '';
    voiceState.source = '';
    voiceState.rangePolicy = 'dynamic';
    voiceState.waitingForChapter = false;
    voiceState.textLength = 0;
    voiceState.rangeStartIndex = 0;
    voiceState.rangeEndIndex = 0;
    voiceState.rangeTotalLength = 0;
      voiceState.pageStartIndex = 0;
      voiceState.pageEndIndex = 0;
      voiceState.pageIndex = 0;
      voiceState.pageCount = 1;
      voiceState.isLastChapterPage = true;
      voiceState.pageSignature = '';
    voiceState.pageStartY = null;
    voiceState.pageEndY = null;

    voiceState.rangeStartY = null;
    voiceState.rangeEndY = null;
    voiceState.rangeStartScrollTop = null;
    voiceState.locatePending = false;
    voiceState.sessionId += 1;
    voiceState.boundarySupported = null;
    voiceState.cpsSamples = [];
    voiceState.calibratedCps = pace.CHARS_PER_SECOND_AT_1X;
    voiceState.scrollAnchors = [];
    voiceState.anchorMeasuring = false;
    voiceState.anchorSourceCache = { node: null, textLength: 0 };
    voiceState.chapterText = '';
    voiceState.timelineChunks = [];
    voiceState.layoutMap = null;
    voiceState.layoutMode = 'ratio';
    voiceState.layoutResizeObserver?.disconnect();
    voiceState.layoutResizeObserver = null;
    voiceState.speechClock.reset();
    voiceState.realigning = false;
    voiceState.autoPausedReason = '';
    voiceState.visibilityShouldResume = false;
    voiceState.manualPointerActive = false;
    voiceState.loading = false;
    if (options.hideBar !== false) {
      this.hideQuickBar();
    }
    this.syncAllUI();
    if (!options.silent) {
      utils.notificationManager.show('语音阅读已停止');
    }
  },

  /**
   * 当前连续朗读进度。boundary 只更新时钟观测，页面位置不会在事件到达时直接跳变。
   */
  getReadingProgress() {
    this.collectCpsSamples();
    this.isBoundaryActive();
    voiceState.speechClock.setRate(ttsSettings.rate);
    voiceState.speechClock.setFallbackCps(this.getEffectiveCps());
    return voiceState.speechClock.getProgress(performance.now());
  },

  /** L1 是否生效：首块 2.5s 内收到过 boundary 事件则确认支持，否则永久降级到 L2 */
  isBoundaryActive() {
    if (voiceState.boundarySupported === false) return false;
    if (voiceState.boundarySupported === true) return true;

    if (voiceState.speechClock.boundarySeen || speechEngine.boundarySeen) {
      voiceState.boundarySupported = true;
      this.debugLog('音色支持 boundary 事件，启用精确进度');
      return true;
    }
    if (speechEngine.playing && !speechEngine.paused && speechEngine.chunkStartTime > 0) {
      const elapsed = (performance.now() - speechEngine.chunkStartTime) / 1000;
      if (elapsed > 2.5) {
        voiceState.boundarySupported = false;
        this.debugLog('音色不支持 boundary 事件，降级为自适应语速校准');
        utils.notificationManager.show('当前音色无语音边界，已使用自适应同步');
        return false;
      }
    }
    return false; // 尚未判定：先用估算兜底
  },

  /** 当前有效的 1x 字/秒（L2 校准值，未校准时用 pace 默认常量） */
  getEffectiveCps() {
    return voiceState.calibratedCps || pace.CHARS_PER_SECOND_AT_1X;
  },

  getCpsProfileId() {
    const browser = navigator.userAgentData?.brands?.map((item) => item.brand).join(',') || navigator.userAgent || 'browser';
    return [ttsSettings.voiceURI || 'default', ttsSettings.rate, browser].join('|');
  },

  loadCpsProfile() {
    const profiles = GM_getValue(CPS_PROFILES_KEY, {});
    const value = profiles && typeof profiles === 'object' ? Number(profiles[this.getCpsProfileId()]) : NaN;
    return Number.isFinite(value) && value > 0 && value <= 30
      ? value
      : pace.CHARS_PER_SECOND_AT_1X;
  },

  hasCpsProfile() {
    const profiles = GM_getValue(CPS_PROFILES_KEY, {});
    const value = profiles && typeof profiles === 'object' ? Number(profiles[this.getCpsProfileId()]) : NaN;
    return Number.isFinite(value) && value > 0 && value <= 30;
  },

  /**
   * 首块没有历史语速模型时，用一段 40 字左右的静音样本实测当前音色/语速的真实 CPS。
   * 静音样本也会顺带探测当前音色是否支持 boundary 事件（L1/L2 判定提前到正式朗读前）。
   */
  calibrateSpeechRate(signal) {
    if (!speechEngine.available) return Promise.resolve(null);
    const utterance = new SpeechSynthesisUtterance(CPS_PROBE_TEXT);
    utterance.rate = ttsSettings.rate;
    utterance.pitch = 1;
    utterance.volume = 0;
    const voice = speechEngine.getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'zh-CN';
    }

    return new Promise((resolve) => {
      let startedAt = 0;
      let sawBoundary = false;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => {
        try { window.speechSynthesis.cancel(); } catch (error) { /* 忽略 */ }
        finish(null);
      }, CPS_PROBE_TIMEOUT_MS);

      utterance.onstart = () => {
        startedAt = performance.now();
      };
      utterance.onboundary = () => {
        sawBoundary = true;
      };
      utterance.onend = () => {
        if (signal?.aborted) {
          finish(null);
          return;
        }
        const ms = Math.max(1, performance.now() - startedAt);
        // onstart 必须已经触发且样本时长合理，否则校准不可信。
        if (!startedAt || ms < 300 || ms > CPS_PROBE_TIMEOUT_MS) {
          finish(null);
          return;
        }
        const cpsAt1x = (CPS_PROBE_TEXT.length / (ms / 1000)) / Math.max(0.1, ttsSettings.rate);
        finish({
          ms,
          cpsAt1x: Math.min(30, Math.max(0.5, cpsAt1x)),
          sawBoundary
        });
      };
      utterance.onerror = () => {
        finish(null);
      };
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        finish(null);
      }
    });
  },

  saveCpsProfile(value) {
    if (!Number.isFinite(value) || value <= 0 || value > 30) return;
    const stored = GM_getValue(CPS_PROFILES_KEY, {});
    const profiles = stored && typeof stored === 'object' ? { ...stored } : {};
    profiles[this.getCpsProfileId()] = Number(value.toFixed(3));
    const entries = Object.entries(profiles);
    if (entries.length > 40) {
      for (const [key] of entries.slice(0, entries.length - 40)) delete profiles[key];
    }
    GM_setValue(CPS_PROFILES_KEY, profiles);
  },

  /** 消费已完成 chunk 的真实耗时，反推该音色在当前语速下的 1x 字/秒。 */
  collectCpsSamples() {
    const timings = speechEngine.chunkTimings || [];
    if (!timings.length) return;

    // 一次性消费，避免每 20ms tick 重复处理
    speechEngine.chunkTimings = [];
    for (const timing of timings) {
      // 过滤异常样本：过短（<200ms）或空块
      if (!timing || timing.ms < 200 || timing.chars <= 0) continue;
      const seconds = timing.ms / 1000;
      const cpsAt1x = (timing.chars / seconds) / Math.max(0.1, timing.rate || 1);
      if (!Number.isFinite(cpsAt1x) || cpsAt1x <= 0 || cpsAt1x > 30) continue;
      voiceState.cpsSamples.push(cpsAt1x);
      if (voiceState.cpsSamples.length > 8) voiceState.cpsSamples.shift();
    }

    if (voiceState.cpsSamples.length) {
      const sorted = [...voiceState.cpsSamples].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      voiceState.calibratedCps = sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
      voiceState.speechClock.setFallbackCps(voiceState.calibratedCps);
      this.saveCpsProfile(voiceState.calibratedCps);
      this.debugLog('校准 cps@1x=' + voiceState.calibratedCps.toFixed(2) + ' (样本 ' + voiceState.cpsSamples.length + ')');
    }
  },

  /** chunk 边界用预渲染 DOM 实测当前位置，更新 L3 锚点表 */
  scheduleAnchorMeasurement(index) {
    if (!voiceState.textLength) return;
    if (voiceState.layoutMap) return;
    if (voiceState.anchorMeasuring) return;

    const chunks = voiceState.timelineChunks || [];
    if (!chunks.length) return;
    const charOffset = chunks[index]?.startOffset;
    if (!Number.isFinite(charOffset) || charOffset <= voiceState.rangeStartIndex) return;

    // 与已有锚点过近则跳过（如 rate 变化重启当前块触发的重复 onChunkStart）
    if (voiceState.scrollAnchors.some((anchor) => Math.abs(anchor.charOffset - charOffset) < 100)) return;

    // 只使用现成 DOM，绝不触发预渲染渲染（避免朗读中闪烁）
    const root = extractor.peekPreRenderDom?.();
    if (!root) return;
    // 同源校验：缓存 DOM 文本量级须与当前朗读正文一致，避免用旧章节 DOM 校准。
    // innerText 读取会强制重排，按节点缓存结果，避免每块边界都重复计算造成卡顿
    const cache = voiceState.anchorSourceCache;
    if (!cache || cache.node !== root) {
      const rootText = chunker.normalizeText(root.innerText || root.textContent || '');
      voiceState.anchorSourceCache = { node: root, textLength: rootText.length };
    }
    const total = voiceState.chapterText.length || 0;
    if (!total || Math.abs(voiceState.anchorSourceCache.textLength - total) > Math.max(200, total * 0.2)) return;

    voiceState.anchorMeasuring = true;
    const sessionId = voiceState.sessionId;
    Promise.race([
      extractor.locateTextOffset(charOffset, null, 0, { probe: false }),
      new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
    ]).then((loc) => {
      voiceState.anchorMeasuring = false;
      if (sessionId !== voiceState.sessionId) return; // 章节/会话已切换，丢弃过期结果
      if (!loc || !Number.isFinite(loc.y)) return;
      this.addScrollAnchor(charOffset, loc.y);
    });
  },

  /** 插入/更新锚点：err = DOM 实测 y - 线性映射 y（按 charOffset 升序，上限 8 个） */
  addScrollAnchor(charOffset, measuredY) {
    const distance = this.getScrollDistance();
    const linearY = this.linearMapY(charOffset, distance);
    const measuredTop = measuredY - this.getViewportFocusY();
    const err = measuredTop - linearY;
    this.debugLog('锚点 offset=' + charOffset + ' linearY=' + Math.round(linearY) + ' measuredY=' + Math.round(measuredY) + ' err=' + Math.round(err));

    const offset = Math.max(0, Math.round(charOffset));
    const anchors = voiceState.scrollAnchors;
    const pos = anchors.findIndex((a) => a.charOffset >= offset);
    if (pos >= 0 && anchors[pos].charOffset === offset) {
      anchors[pos].err = err; // 更新已有锚点
      return;
    }
    anchors.splice(pos < 0 ? anchors.length : pos, 0, { charOffset: offset, err });
    // 上限裁剪：保留首尾，移除中间相邻最密的锚点
    while (anchors.length > 8) {
      let removeIdx = -1;
      let minGap = Infinity;
      for (let i = 1; i < anchors.length - 1; i += 1) {
        const gap = anchors[i].charOffset - anchors[i - 1].charOffset;
        if (gap < minGap) {
          minGap = gap;
          removeIdx = i;
        }
      }
      if (removeIdx > 0) anchors.splice(removeIdx, 1);
      else break;
    }
  },

  /** 锚点误差插值：区间内线性插值，区间外取最近锚点（恒定修正，无跳变） */
  interpolateAnchorErr(offset) {
    const anchors = voiceState.scrollAnchors;
    if (!anchors.length) return 0;
    if (offset <= anchors[0].charOffset) return anchors[0].err;
    const last = anchors[anchors.length - 1];
    if (offset >= last.charOffset) return last.err;
    for (let i = 1; i < anchors.length; i += 1) {
      const a = anchors[i - 1];
      const b = anchors[i];
      if (offset <= b.charOffset) {
        const span = b.charOffset - a.charOffset;
        if (span <= 0) return b.err;
        return a.err + ((offset - a.charOffset) / span) * (b.err - a.err);
      }
    }
    return last.err;
  },

  /** 线性基线映射：字符偏移 → 当前页内滚动像素。
   *  微信读书每页是独立滚动容器，必须按“当前页边界”映射，
   *  不能再按整章占比映射，否则页首/页尾会被算到页面中点。 */
  linearMapY(offset, distance) {
    const pageStart = voiceState.pageStartIndex || 0;
    const pageEnd = voiceState.pageEndIndex > pageStart
      ? voiceState.pageEndIndex
      : pageStart + Math.max(1, voiceState.textLength || 1);
    const span = Math.max(1, pageEnd - pageStart);
    const t = Math.min(1, Math.max(0, (offset - pageStart) / span));
    return distance * t;
  },

  /** 把页内偏移转成期望的 scrollTop：
   *  普通位置让该行显示在视口中上部（focusY）；
   *  如果已经位于最后一屏，则直接滚动到底部，避免末尾行被顶到屏幕外。
   *  pageStart/pageEnd 可显式传入；未传时使用当前 voiceState 的页边界。 */
  pageOffsetToScrollTop(offset, distance, pageStart = voiceState.pageStartIndex, pageEnd = voiceState.pageEndIndex) {
    const safeStart = Math.max(0, Number(pageStart) || 0);
    const safeEnd = Number(pageEnd) > safeStart ? Number(pageEnd) : safeStart + 1;
    const targetOffset = Number(offset) || 0;

    // 优先用播放前建立的真实行 y 表做页内比例映射，避免线性字符比例在
    // 标题、空行、段间距处把目标行算偏。只有 y 起点/终点有效时才使用。
    const layout = voiceState.layoutMap;
    let fraction = null;
    if (layout?.points?.length) {
      const yStart = getLayoutY(layout, safeStart);
      const yEnd = getLayoutY(layout, safeEnd);
      const yTarget = getLayoutY(layout, targetOffset);
      if (Number.isFinite(yStart) && Number.isFinite(yEnd) && Number.isFinite(yTarget) && yEnd > yStart) {
        fraction = Math.min(1, Math.max(0, (yTarget - yStart) / (yEnd - yStart)));
      }
    }

    if (fraction === null) {
      const span = Math.max(1, safeEnd - safeStart);
      fraction = Math.min(1, Math.max(0, targetOffset - safeStart) / span);
    }

    // 分页阅读的关键：微信读书每页 canvas 只占文档流里的一小段 y（pageStartY..pageEndY），
    // 不能用“整章滚动距离 * 字符比例”换算 scrollTop，否则每页都会滚到全章底部。
    // 有 pageY 范围时，先把比例换算成文档流 y，再减 focusY 得到 scrollTop。
    const pageYStart = Number(voiceState.pageStartY);
    const pageYEnd = Number(voiceState.pageEndY);
    const focusY = this.getViewportFocusY();
    const maxScroll = Math.max(0, distance);

    if (Number.isFinite(pageYStart) && Number.isFinite(pageYEnd) && pageYEnd > pageYStart + 1) {
      const raw = pageYStart + fraction * (pageYEnd - pageYStart);
      return Math.max(0, Math.min(maxScroll, raw - focusY));
    }

    const raw = distance * fraction;
    const viewport = window.innerHeight || document.documentElement?.clientHeight || 800;
    const lastScreenThreshold = Math.max(viewport * 0.5, 120);
    if (raw >= maxScroll - lastScreenThreshold) return maxScroll;
    return Math.max(0, Math.min(maxScroll, raw - focusY));
  },

  /** 当前文档可滚动距离（与 autoRead 口径一致） */
  getScrollDistance() {
    const doc = getScrollRoot();
    return Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
  },

  getViewportFocusY() {
    const viewport = window.innerHeight || document.documentElement.clientHeight || 800;
    // 用户要求正在阅读的文本在屏幕中间展示。
    return Math.max(RANGE_SCROLL_TOP_PADDING, viewport * 0.5);
  },

  mapOffsetToScroll(offset) {
    const distance = this.getScrollDistance();
    const safeOffset = Math.min(
      voiceState.rangeEndIndex || offset,
      Math.max(voiceState.rangeStartIndex || 0, Number(offset) || 0)
    );
    // 目标位置统一按“当前页边界 -> 当前页滚动距离”映射，并按 focusY 定位到行位置。
    // 有 layoutMap 时 pageOffsetToScrollTop 会优先使用真实行 y 比例；
    // 没有时降级为线性字符比例。不再叠加 scrollAnchors 误差。
    const linearTarget = this.pageOffsetToScrollTop(safeOffset, distance);

    // 如果朗读开始前已经用文本层真实坐标对齐过（rangeStartScrollTop），
    // 则以该位置为锚点，后续只按线性增量向下滚动，避免开头被线性映射拉回。
    const anchor = voiceState.rangeStartScrollTop;
    if (Number.isFinite(anchor)) {
      const startLinear = this.pageOffsetToScrollTop(voiceState.rangeStartIndex, distance);
      return Math.min(distance, Math.max(0, anchor + (linearTarget - startLinear)));
    }

    return Math.min(distance, Math.max(0, linearTarget));
  },

  getScrollTarget() {
    if (voiceState.locatePending) {
      const doc = getScrollRoot();
      return window.scrollY || doc.scrollTop || 0;
    }
    const progress = this.getReadingProgress();
    const target = this.mapOffsetToScroll(progress.offset);
    // 实时防跑飞：滚动目标不允许比“已确认语音位置”超前太多。
    // 有 boundary 时 confirmedOffset 会频繁更新，校正灵敏；
    // 无 boundary 时至少保证不会把未读文本快速滚出屏幕。
    const confirmedOffset = voiceState.speechClock.getConfirmedOffset();
    const confirmedTarget = this.mapOffsetToScroll(confirmedOffset);
    // 有 boundary 时 confirmedOffset 更新频繁，把“允许超前”收紧到约 1/4 视口，
    // 防止标点/段落停顿时预测位置把未读文本顶到屏幕上方。
    // 无 boundary 时 confirmed 只在 chunk 边界更新，需要保留足够的前瞻余量。
    let maxAhead;
    if (voiceState.boundarySupported === true) {
      const viewport = window.innerHeight || document.documentElement?.clientHeight || 800;
      maxAhead = Math.max(60, Math.min(viewport * 0.25, 180));
    } else {
      maxAhead = Math.max(150, this.getScrollDistance() * 0.12);
    }
    const safeTarget = target > confirmedTarget + maxAhead ? confirmedTarget + maxAhead : target;
    return safeTarget;
  },

  /**
   * 分页 Canvas 下，pageEndIndex 的 ratio 估算可能严重偏大（把第二页文字也算进第一页），
   * 导致页内 y 比例被压缩、滚动过慢。这里在页首/页底两个位置读取文本层真实字符范围，
   * 用实测范围替代估算范围。
   */
  async calibratePageRangeByTextLayer(chapterText, pageContext, signal) {
    const pageStartY = Number(pageContext?.pageStartY);
    const pageEndY = Number(pageContext?.pageEndY);
    if (!Number.isFinite(pageStartY) || !Number.isFinite(pageEndY) || pageEndY <= pageStartY + 1) return null;
    const doc = getScrollRoot();
    const maxScroll = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
    const previousScroll = window.scrollY || doc.scrollTop || 0;
    const viewport = window.innerHeight || document.documentElement?.clientHeight || 800;
    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    try {
      // 页首测量：把页首 canvas 顶部露出来。
      const topScroll = Math.max(0, Math.min(maxScroll, pageStartY - viewport * 0.35));
      window.scrollTo(0, topScroll);
      await sleep(150);
      const topRange = extractor.getTextLayerRangeAtCurrentScroll(chapterText);
      if (signal?.aborted) return null;

      // 页底测量：让页尾 canvas 底部正好落在视口下边缘附近。
      const bottomScroll = Math.max(0, Math.min(maxScroll, pageEndY - viewport * 0.9));
      window.scrollTo(0, bottomScroll);
      await sleep(150);
      const bottomRange = extractor.getTextLayerRangeAtCurrentScroll(chapterText);
      if (signal?.aborted) return null;

      let pageStartIndex = Number(pageContext?.pageStartIndex) || 0;
      let pageEndIndex = Number(pageContext?.pageEndIndex) || chapterText.length;
      let measured = false;
      if (topRange && Number.isFinite(topRange.start)) {
        pageStartIndex = Math.max(0, topRange.start);
        measured = true;
      }
      if (bottomRange && Number.isFinite(bottomRange.end)) {
        pageEndIndex = Math.max(pageStartIndex + 1, Math.min(chapterText.length, bottomRange.end));
        measured = true;
      }
      if (!measured || pageEndIndex <= pageStartIndex) return null;

      this.debugLog('页边界文本层校准 start=' + pageStartIndex + ' end=' + pageEndIndex
        + ' topY=' + (topRange?.y ?? null) + ' bottomEnd=' + (bottomRange?.end ?? null));
      return { pageStartIndex, pageEndIndex };
    } catch (error) {
      this.debugLog('页边界文本层校准失败', error);
      return null;
    } finally {
      window.scrollTo(0, previousScroll);
    }
  },

  /**
   * 文本层不可用时，用“整章滚动距离 / 当前页 canvas 高度”估算全章总页数，
   * 再按页数均分整章字符。只依赖页面几何，不依赖渲染 canvas 数量
   * （WeRead 只渲染当前附近的两页，rects.length 不能代表全章页数）。
   */
  estimatePageRangeByDocumentHeight(chapterText, pageContext) {
    const pageStartY = Number(pageContext?.pageStartY);
    const pageEndY = Number(pageContext?.pageEndY);
    if (!Number.isFinite(pageStartY) || !Number.isFinite(pageEndY) || pageEndY <= pageStartY + 1) return null;
    const pageHeight = pageEndY - pageStartY;
    const distance = this.getScrollDistance();
    const renderedPages = Math.max(1, Number(pageContext?.pageCount) || 1);
    const estimatedTotalPages = Math.max(renderedPages, Math.round(distance / pageHeight));
    if (estimatedTotalPages <= 1) return null;
    const pageIndex = Math.min(estimatedTotalPages - 1, Math.max(0, Number(pageContext?.pageIndex) || 0));
    const pageLen = Math.max(1, Math.round(chapterText.length / estimatedTotalPages));
    const start = Math.min(chapterText.length, pageLen * pageIndex);
    const end = Math.min(chapterText.length, start + pageLen);
    this.debugLog('按文档高度估算页范围 pages=' + estimatedTotalPages + ' page=' + pageIndex + ' start=' + start + ' end=' + end);
    return { pageStartIndex: start, pageEndIndex: end };
  },

  async prepareLayoutMap(sessionId, signal) {
    const timeout = new Promise((resolve) => window.setTimeout(() => resolve(null), 1200));
    let measured = null;
    try {
      measured = await Promise.race([
        extractor.withPreRenderDom((root) => {
          const layout = buildLayoutMap(
            root,
            voiceState.chapterText,
            voiceState.pageStartIndex,
            voiceState.pageEndIndex
          );
          return layout?.points?.length ? { root, layout } : null;
        }),
        timeout
      ]);
    } catch (error) {
      this.debugLog('布局映射失败，降级到锚点模式', error);
    }
    if (signal?.aborted || sessionId !== voiceState.sessionId) return false;

    const root = measured?.root || null;
    const layout = measured?.layout || null;
    this.observeLayoutRoot(root);
    if (layout?.points?.length) {
      voiceState.layoutMap = layout;
      voiceState.layoutMode = 'lines';
      voiceState.rangeStartY = getLayoutY(layout, voiceState.rangeStartIndex);
      voiceState.rangeEndY = getLayoutY(layout, voiceState.rangeEndIndex);
      voiceState.locatePending = false;
      this.debugLog('布局映射完成，行数=' + layout.points.length);
      return true;
    }

    const locate = (offset) => Promise.race([
      extractor.locateTextOffset(offset, null, 0),
      new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
    ]);
    const startLoc = await locate(voiceState.rangeStartIndex);
    if (signal?.aborted || sessionId !== voiceState.sessionId) return false;
    const endLoc = await locate(Math.max(voiceState.rangeStartIndex, voiceState.rangeEndIndex - 1));
    if (signal?.aborted || sessionId !== voiceState.sessionId) return false;
    if (Number.isFinite(startLoc?.y)) {
      voiceState.rangeStartY = startLoc.y;
      this.addScrollAnchor(voiceState.rangeStartIndex, startLoc.y);
    }
    if (Number.isFinite(endLoc?.y)) {
      voiceState.rangeEndY = endLoc.y;
      this.addScrollAnchor(voiceState.rangeEndIndex, endLoc.y);
    }
    voiceState.layoutMode = Number.isFinite(startLoc?.y) || Number.isFinite(endLoc?.y) ? 'anchors' : 'ratio';
    if (voiceState.layoutMode === 'ratio') {
      utils.notificationManager.show('正文排版坐标不可用，滚动已降级为比例同步');
    }
    voiceState.locatePending = false;
    return false;
  },

  alignToOffset(offset, signal) {
    return scrollFollower.alignTo(this.mapOffsetToScroll(offset), { signal });
  },

  observeLayoutRoot(root) {
    voiceState.layoutResizeObserver?.disconnect();
    voiceState.layoutResizeObserver = null;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let initial = true;
    voiceState.layoutResizeObserver = new ResizeObserver(() => {
      if (initial) {
        initial = false;
        return;
      }
      this.scheduleLayoutRefresh('content-resize');
    });
    voiceState.layoutResizeObserver.observe(root);
  },

  /** 调试输出：生产包已移除 console 输出 */
  debugLog() {},

  /** 剩余朗读时长（秒），供 autoRead 计算语音模式下的翻页等待 */
  getRemainingSeconds() {
    if (!voiceState.textLength) return 0;
    const { charsRead, totalChars } = this.getReadingProgress();
    const remainingChars = Math.max(0, totalChars - charsRead);
    if (remainingChars <= 0) return 0;
    // 用校准后的真实语速估算剩余时长（翻页等待也随之对齐）
    return remainingChars / (this.getEffectiveCps() * ttsSettings.rate);
  },

  /** 是否正在等待下一章（本章已读完、开启续读） */
  isWaitingChapter() {
    return Boolean(voiceState.waitingForChapter);
  },

  /** “从文字”在整章中的占比（比例估算用） */
  getRangeStartFraction() {
    if (voiceState.rangeTotalLength > 0) {
      return Math.min(1, Math.max(0, voiceState.rangeStartIndex / voiceState.rangeTotalLength));
    }
    return 0;
  },

  /** “到文字”在整章中的占比；未指定结束文字时为 1（读到章末） */
  getRangeEndFraction() {
    if (voiceState.rangeEndIndex > 0 && voiceState.rangeTotalLength > 0) {
      return Math.min(1, voiceState.rangeEndIndex / voiceState.rangeTotalLength);
    }
    return 1;
  },

  scheduleLayoutRefresh() {
    // 语音朗读不再自动滚动，窗口/字体变化无需重建布局或重新对齐。
  },

  async realignDuringPlayback() {
    // 语音朗读不再自动滚动，保留空实现避免旧调用链触发滚动。
  },

  handleHardScrollError() {
    // 语音朗读不再自动滚动，没有滚动跟随硬错误需要处理。
  },

  handleManualScroll() {
    // 语音朗读不再自动滚动，用户手动滚动不打断朗读。
  },

  handleVisibilityChange() {
    if (document.hidden) {
      voiceState.visibilityShouldResume = speechEngine.playing && !speechEngine.paused;
      if (voiceState.visibilityShouldResume) this.pause({ reason: 'visibility' });
      return;
    }
    if (voiceState.visibilityShouldResume && speechEngine.paused && voiceState.autoPausedReason === 'visibility') {
      voiceState.visibilityShouldResume = false;
      this.resume();
    }
  },

  setRate(rate) {
    const shouldAutoResume = (speechEngine.playing && !speechEngine.paused) || voiceState.autoPausedReason === 'setting-change';
    if (speechEngine.playing && !speechEngine.paused) this.pause({ reason: 'setting-change' });
    ttsSettings.rate = pace.clampRate(rate);
    ttsSettings.save();
    pace.applyRate(ttsSettings.rate);
    voiceState.cpsSamples = [];
    voiceState.calibratedCps = this.loadCpsProfile();
    voiceState.speechClock.setRate(ttsSettings.rate);
    voiceState.speechClock.setFallbackCps(voiceState.calibratedCps);
    const resumeOffset = voiceState.speechClock.getConfirmedOffset();
    voiceState.speechClock.resetObservations(resumeOffset, performance.now());
    speechEngine.applyRate(ttsSettings.rate, resumeOffset);
    window.clearTimeout(voiceState.settingResumeTimer);
    if (shouldAutoResume) {
      voiceState.settingResumeTimer = window.setTimeout(() => {
        if (speechEngine.paused && voiceState.autoPausedReason === 'setting-change') this.resume();
      }, 250);
    }
    this.syncAllUI();
  },

  setVoice(voiceURI) {
    const shouldAutoResume = (speechEngine.playing && !speechEngine.paused) || voiceState.autoPausedReason === 'setting-change';
    if (speechEngine.playing && !speechEngine.paused) this.pause({ reason: 'setting-change' });
    ttsSettings.voiceURI = voiceURI || '';
    ttsSettings.save();
    // 音色变化：boundary 支持与语速校准全部重新检测
    voiceState.boundarySupported = null;
    voiceState.cpsSamples = [];
    voiceState.calibratedCps = this.loadCpsProfile();
    voiceState.speechClock.boundarySeen = false;
    voiceState.speechClock.setFallbackCps(voiceState.calibratedCps);
    const resumeOffset = voiceState.speechClock.getConfirmedOffset();
    voiceState.speechClock.resetObservations(resumeOffset, performance.now());
    speechEngine.setVoice(ttsSettings.voiceURI, resumeOffset);
    window.clearTimeout(voiceState.settingResumeTimer);
    if (shouldAutoResume) {
      voiceState.settingResumeTimer = window.setTimeout(() => {
        if (speechEngine.paused && voiceState.autoPausedReason === 'setting-change') this.resume();
      }, 250);
    }
    this.syncAllUI();
  },

  setFollow(enabled) {
    const wasWaitingForChapter = voiceState.waitingForChapter;
    ttsSettings.follow = Boolean(enabled);
    ttsSettings.save();
    if (!ttsSettings.follow && wasWaitingForChapter) {
      this.stop({ silent: true });
      utils.notificationManager.show('已关闭章节续读，本次朗读已结束');
      return;
    }
    this.syncAllUI();
  },

  setRange(startText, endText) {
    const wasActive = this.isActive();
    ttsSettings.setRange(startText, endText);
    this.syncRangeInputs();
    utils.notificationManager.show('阅读范围已保存');
    if (wasActive) this.stop({ silent: true });
    // 点击“确定范围”后立即定位并滚动到“从文字”位置，便于朗读前确认起点
    this.jumpToRangeStart();
  },

  clearRange() {
    ttsSettings.clearRange();
    this.syncRangeInputs();
    voiceState.jumpToken += 1; // 使进行中的定位跳转结果失效
    utils.notificationManager.show('阅读范围已清除');
  },

  /**
   * 文本层是虚拟化渲染的，目标行不在当前视口附近时 DOM 里没有对应字符。
   * 这里通过快速滚动扫描整页，直到文本层中出现目标短语，拿到真实 y 坐标。
   */
  async searchTextLayerForPhrase(phrase, text) {
    const normPhrase = chunker.normalizeText(phrase);
    if (!normPhrase) return { loc: null, boundary: null };
    const doc = getScrollRoot();
    const maxScroll = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
    const prevScroll = window.scrollY || doc.scrollTop || 0;
    const step = Math.max(160, Math.round((window.innerHeight || 800) * 0.25));
    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    let result = null;
    let boundary = null;
    const normText = chunker.normalizeText(text || '');
    try {
      for (let y = 0; y <= maxScroll + step; y += step) {
        window.scrollTo(0, Math.min(maxScroll, y));
        await sleep(50);
        const loc = extractor.locateTextOffsetInTextLayer(0, normPhrase);
        if (loc && Number.isFinite(loc.y)) {
          result = loc;
          break;
        }
        if (!boundary && normText) {
          const b = extractor.getFirstTextLayerOffsetAtCurrentScroll(normText);
          if (b && Number.isFinite(b.offset)) {
            boundary = { scroll: Math.min(maxScroll, y), offset: b.offset };
          }
        }
      }
    } catch (error) {
      this.debugLog('文本层扫描定位失败', error);
    }

    if (!result) {
      window.scrollTo(0, prevScroll);
    }
    return { loc: result, boundary };
  },

  /**
   * 立即定位并滚动到“从文字”所在位置（不依赖朗读启动）。
   * 优先级：文本层实测定位 → 整页扫描 → 页内比例估算。
   * 用 jumpToken 丢弃过期结果，防止快速连点/清除时旧结果覆盖新结果。
   */
  async jumpToRangeStart() {
    const startText = String(ttsSettings.rangeStart || '').trim();
    if (!startText) return; // 未填写“从文字”：保存即可，无需定位

    voiceState.jumpToken += 1;
    const token = voiceState.jumpToken;

    let text = '';
    try {
      const result = await extractor.extractCurrentChapterText();
      text = result.text;
    } catch (error) {
      text = '';
    }
    if (token !== voiceState.jumpToken) return;

    if (!chunker.isPlausibleText(text)) {
      utils.notificationManager.show('未找到章节正文，无法定位');
      return;
    }

    const rangeResult = chunker.applyRange(text, startText, String(ttsSettings.rangeEnd || ''));
    if (rangeResult.warning === 'start-not-found') {
      utils.notificationManager.show('未找到开始文字，无法定位');
      return;
    }
    // 边界：开始文字恰好在章首（startIndex === 0），直接回到顶部即可
    if (rangeResult.startIndex <= 0) {
      await scrollFollower.alignTo(0);
      utils.notificationManager.show('已定位到开始文字');
      return;
    }

    const startIndex = rangeResult.startIndex;
    const totalLength = rangeResult.totalLength || 0;

    // 先记录“点击时”的页面上下文；后续扫描会滚动页面，不能等扫描完再取，
    // 否则会拿到扫描中途的文本层窗口，导致页边界错误。
    const initialPageContext = await extractor.extractCurrentPageContext({
      text: chunker.normalizeText(text),
      chapterUid: extractor.getCurrentChapterUid(),
      probe: false
    });
    if (token !== voiceState.jumpToken) return;

    // 只信任“当前文本层”里的真实坐标；pre-render/隐藏 DOM 的绝对 y
    // 在分页滚动模型下不可靠，会让中间文字被定位到页顶/页底。
    const layerLocated = await Promise.race([
      extractor.locateTextOffsetInTextLayer(startIndex, startText),
      new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
    ]);
    if (token !== voiceState.jumpToken) return;

    if (layerLocated && Number.isFinite(layerLocated.y)) {
      await scrollFollower.alignTo(Math.max(0, layerLocated.y - this.getViewportFocusY()));
      utils.notificationManager.show('已定位到开始文字');
      return;
    }

    // 文本层是虚拟化渲染，目标行可能不在当前 DOM 中；先整页扫描一次。
    const searched = await this.searchTextLayerForPhrase(startText, text);
    if (token !== voiceState.jumpToken) return;
    if (searched?.loc && Number.isFinite(searched.loc.y)) {
      await scrollFollower.alignTo(Math.max(0, searched.loc.y - this.getViewportFocusY()));
      utils.notificationManager.show('已定位到开始文字');
      return;
    }

    // 降级：优先按“当前页”边界估算，避免把整章长度都算到第一页。
    // 使用点击时记录的 initialPageContext，避免扫描后页面上下文漂移。
    const pageContext = initialPageContext;

      let pageStartIndex = Number(pageContext?.pageStartIndex) || 0;
      let pageEndIndex = Number(pageContext?.pageEndIndex) || totalLength || 0;
      const pageCount = Math.max(1, Number(pageContext?.pageCount) || 1);
      const doc = document.scrollingElement || document.documentElement;
      const distance = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));

      // 目标在 Canvas 区域、文本层扫描不到时，用“隐藏排版 DOM + 文本层起点”做混合映射：
      // Canvas 区域 [pageStart, textLayerStartOffset] 对应滚动 [0, textLayerStartScroll]。
      if (startIndex >= pageStartIndex && startIndex < pageEndIndex) {
        // 只使用扫描过程中已记录的 boundary，不再二次整页扫描，避免 Chrome 下多次上下滚动。
        const boundary = searched?.boundary;
        if (boundary && startIndex < boundary.offset) {
          const layoutMeasured = await extractor.withPreRenderDom((root) => {
            const layout = buildLayoutMap(root, text, 0, text.length);
            return layout?.points?.length ? { layout } : null;
          }, { probe: false });
          if (layoutMeasured?.layout) {
            const yStart = getLayoutY(layoutMeasured.layout, pageStartIndex);
            const yBoundary = getLayoutY(layoutMeasured.layout, boundary.offset);
            const yTarget = getLayoutY(layoutMeasured.layout, startIndex);
            if (Number.isFinite(yStart) && Number.isFinite(yBoundary) && Number.isFinite(yTarget) && yBoundary > yStart) {
              const fraction = Math.min(1, Math.max(0, (yTarget - yStart) / (yBoundary - yStart)));
              const target = Math.max(0, Math.min(distance, boundary.scroll * fraction));
              window.scrollTo(0, target);
              utils.notificationManager.show('已定位到开始文字附近');
              return;
            }
          }
        }
      }

      // 纯 Canvas 页（没有文本层 boundary）时，用隐藏排版 DOM 在页内做比例定位。
      if (startIndex >= pageStartIndex && startIndex < pageEndIndex) {
        const layoutMeasured = await extractor.withPreRenderDom((root) => {
          const layout = buildLayoutMap(root, text, 0, text.length);
          return layout?.points?.length ? { layout } : null;
        }, { probe: false });
        if (layoutMeasured?.layout) {
          const yStart = getLayoutY(layoutMeasured.layout, pageStartIndex);
          const yEnd = getLayoutY(layoutMeasured.layout, pageEndIndex);
          const yTarget = getLayoutY(layoutMeasured.layout, startIndex);
          if (Number.isFinite(yStart) && Number.isFinite(yEnd) && Number.isFinite(yTarget) && yEnd > yStart) {
            const fraction = Math.min(1, Math.max(0, (yTarget - yStart) / (yEnd - yStart)));
            const pageYStart = Number(pageContext?.pageStartY);
            const pageYEnd = Number(pageContext?.pageEndY);
            let raw;
            if (Number.isFinite(pageYStart) && Number.isFinite(pageYEnd) && pageYEnd > pageYStart + 1) {
              raw = pageYStart + fraction * (pageYEnd - pageYStart);
            } else {
              raw = distance * fraction;
            }
            const target = Math.max(0, Math.min(distance, raw - this.getViewportFocusY()));
            window.scrollTo(0, target);
            utils.notificationManager.show('已定位到开始文字附近');
            return;
          }
        }
      }

      // 首次进入新章节时可能还没有第一页页尾缓存，文本层又不在目标行附近，
      // 导致 startIndex 落在当前可见窗口之外而被夹到页顶/页底。
      // 这里临时滚动到页尾探测真实页尾；如果目标还在下一页，则趁在页尾时直接翻页。
      const needPageEndProbe = Boolean(
        !pageContext?.isLastChapterPage &&
        pageCount > 1 &&
        (startIndex < pageStartIndex || startIndex >= pageEndIndex)
      );
      if (needPageEndProbe) {
        const prevScroll = window.scrollY || doc.scrollTop || 0;
        await scrollFollower.alignTo(distance);
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        if (token !== voiceState.jumpToken) return;
        const bottomCtx = await extractor.extractCurrentPageContext({
          text: chunker.normalizeText(text),
          chapterUid: extractor.getCurrentChapterUid(),
          probe: false
        });
        if (bottomCtx && Number(bottomCtx.pageEndIndex) > pageEndIndex) {
          pageStartIndex = 0;
          pageEndIndex = Number(bottomCtx.pageEndIndex) || pageEndIndex;
        }

        // 目标在当前页之后且当前页不是末页：在页尾触发翻页，然后递归重新定位。
        if (startIndex >= pageEndIndex && pageCount > 1 && !pageContext?.isLastChapterPage) {
          moduleRegistry.autoPageTurn?.trigger();
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
          if (token !== voiceState.jumpToken) return;
          const nextCtx = await extractor.extractCurrentPageContext({
            text: chunker.normalizeText(text),
            chapterUid: extractor.getCurrentChapterUid(),
            probe: false
          });
          if (nextCtx && Number(nextCtx.pageEndIndex) > pageEndIndex) {
            // 翻页成功，递归重新定位（新页面会重新探测/计算）。
            return this.jumpToRangeStart();
          }
        }

        await scrollFollower.alignTo(prevScroll);
        if (token !== voiceState.jumpToken) return;
      }

      // 页内线性映射：普通位置定位到视口中上部，最后一屏直接滚动到底。
      // 不要使用 canvas 的 pageStartY/pageEndY，它们在分页滚动模型里不代表正文 y。
      const target = this.pageOffsetToScrollTop(startIndex, distance, pageStartIndex, pageEndIndex);
      await scrollFollower.alignTo(target);
      utils.notificationManager.show('已定位到开始文字附近');
  },

  refreshVoices() {
    if (!speechEngine.available) return;

    const voices = speechEngine.getVoices();
    const chineseVoices = voices.filter((voice) =>
      (voice.lang || '').toLowerCase().startsWith('zh')
    );
    const usableVoices = chineseVoices.length ? chineseVoices : voices;
    const select = document.getElementById('ttsVoiceSelect');
    if (!select) return;

    const current = select.value || ttsSettings.voiceURI;
    select.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '系统默认音色';
    select.appendChild(defaultOption);

    usableVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = voice.name + ' (' + voice.lang + ')';
      select.appendChild(option);
    });

    select.value = current;
  },

  syncAllUI() {
    this.syncPlaybackUI();
    this.syncRateUI();
    this.syncVoiceSelect();
    this.syncFollowUI();
  },

  syncPlaybackUI() {
    const toggle = document.getElementById('ttsToggleBtn');
    if (toggle) {
      if (speechEngine.paused) {
        toggle.textContent = '继续';
      } else if (speechEngine.playing) {
        toggle.textContent = '暂停';
      } else {
        toggle.textContent = '朗读';
      }
    }

    setButtonDisabled(
      'ttsStopBtn',
      !speechEngine.playing && !speechEngine.paused && !voiceState.waitingForChapter && !voiceState.loading
    );
    setButtonDisabled('ttsRetryBtn', voiceState.loading);

    const quickToggle = document.getElementById('wr-voice-quick-toggle');
    if (quickToggle) {
      quickToggle.textContent = speechEngine.paused ? '继续' : speechEngine.playing ? '暂停' : '朗读';
    }

    const status = document.getElementById('wr-voice-quick-status');
    if (status) {
      if (voiceState.waitingForChapter) {
        status.textContent = '等待下一章';
      } else {
        status.textContent = speechEngine.chunks.length
          ? Math.min(speechEngine.index + 1, speechEngine.chunks.length) + '/' + speechEngine.chunks.length
          : '就绪';
      }
    }
  },

  syncRateUI() {
    const slider = document.getElementById('ttsRateSlider');
    if (slider && document.activeElement !== slider) {
      slider.value = String(ttsSettings.rate);
    }
    const value = document.getElementById('ttsRateValue');
    if (value) value.textContent = ttsSettings.rate.toFixed(1) + 'x';
  },

  syncVoiceSelect() {
    const select = document.getElementById('ttsVoiceSelect');
    if (select && document.activeElement !== select) {
      select.value = ttsSettings.voiceURI;
    }
  },

  syncFollowUI() {
    const checkbox = document.getElementById('ttsFollowCheckbox');
    if (checkbox && document.activeElement !== checkbox) {
      checkbox.checked = ttsSettings.follow;
    }
  },

  syncRangeInputs() {
    const startInput = document.getElementById('ttsRangeStart');
    if (startInput && document.activeElement !== startInput) {
      startInput.value = ttsSettings.rangeStart;
    }
    const endInput = document.getElementById('ttsRangeEnd');
    if (endInput && document.activeElement !== endInput) {
      endInput.value = ttsSettings.rangeEnd;
    }
  },

  buildQuickBar() {
    if (document.getElementById(QUICK_BAR_ID)) return;

    const bar = document.createElement('div');
    bar.id = QUICK_BAR_ID;
    bar.className = 'voice-quick';
    bar.style.display = 'none';
    bar.innerHTML = [
      '<button type="button" id="wr-voice-quick-toggle">朗读</button>',
      '<button type="button" id="wr-voice-quick-stop">停止</button>',
      '<span class="voice-quick-status" id="wr-voice-quick-status">就绪</span>'
    ].join('');
    document.body.appendChild(bar);

    quickBarController = initQuickBarDrag(bar);
    $('#' + QUICK_BAR_ID + ' #wr-voice-quick-toggle').on('click', () => this.toggle());
    $('#' + QUICK_BAR_ID + ' #wr-voice-quick-stop').on('click', () => this.stop());
  },

  bindControlEvents() {
    $(document).on('click', '#ttsToggleBtn', () => this.toggle());
    $(document).on('click', '#ttsStopBtn', () => this.stop());
    $(document).on('click', '#ttsRetryBtn', () => {
      if (speechEngine.playing || speechEngine.paused) {
        this.stop({ silent: true });
      }
      this.start();
    });
    $(document).on('input', '#ttsRateSlider', function handleRateInput() {
      const rate = pace.clampRate(parseFloat($(this).val()));
      $(this).val(rate);
      voiceRead.setRate(rate);
    });
    $(document).on('change', '#ttsVoiceSelect', function handleVoiceChange() {
      voiceRead.setVoice($(this).val());
    });
    $(document).on('change', '#ttsFollowCheckbox', function handleFollowChange() {
      voiceRead.setFollow($(this).is(':checked'));
    });
    $(document).on('click', '#ttsRangeApply', () => {
      this.setRange($('#ttsRangeStart').val(), $('#ttsRangeEnd').val());
    });
    $(document).on('click', '#ttsRangeClear', () => this.clearRange());
  },

  showQuickBar() {
    const bar = document.getElementById(QUICK_BAR_ID);
    if (bar) {
      bar.style.display = 'flex';
      // 清理旧版本拖拽吸附遗留的边缘隐藏状态。
      quickBarController?.reset();
    }
  },

  hideQuickBar() {
    const bar = document.getElementById(QUICK_BAR_ID);
    if (bar) bar.style.display = 'none';
  },

  startChapterWatcher() {
    if (voiceState.chapterWatcher) return;
    voiceState.chapterWatcher = window.setInterval(() => {
      if (!speechEngine.playing && !speechEngine.paused && !voiceState.waitingForChapter) return;
      const uid = extractor.getCurrentChapterUid({ refresh: voiceState.waitingForChapter });
      if (!uid || !voiceState.chapterUid || uid === voiceState.chapterUid) return;

      if (ttsSettings.follow) {
        utils.notificationManager.show('章节已切换，继续朗读');
        speechEngine.stop();
        this.loadAndSpeak({
          continuation: true,
          expectedChapterUid: uid,
          rejectText: voiceState.chapterText
        });
      } else {
        utils.notificationManager.show('章节已切换，已停止朗读');
        this.stop({ silent: true });
      }
    }, 700);
  },

  stopChapterWatcher() {
    if (voiceState.chapterWatcher) {
      window.clearInterval(voiceState.chapterWatcher);
      voiceState.chapterWatcher = null;
    }
  },

  clearChapterWaitTimer() {
    if (!voiceState.chapterWaitTimer) return;
    window.clearTimeout(voiceState.chapterWaitTimer);
    voiceState.chapterWaitTimer = null;
  },

  startChapterWaitTimer(sessionId) {
    this.clearChapterWaitTimer();
    voiceState.chapterWaitTimer = window.setTimeout(() => {
      voiceState.chapterWaitTimer = null;
      if (sessionId !== voiceState.sessionId || !voiceState.waitingForChapter) return;
      this.stop({ silent: true });
      utils.notificationManager.show('未检测到下一章，连续朗读已结束');
    }, CHAPTER_WAIT_TIMEOUT_MS);
  },

  async handleFinish() {
    const sessionId = voiceState.sessionId;
    if (sessionId !== voiceState.sessionId) return;

    if (voiceState.rangePolicy !== 'explicit' && ttsSettings.follow) {
        if (voiceState.pageCount > 1 && !voiceState.isLastChapterPage) {
          await this.continueToNextChapterPage(sessionId);
          return;
        }
      voiceState.waitingForChapter = true;
      utils.notificationManager.show('本章朗读完成，等待下一章');
      this.syncAllUI();
      this.startChapterWaitTimer(sessionId);
      moduleRegistry.autoPageTurn?.trigger();
      return;
    }

    const message = voiceState.rangePolicy === 'explicit' ? '指定范围朗读完成' : '本章朗读完成';
    utils.notificationManager.show(message);
    this.stop({ silent: true });
  },

    async continueToNextChapterPage(sessionId) {
      const oldPageSignature = voiceState.pageSignature;
      moduleRegistry.autoPageTurn?.trigger();

      const startedAt = performance.now();
      const waitPageTurn = () => new Promise((resolve) => {
        const check = () => {
          if (sessionId !== voiceState.sessionId) {
            resolve(false);
            return;
          }
          const signature = extractor.getCurrentPageSignature();
          if (signature && signature !== oldPageSignature) {
            resolve(true);
            return;
          }
          if (performance.now() - startedAt > 4000) {
            resolve(false);
            return;
          }
          window.setTimeout(check, 80);
        };
        check();
      });
      const pageTurned = await waitPageTurn();
      if (sessionId !== voiceState.sessionId) return;

      if (!pageTurned) {
        utils.notificationManager.show('未检测到下一页，连续朗读已结束');
        this.stop({ silent: true });
        return;
      }

      await this.loadAndSpeak({
        continuation: true,
        sameChapterPage: true,
        expectedChapterUid: voiceState.chapterUid,
        rejectText: '',
        previousRangeEndIndex: voiceState.rangeEndIndex
      });
    }

};
