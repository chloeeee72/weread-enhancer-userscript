const DEFAULT_HANDLERS = {
  onStateChange() {},
  onChunkStart() {},
  onBoundary() {},
  onChunkEnd() {},
  onFinish() {},
  onError() {}
};

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function normalizeChunk(chunk, fallbackStart = 0) {
  if (typeof chunk === 'string') {
    return { text: chunk, startOffset: fallbackStart, endOffset: fallbackStart + chunk.length };
  }
  const text = String(chunk?.text || '');
  const startOffset = Number.isFinite(chunk?.startOffset) ? chunk.startOffset : fallbackStart;
  const endOffset = Number.isFinite(chunk?.endOffset) ? chunk.endOffset : startOffset + text.length;
  return { ...chunk, text, startOffset, endOffset };
}

export const speechEngine = {
  available: typeof window !== 'undefined' && 'speechSynthesis' in window,
  chunks: [],
  index: 0,
  rate: 1,
  voiceURI: '',
  utterance: null,
  /** 当前 chunk 开始朗读的时间戳，用于估算块内朗读进度以对齐滚动 */
  chunkStartTime: 0,
  /** 暂停时刻，恢复时用来扣除暂停占用的时间，避免进度估算跳变 */
  pausedAt: 0,
  /** 当前 chunk 内累计的暂停时长（ms），计算真实朗读耗时与进度时扣除 */
  pausedTotalMs: 0,
  /** 当前 chunk 最近一次 boundary 事件报告的字符位置（无事件为 -1） */
  boundaryCharIndex: -1,
  /** 本会话是否收到过 boundary 事件（用于检测音色是否支持词边界） */
  boundarySeen: false,
  /** 已完成 chunk 的真实耗时记录 [{ chars, ms, rate }]，供自适应语速校准 */
  chunkTimings: [],
  stopped: true,
  paused: false,
  playing: false,
  restarting: false,
  pendingRestartOffset: null,
  errorRetryCount: 0,
  handlers: DEFAULT_HANDLERS,

  setHandlers(handlers) {
    Object.assign(this.handlers, handlers);
  },

  getChunk(index) {
    let fallbackStart = 0;
    for (let i = 0; i < index; i += 1) {
      const item = normalizeChunk(this.chunks[i], fallbackStart);
      fallbackStart = item.endOffset;
    }
    return normalizeChunk(this.chunks[index], fallbackStart);
  },

  getVoices() {
    if (!this.available) return [];
    return window.speechSynthesis.getVoices() || [];
  },

  getSelectedVoice() {
    const voices = this.getVoices();
    return voices.find((voice) => voice.voiceURI === this.voiceURI) || null;
  },

  speak(chunks, rate, voiceURI) {
    if (!this.available) return false;
    this.chunks = chunks || [];
    this.rate = rate;
    this.voiceURI = voiceURI || '';
    this.index = 0;
    this.stopped = false;
    this.paused = false;
    this.restarting = false;
    this.pendingRestartOffset = null;
    this.chunkStartTime = 0;
    this.pausedAt = 0;
    this.pausedTotalMs = 0;
    this.boundaryCharIndex = -1;
    this.boundarySeen = false;
    this.chunkTimings = [];
    this.cancelCurrent();
    window.setTimeout(() => this.speakChunk(0), 120);
    this.handlers.onStateChange();
    return true;
  },

  cancelCurrent() {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      // 忽略取消旧朗读时的错误
    }
  },

  speakChunk(index) {
    if (this.stopped) return;
    if (index >= this.chunks.length) {
      this.finish();
      return;
    }

    this.errorRetryCount = 0;
    const chunk = this.getChunk(index);
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voice = this.getSelectedVoice();

    utterance.rate = this.rate;
    utterance.pitch = 1;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'zh-CN';
    }

    this.boundaryCharIndex = -1;
    this.pausedTotalMs = 0;

    utterance.onstart = () => {
      if (this.stopped || this.restarting) return;
      this.chunkStartTime = now();
      this.playing = true;
      this.paused = false;
      this.index = index;
      this.handlers.onChunkStart(index, { at: this.chunkStartTime, chunk });
      this.handlers.onStateChange();
    };

    utterance.onboundary = (event) => {
      if (this.stopped || this.restarting || this.paused) return;
      const rawIndex = event && Number.isFinite(event.charIndex) ? event.charIndex : -1;
      const chunkText = chunk.text;
      // 防御：越界或非单调（回退）的 charIndex 一律丢弃
      if (rawIndex < 0 || rawIndex > chunkText.length) return;
      if (rawIndex < this.boundaryCharIndex) return;
      const receivedAt = now();
      const elapsedSeconds = Number(event?.elapsedTime);
      const observedAt = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0
        ? Math.min(receivedAt, this.chunkStartTime + elapsedSeconds * 1000)
        : receivedAt;
      this.boundaryCharIndex = rawIndex;
      this.boundarySeen = true;
      this.handlers.onBoundary(index, {
        at: observedAt,
        charIndex: rawIndex,
        globalOffset: chunk.startOffset + rawIndex,
        chunk,
        name: event?.name || ''
      });
    };

    utterance.onend = () => {
      if (this.stopped || this.paused || this.restarting) return;
      // 记录真实耗时（扣除暂停时间），供 L2 自适应语速校准
      const endedAt = now();
      const durationMs = Math.max(1, endedAt - this.chunkStartTime - this.pausedTotalMs);
      const chunkText = chunk.text;
      this.chunkTimings.push({ chars: chunkText.length, ms: durationMs, rate: this.rate });
      if (this.chunkTimings.length > 12) this.chunkTimings.shift();
      this.handlers.onChunkEnd(index, { at: endedAt, durationMs, chunk });
      this.index += 1;
      this.speakChunk(this.index);
    };

    utterance.onerror = (event) => {
      if (event && ['interrupted', 'canceled'].includes(event.error)) return;
      if (event && event.error === 'not-allowed') {
        // 用户手势未就绪：提示用户点击页面，保留快捷条以便重试
        this.handlers.onError('浏览器阻止语音，请先点击页面任意位置后重试', true);
        return;
      }
      // 部分浏览器会偶发一次 synthesis-failed，取消后重试同一块通常能恢复。
      if (this.errorRetryCount < 1) {
        this.errorRetryCount += 1;
        this.cancelCurrent();
        window.setTimeout(() => this.speakChunk(this.index), 150);
        return;
      }
      this.handlers.onError('语音朗读出错，请重试', false);
    };

    this.utterance = utterance;
    this.chunkStartTime = now();
    window.speechSynthesis.speak(utterance);
    this.playing = true;
    this.paused = false;
    this.handlers.onStateChange();
  },

  pause() {
    if (!this.available || !this.playing || this.paused) return;

    if (typeof window.speechSynthesis.pause === 'function') {
      window.speechSynthesis.pause();
      this.paused = true;
      this.pausedAt = now();
      this.handlers.onStateChange();
      return;
    }

    this.paused = true;
    this.pausedAt = now();
    this.cancelCurrent();
    this.handlers.onStateChange();
  },

  resume() {
    if (!this.available || !this.paused) return;

    if (Number.isFinite(this.pendingRestartOffset)) {
      const index = this.index;
      this.trimCurrentChunkTo(this.pendingRestartOffset);
      this.pendingRestartOffset = null;
      this.adjustChunkStartTimeAfterPause();
      this.restarting = true;
      this.paused = false;
      this.cancelCurrent();
      window.setTimeout(() => {
        this.restarting = false;
        this.speakChunk(index);
      }, 120);
      this.handlers.onStateChange();
      return;
    }

    if (typeof window.speechSynthesis.resume === 'function') {
      window.speechSynthesis.resume();
      this.paused = false;
      this.adjustChunkStartTimeAfterPause();
      this.handlers.onStateChange();
      return;
    }

    const index = this.index;
    this.restarting = true;
    this.cancelCurrent();
    window.setTimeout(() => {
      this.restarting = false;
      this.speakChunk(index);
    }, 120);
    this.handlers.onStateChange();
  },

  restartCurrentChunk() {
    if (this.stopped || !this.chunks.length) return;
    const index = this.index;
    this.restarting = true;
    this.cancelCurrent();
    window.setTimeout(() => {
      this.restarting = false;
      this.speakChunk(index);
    }, 120);
  },

  /** 从当前 chunk 的已确认字符位置重启，避免改速/换音色时整块回读。 */
  trimCurrentChunkTo(globalOffset) {
    if (this.stopped || !this.chunks.length) return;
    const chunk = this.getChunk(this.index);
    const safeOffset = Math.min(chunk.endOffset - 1, Math.max(chunk.startOffset, Number(globalOffset) || chunk.startOffset));
    const localOffset = Math.max(0, safeOffset - chunk.startOffset);
    if (localOffset > 0 && localOffset < chunk.text.length) {
      this.chunks[this.index] = {
        ...chunk,
        text: chunk.text.slice(localOffset),
        startOffset: safeOffset
      };
    }
  },

  restartCurrentChunkFrom(globalOffset) {
    this.trimCurrentChunkTo(globalOffset);
    this.restartCurrentChunk();
  },

  applyRate(rate, resumeOffset) {
    this.rate = rate;
    if (this.playing && !this.paused && !this.stopped) {
      if (Number.isFinite(resumeOffset)) this.restartCurrentChunkFrom(resumeOffset);
      else this.restartCurrentChunk();
    } else if (this.paused && !this.stopped) {
      this.pendingRestartOffset = Number.isFinite(resumeOffset) ? resumeOffset : this.getChunk(this.index).startOffset;
    }
    this.handlers.onStateChange();
  },

  setVoice(voiceURI, resumeOffset) {
    this.voiceURI = voiceURI || '';
    if (this.playing && !this.paused && !this.stopped) {
      if (Number.isFinite(resumeOffset)) this.restartCurrentChunkFrom(resumeOffset);
      else this.restartCurrentChunk();
    } else if (this.paused && !this.stopped) {
      this.pendingRestartOffset = Number.isFinite(resumeOffset) ? resumeOffset : this.getChunk(this.index).startOffset;
    }
    this.handlers.onStateChange();
  },

  adjustChunkStartTimeAfterPause() {
    if (this.pausedAt > 0) {
      const pausedMs = now() - this.pausedAt;
      this.pausedTotalMs += pausedMs;
      this.pausedAt = 0;
    }
  },

  stop() {
    this.stopped = true;
    this.paused = false;
    this.playing = false;
    this.chunkStartTime = 0;
    this.pausedAt = 0;
    this.pausedTotalMs = 0;
    this.boundaryCharIndex = -1;
    this.boundarySeen = false;
    this.pendingRestartOffset = null;
    this.chunkTimings = [];
    this.cancelCurrent();
    this.chunks = [];
    this.index = 0;
    this.utterance = null;
    this.handlers.onStateChange();
  },

  finish() {
    this.stopped = true;
    this.paused = false;
    this.playing = false;
    this.handlers.onFinish();
    this.handlers.onStateChange();
  }
};
