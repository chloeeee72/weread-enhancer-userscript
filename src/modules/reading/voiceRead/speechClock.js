const DEFAULT_CPS_AT_1X = 4.5;
const MAX_FRAME_SECONDS = 0.1;
const PHASE_GAIN = 4.5;
const MAX_ACCELERATION = 40;
// 长时间没有 boundary 观测时，认为语音处于标点/段落停顿。
// 过了 grace 之后在 ramp 时间内把预测速度平滑降到 0，避免滚动继续穿过停顿。
const SILENCE_GRACE_MS = 550;
const SILENCE_RAMP_MS = 900;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getChunk(chunks, index) {
  const chunk = chunks[index];
  if (!chunk) return null;
  if (typeof chunk === 'string') {
    let startOffset = 0;
    for (let i = 0; i < index; i += 1) {
      startOffset += String(chunks[i] || '').length;
    }
    return { text: chunk, startOffset, endOffset: startOffset + chunk.length };
  }
  return chunk;
}

/**
 * 将稀疏 boundary 观测变成连续、单调的字符时钟。
 * 新观测只调整速度和相位，不直接改当前位置，避免页面目标跳变。
 */
export class SpeechClock {
  constructor() {
    this.reset();
  }

  reset() {
    this.chunks = [];
    this.rate = 1;
    this.fallbackCps = DEFAULT_CPS_AT_1X;
    this.rangeStart = 0;
    this.rangeEnd = 0;
    this.position = 0;
    this.velocity = 0;
    this.currentIndex = -1;
    this.lastTickAt = 0;
    this.chunkStartedAt = 0;
    this.lastObservation = null;
    this.previousObservation = null;
    this.observedVelocity = null;
    this.confirmedOffset = 0;
    this.boundarySeen = false;
    this.paused = false;
    this.pausedAt = 0;
    this.running = false;
  }

  configure({ chunks, rate, fallbackCps, rangeStart, rangeEnd }) {
    this.reset();
    this.chunks = chunks || [];
    this.rate = Math.max(0.1, Number(rate) || 1);
    this.fallbackCps = Math.max(0.1, Number(fallbackCps) || DEFAULT_CPS_AT_1X);
    const first = getChunk(this.chunks, 0);
    const last = getChunk(this.chunks, this.chunks.length - 1);
    this.rangeStart = Number.isFinite(rangeStart) ? rangeStart : (first?.startOffset || 0);
    this.rangeEnd = Number.isFinite(rangeEnd) ? rangeEnd : (last?.endOffset || this.rangeStart);
    this.position = this.rangeStart;
    this.confirmedOffset = this.rangeStart;
    this.velocity = this.fallbackCps * this.rate;
  }

  getBaseVelocity() {
    if (Number.isFinite(this.observedVelocity)) return this.observedVelocity;
    return this.fallbackCps * this.rate;
  }

  advance(now) {
    const time = Number(now) || 0;
    if (!this.running || this.paused) return this.position;
    if (!this.lastTickAt) {
      this.lastTickAt = time;
      return this.position;
    }

    const dt = clamp((time - this.lastTickAt) / 1000, 0, MAX_FRAME_SECONDS);
    this.lastTickAt = time;
    if (!dt) return this.position;

    const chunk = getChunk(this.chunks, this.currentIndex);
    if (!chunk) return this.position;

    const baseVelocity = this.getBaseVelocity();
    const observation = this.lastObservation || {
      offset: chunk.startOffset,
      at: this.chunkStartedAt || time
    };
    const observationAge = Math.max(0, (time - observation.at) / 1000);
    // 有 boundary 观测时，如果上一次观测已经过去很久，说明当前大概率是标点/段落停顿。
    // 此时把预测速度按时间窗平滑衰减到 0，页面不会在停顿期间继续向下滚动。
    let projectedVelocity = baseVelocity;
    if (this.boundarySeen && observationAge * 1000 > SILENCE_GRACE_MS) {
      const silence = clamp((observationAge * 1000 - SILENCE_GRACE_MS) / SILENCE_RAMP_MS, 0, 1);
      projectedVelocity = baseVelocity * (1 - silence);
    }
    const projectedOffset = Math.min(chunk.endOffset, observation.offset + projectedVelocity * observationAge);
    const phaseError = projectedOffset - this.position;
    const desiredVelocity = clamp(
      baseVelocity + PHASE_GAIN * phaseError,
      0,
      Math.max(4, baseVelocity * 3)
    );
    const velocityDelta = clamp(
      desiredVelocity - this.velocity,
      -MAX_ACCELERATION * dt,
      MAX_ACCELERATION * dt
    );
    this.velocity = Math.max(0, this.velocity + velocityDelta);
    this.position = clamp(this.position + this.velocity * dt, this.rangeStart, chunk.endOffset);
    return this.position;
  }

