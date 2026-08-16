import { pace } from '../pace/index.js';

const KEYS = {
  rate: 'weread_tts_rate',
  voiceURI: 'weread_tts_voice_uri',
  follow: 'weread_tts_follow',
  rangeStart: 'weread_tts_range_start',
  rangeEnd: 'weread_tts_range_end'
};

const LEGACY_KEY = 'wr-tts-settings';
const DEFAULTS = {
  rate: 1,
  voiceURI: '',
  follow: true,
  rangeStart: '',
  rangeEnd: ''
};

function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function readNumber(value, fallback) {
  // GM_getValue 未设置时返回 null：Number(null) 为 0，会让新安装默认语速被钳成 0.5x，
  // 因此 null / undefined / 空字符串一律走 fallback。
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const ttsSettings = {
  rate: DEFAULTS.rate,
  voiceURI: DEFAULTS.voiceURI,
  follow: DEFAULTS.follow,
  rangeStart: DEFAULTS.rangeStart,
  rangeEnd: DEFAULTS.rangeEnd,

  load() {
    const legacy = readLegacy();
    this.rate = pace.clampRate(readNumber(GM_getValue(KEYS.rate, null), legacy.rate));
    this.voiceURI = GM_getValue(KEYS.voiceURI, legacy.voiceURI) || DEFAULTS.voiceURI;
    this.follow = Boolean(GM_getValue(KEYS.follow, legacy.follow ?? DEFAULTS.follow));
    this.rangeStart = GM_getValue(KEYS.rangeStart, DEFAULTS.rangeStart) || DEFAULTS.rangeStart;
    this.rangeEnd = GM_getValue(KEYS.rangeEnd, DEFAULTS.rangeEnd) || DEFAULTS.rangeEnd;
  },

  save() {
    GM_setValue(KEYS.rate, this.rate);
    GM_setValue(KEYS.voiceURI, this.voiceURI);
    GM_setValue(KEYS.follow, this.follow);
    GM_setValue(KEYS.rangeStart, this.rangeStart);
    GM_setValue(KEYS.rangeEnd, this.rangeEnd);

    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify({
        rate: this.rate,
        voiceURI: this.voiceURI,
        follow: this.follow
      }));
    } catch (error) {
      // 无痕模式或受限存储时忽略
    }
  },

  setRange(startText, endText) {
    this.rangeStart = String(startText || '').trim();
    this.rangeEnd = String(endText || '').trim();
    this.save();
  },

  clearRange() {
    this.rangeStart = '';
    this.rangeEnd = '';
    this.save();
  }
};
