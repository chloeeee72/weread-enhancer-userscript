import baseCss from './styles/base.css?raw';
import controlPanelCss from './modules/ui/controlPanel/styles.css?raw';
import progressBarCss from './modules/reading/progressBar/styles.css?raw';
import imageToolsCss from './modules/imageTools/styles.css?raw';
import imagePreviewCss from './modules/imagePreview/styles.css?raw';
import voiceReadCss from './modules/reading/voiceRead/styles.css?raw';
import { generateEyeProtectionStyles } from './styles/eyeProtectionStyles.js';
import { appState } from './runtime/state.js';
import { registerModules } from './runtime/registry.js';
import { utils } from './utils/index.js';
import { widthControl } from './modules/reading/widthControl/index.js';
import { eyeProtection } from './modules/reading/eyeProtection/index.js';
import { autoPageTurn } from './modules/reading/autoPageTurn/index.js';
import { autoRead } from './modules/reading/autoRead/index.js';
import { headerControl } from './modules/reading/headerControl/index.js';
import { controlPanel } from './modules/ui/controlPanel/index.js';
import { progressBar } from './modules/reading/progressBar/index.js';
import { imageTools } from './modules/imageTools/index.js';
import { imagePreviewPanel } from './modules/imagePreview/index.js';
import { voiceRead } from './modules/reading/voiceRead/index.js';

GM_addStyle(baseCss);
GM_addStyle(controlPanelCss);
GM_addStyle(progressBarCss);
GM_addStyle(imageToolsCss);
GM_addStyle(imagePreviewCss);
GM_addStyle(voiceReadCss);
GM_addStyle(generateEyeProtectionStyles());

registerModules({
  autoPageTurn,
  autoRead,
  controlPanel,
  eyeProtection,
  imagePreviewPanel,
  imageTools,
  progressBar,
  voiceRead
});

const NAV_INTENT_KEY = 'wr_nav_intent';

function saveNavIntent(text) {
  try {
    sessionStorage.setItem(NAV_INTENT_KEY, JSON.stringify({ text, at: Date.now() }));
  } catch (error) {
    // sessionStorage 不可用时忽略
  }
}

function clearNavIntent() {
  try {
    sessionStorage.removeItem(NAV_INTENT_KEY);
  } catch (error) {
    // 忽略
  }
}

function applyNavIntent() {
  try {
    const raw = sessionStorage.getItem(NAV_INTENT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !data.text || Date.now() - data.at > 30000) {
      clearNavIntent();
      return;
    }
    const text = data.text;
    clearNavIntent();
    const el = Array.from(document.querySelectorAll('button, a, [class*="button"], [class*="HeaderButton"]'))
      .find((node) => (node.textContent || '').trim() === text);
    if (el) el.click();
  } catch (error) {
    clearNavIntent();
  }
}

function bindNavIntent() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    const el = target && target.closest
      ? target.closest('button, a, [class*="button"], [class*="HeaderButton"]')
      : null;
    if (!el) return;
    const text = (el.textContent || '').trim();
    if (['上一章', '上一页', '下一页', '下一章'].includes(text)) {
      saveNavIntent(text);
      // 正常点击后如果页面没有刷新，10 秒后清除意图，避免下次刷新误触发。
      setTimeout(clearNavIntent, 10000);
    }
  }, true);
}

function initialize() {
  setTimeout(applyNavIntent, 1500);
  bindNavIntent();

  if (appState.isAutoReading) {
    setTimeout(() => {
      autoRead.restoreState();
    }, 1000);
  }

  progressBar.init();
  imageTools.init();
  imagePreviewPanel.init();
  controlPanel.init();
  headerControl.init();
  voiceRead.init();

  const currentWidth = widthControl.init();
  $('#widthSlider').val(currentWidth);
  $('#widthValue').text(`${currentWidth}px`);
  eyeProtection.syncButtonState();

  let lastThemeIsWhite = utils.isWhiteTheme();
  utils.handleThemeChange(lastThemeIsWhite, { silent: true });

  let themeSyncQueued = false;
  const flushThemeChange = () => {
    themeSyncQueued = false;
    const nextThemeIsWhite = utils.isWhiteTheme();
    if (nextThemeIsWhite !== lastThemeIsWhite) {
      lastThemeIsWhite = nextThemeIsWhite;
      utils.handleThemeChange(nextThemeIsWhite);
    }
    // 双栏/滚动阅读模式切换时，同步显示对应滑块。
    controlPanel.updateAutoReadControls?.();
  };

  const observer = new MutationObserver(() => {
    if (themeSyncQueued) {
      return;
    }

    themeSyncQueued = true;
    requestAnimationFrame(flushThemeChange);
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

$(window).on('load', initialize);