  startChunk(index, now, observedStartOffset) {
    const chunk = getChunk(this.chunks, index);
    if (!chunk) return;
    const time = Number(now) || 0;
    const startOffset = clamp(
      Number.isFinite(observedStartOffset) ? observedStartOffset : chunk.startOffset,
      chunk.startOffset,
      chunk.endOffset
    );
    this.advance(time);
    this.currentIndex = index;
    this.chunkStartedAt = time;
    this.lastTickAt = time;
    this.running = true;
    this.paused = false;
    this.previousObservation = this.lastObservation;
    this.lastObservation = { offset: startOffset, at: time, source: 'chunk-start' };
    this.confirmedOffset = Math.max(this.confirmedOffset, startOffset);
    if (this.position < startOffset) this.position = startOffset;
  }

  observeBoundary(index, charIndex, now) {
    const chunk = getChunk(this.chunks, index);
    if (!chunk) return;
    const time = Number(now) || 0;
    this.advance(time);
    const local = clamp(Number(charIndex) || 0, 0, chunk.text.length);
    const offset = clamp(chunk.startOffset + local, chunk.startOffset, chunk.endOffset);
    if (this.lastObservation && offset < this.lastObservation.offset) return;
    if (this.lastObservation) {
      const seconds = (time - this.lastObservation.at) / 1000;
      const chars = offset - this.lastObservation.offset;
      if (seconds > 0.04 && chars > 0) {
        const sample = clamp(chars / seconds, 0.1, 30);
        this.observedVelocity = Number.isFinite(this.observedVelocity)
          ? this.observedVelocity * 0.7 + sample * 0.3
          : sample;
      }
    }
    this.previousObservation = this.lastObservation;
    this.lastObservation = { offset, at: time, source: 'boundary' };
    this.confirmedOffset = Math.max(this.confirmedOffset, offset);
    this.boundarySeen = true;
  }

  finishChunk(index, now) {
    const chunk = getChunk(this.chunks, index);
    if (!chunk) return;
    const time = Number(now) || 0;
    this.advance(time);
    this.previousObservation = this.lastObservation;
    this.lastObservation = { offset: chunk.endOffset, at: time, source: 'chunk-end' };
    this.confirmedOffset = Math.max(this.confirmedOffset, chunk.endOffset);
  }

  pause(now) {
    const time = Number(now) || 0;
    this.advance(time);
    this.paused = true;
    this.pausedAt = time;
  }

  resume(now) {
    const time = Number(now) || 0;
    if (this.pausedAt && this.lastObservation) {
      this.lastObservation.at += Math.max(0, time - this.pausedAt);
    }
    this.paused = false;
    this.pausedAt = 0;
    this.lastTickAt = time;
  }

  setRate(rate) {
    this.rate = Math.max(0.1, Number(rate) || 1);
  }

  setFallbackCps(cps) {
    this.fallbackCps = Math.max(0.1, Number(cps) || DEFAULT_CPS_AT_1X);
  }

  resetObservations(offset, now) {
    const time = Number(now) || 0;
    const safeOffset = clamp(Number(offset) || this.position, this.rangeStart, this.rangeEnd);
    this.previousObservation = null;
    this.observedVelocity = null;
    this.lastObservation = { offset: safeOffset, at: time, source: 'reset' };
    this.confirmedOffset = Math.max(this.confirmedOffset, safeOffset);
    this.lastTickAt = time;
    this.velocity = this.fallbackCps * this.rate;
    if (this.paused) this.pausedAt = time;
  }

  getOffset(now) {
    return this.advance(now);
  }

  getConfirmedOffset() {
    return this.confirmedOffset;
  }

  getProgress(now) {
    const offset = this.getOffset(now);
    const span = Math.max(1, this.rangeEnd - this.rangeStart);
    return {
      offset,
      charsRead: clamp(offset - this.rangeStart, 0, span),
      totalChars: span,
      fraction: clamp((offset - this.rangeStart) / span, 0, 1)
    };
  }
}
