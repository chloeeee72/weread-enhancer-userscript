import { EYE_PROTECTION_COLORS } from '../constants.js';
import { notificationManager } from './notifications.js';

const EYE_PROTECTION_BODY_CLASSES = Object.values(EYE_PROTECTION_COLORS).map(({ className }) => className);
const EYE_PROTECTION_ENABLED_TEXT = '\u62a4\u773c\u6a21\u5f0f:\u5f00';
const EYE_PROTECTION_DISABLED_TEXT = '\u62a4\u773c\u6a21\u5f0f:\u5173';
const EYE_PROTECTION_DARK_THEME_NOTICE = '\u63d2\u4ef6\u63d0\u793a\uff1a\u62a4\u773c\u6a21\u5f0f\u4ec5\u5728\u767d\u8272\u4e3b\u9898\u4e0b\u53ef\u7528';

let cachedThemeIsWhite = null;

export const utils = {
  notificationManager,

  waitForElement(selector, maxAttempts = 80) {
    return new Promise((resolve) => {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        if (document.querySelectorAll(selector).length) {
          clearInterval(checkInterval);
          resolve(true);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        attempts += 1;
      }, 100);
    });
  },

  isWhiteTheme() {
    return document.body.classList.contains('wr_whiteTheme');
  },

  isThemeChanged() {
    if (cachedThemeIsWhite === null) {
      cachedThemeIsWhite = GM_getValue('isWhiteTheme', this.isWhiteTheme());
    }

    return cachedThemeIsWhite !== this.isWhiteTheme();
  },

  syncStoredThemeState(isWhite = this.isWhiteTheme()) {
    if (cachedThemeIsWhite === isWhite) {
      return false;
    }

    cachedThemeIsWhite = isWhite;
    GM_setValue('isWhiteTheme', isWhite);
    return true;
  },

  updateEyeProtectionButton(enabled, isWhite = this.isWhiteTheme()) {
    const button = $('#eyeProtectionBtn');
    if (!button.length) {
      return;
    }

    const isActive = Boolean(enabled && isWhite);
    button.toggleClass('active', isActive);
    button.text(isActive ? EYE_PROTECTION_ENABLED_TEXT : EYE_PROTECTION_DISABLED_TEXT);
  },

  clearEyeProtectionClasses() {
    document.body.classList.remove(...EYE_PROTECTION_BODY_CLASSES);
  },

  applyEyeProtectionClass(color) {
    this.clearEyeProtectionClasses();

    const className = EYE_PROTECTION_COLORS[color]?.className;
    if (className) {
      document.body.classList.add(className);
    }
  },

  saveEyeProtectionState(enabled, color) {
    const nextColor = color ?? 'green';
    const isWhite = this.isWhiteTheme();
    let colorCode = EYE_PROTECTION_COLORS[nextColor]?.color ?? 'rgb(255, 255, 255)';

    if (isWhite) {
      const rgbaMatch = colorCode.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch && colorCode.startsWith('rgba')) {
        const [, r, g, b] = rgbaMatch;
        colorCode = `rgb(${r}, ${g}, ${b})`;
      }
    }

    GM_setValue('weread_eye_protection', enabled);
    GM_setValue('weread_eye_protection_color', nextColor);
    GM_setValue('weread_eye_protection_color_code', colorCode);
    this.updateEyeProtectionButton(enabled, isWhite);
  },

  getEyeProtectionState() {
    return {
      enabled: GM_getValue('weread_eye_protection', false),
      color: GM_getValue('weread_eye_protection_color', 'green'),
      code: GM_getValue('weread_eye_protection_color_code', EYE_PROTECTION_COLORS.green.color)
    };
  },

  syncControlPanelBackground(isWhite = this.isWhiteTheme(), state = this.getEyeProtectionState()) {
    const color = state.color ?? 'white';
    const colorCode = state.code ?? 'rgb(255, 255, 255)';
    const shouldApplyEyeProtection = Boolean(isWhite && state.enabled && color);
    const panel = $('#mainControlPanel');

    if (shouldApplyEyeProtection) {
      this.applyEyeProtectionClass(color);
    } else {
      this.clearEyeProtectionClasses();
    }

    if (isWhite) {
      this.resetControlPanelStyle();
      if (shouldApplyEyeProtection) {
        panel.css({
          backgroundColor: colorCode,
          borderColor: '',
          color: ''
        });
      } else {
        panel.css({
          backgroundColor: 'rgba(255, 255, 255, 1)',
          borderColor: '',
          color: ''
        });
      }
      this.syncQuickBarTheme(isWhite, state);
      return;
    }

    panel.css({
      backgroundColor: 'rgb(32, 32, 32)',
      borderColor: '#3e3e3e'
    });
    panel.find('.control-section-title').css('color', '#e6e6e6');
    panel.find('.control-btn').css({
      background: '#444',
      color: '#f5f5f5',
      borderColor: '#555'
    });
    this.syncQuickBarTheme(isWhite, state);
  },

  resetControlPanelStyle() {
    $('#mainControlPanel').find('.control-section-title').css('color', '');
    $('#mainControlPanel').find('.control-btn').css({
      background: '',
      color: '',
      borderColor: ''
    });
  },

  syncQuickBarTheme(isWhite, state) {
    const bar = $('#wr-voice-quick');
    if (!bar.length) return;

    const colorCode = state.code ?? 'rgb(255, 255, 255)';
    const shouldApplyEyeProtection = Boolean(isWhite && state.enabled && state.color);

    if (isWhite) {
      bar.css({
        backgroundColor: shouldApplyEyeProtection ? colorCode : 'rgba(255, 255, 255, 1)',
        color: '',
        borderColor: ''
      });
      bar.find('button').css({
        background: '',
        color: '',
        borderColor: ''
      });
      bar.find('.voice-quick-status').css('color', '');
      return;
    }

    bar.css({
      backgroundColor: 'rgb(32, 32, 32)',
      color: '#e6e6e6',
      borderColor: '#3e3e3e'
    });
    bar.find('button').css({
      background: '#444',
      color: '#f5f5f5',
      borderColor: '#555'
    });
    bar.find('.voice-quick-status').css('color', '#cfcfcf');
  },

  handleThemeChange(isWhite = this.isWhiteTheme(), options = {}) {
    const { silent = false } = options;
    const state = this.getEyeProtectionState();

    this.syncStoredThemeState(isWhite);

    if (isWhite) {
      $('#eyeProtectionBtn').removeClass('disabled');
      this.updateEyeProtectionButton(state.enabled, true);
    } else {
      $('#eyeProtectionBtn').addClass('disabled');
      this.updateEyeProtectionButton(false, false);
      if (!silent) {
        this.notificationManager.show(EYE_PROTECTION_DARK_THEME_NOTICE);
      }
    }

    this.syncControlPanelBackground(isWhite, state);
  },

  disableConsoleWithProxy() {
    window.console = new Proxy(console, {
      get(target, prop) {
        if (['log', 'warn', 'info', 'debug'].includes(prop)) {
          return function noop() {};
        }
        return target[prop];
      }
    });
  }
};

export const domUtils = utils;
