import { appState } from '../../../runtime/state.js';
import { moduleRegistry } from '../../../runtime/registry.js';

export const RATE_MIN = 0.5;
export const RATE_MAX = 1.5;
export const RATE_STEP = 0.1;
export const DURATION_MIN = 5;
export const DURATION_MAX = 60;
export const PAGE_DURATION_AT_1X = 10;
// 语音阅读时，1x 语速下每秒大约朗读的字符数（中文语音合成约 250-330 字/分钟）。
// 用于把正文长度换算成预计朗读时长，使页面滚动速度与朗读速度匹配。
export const CHARS_PER_SECOND_AT_1X = 4.5;
const TICK_INTERVAL = 20;

export const pace = {
  clampRate(value) {
    const number = Number(value);
    // null / undefined / 空串（如损坏的存储值）一律回默认 1x；
    // 注意 Number(null) 为 0，若不加判断会被误钳成 0.5x
    if (!Number.isFinite(number) || value === null || value === undefined || value === '') return 1;
    // 先钳制到 [RATE_MIN, RATE_MAX]，再吸附到 RATE_STEP 档位。
    // 用 *10 取整 /10 消除浮点余数（如 0.1 * 11 可能得到 1.1000000000000001），
    // 保证 1.5 / 0.5 等边界值精确落档。
    const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, number));
    const steps = Math.round(clamped / RATE_STEP);
    return Math.round(steps * RATE_STEP * 10) / 10;
  },

  clampDuration(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 10;
    return Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(number / 5) * 5));
  },

  getRateFromDuration(duration) {
    return this.clampRate(PAGE_DURATION_AT_1X / this.clampDuration(duration));
  },

  getDurationFromRate(rate) {
    return this.clampDuration(PAGE_DURATION_AT_1X / this.clampRate(rate));
  },

  getScrollStepFromPage(rate, scrollHeight, clientHeight) {
    const distance = Math.max(0, scrollHeight - clientHeight);
    const durationSeconds = this.getPageTurnWaitSeconds(rate);
    return Math.max(1, distance / (durationSeconds * TICK_INTERVAL));
  },

  getScrollStepFromDuration(duration, scrollHeight, clientHeight) {
    const distance = Math.max(0, scrollHeight - clientHeight);
    return Math.max(1, distance / (this.clampDuration(duration) * TICK_INTERVAL));
  },

  getPageTurnWaitSeconds(rate) {
    return this.clampDuration(PAGE_DURATION_AT_1X / this.clampRate(rate));
  },

  getPageTurnWaitFromDuration(duration) {
    return this.clampDuration(duration);
  },

  /** 根据正文长度和语速估算朗读时长（秒），不钳制到 [DURATION_MIN, DURATION_MAX] */
  getReadingSeconds(textLength, rate) {
    const chars = Math.max(0, Number(textLength) || 0);
    if (!chars) return 0;
    return chars / (CHARS_PER_SECOND_AT_1X * this.clampRate(rate));
  },

  /** 根据给定的时长（秒）计算每 20ms tick 的滚动步长，不下限，支持亚像素 */
  getScrollStepFromSeconds(seconds, scrollHeight, clientHeight) {
    const distance = Math.max(0, scrollHeight - clientHeight);
    const duration = Math.max(0.1, Number(seconds) || 0);
    return distance / (duration * TICK_INTERVAL);
  },

  applyRate(rate) {
    appState.currentScrollSpeed = this.clampRate(rate);
    GM_setValue('weread_scroll_speed', appState.currentScrollSpeed);
    moduleRegistry.autoRead?.syncPace();
  }
};
