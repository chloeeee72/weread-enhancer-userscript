import { DEFAULT_WIDTH, EYE_PROTECTION_COLORS } from '../../../constants.js';
import { appState } from '../../../runtime/state.js';
import { moduleRegistry } from '../../../runtime/registry.js';
import { utils } from '../../../utils/index.js';
import { pace } from '../../reading/pace/index.js';
import { widthControl } from '../../reading/widthControl/index.js';
import { panelDrag } from './panelDrag.js';

export const controlPanel = {
  snapToDetent(value, min, max, step) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.round(number / step) * step));
  },

  getMaxPanelWidth() {
    const panel = $('#mainControlPanel');
    const left = panel.length ? parseInt(panel.css('left'), 10) || 0 : 60;
    return Math.max(260, window.innerWidth - left - 16);
  },

  init() {
    const savedWidth = GM_getValue('weread_max_width', DEFAULT_WIDTH);
    const savedPanelWidth = Math.max(260, parseInt(GM_getValue('weread_control_panel_width', 320), 10) || 320);
    const initialPanelWidth = Math.min(savedPanelWidth, window.innerWidth - 60 - 16);

    $('body').append(`
      <div class="control-panel" style="display: none; width: ${initialPanelWidth}px;" id="mainControlPanel">
        <button class="control-panel-close" id="closeControlPanel">×</button>
        <div class="control-section">
          <div class="control-section-title">宽度控制</div>
          <div class="control-item">
            <span class="control-label">页面宽度</span>
            <div class="slider-box">
              <input type="range" class="control-slider" id="widthSlider" min="600" max="1400" step="100" value="${savedWidth}">
            </div>
            <span class="control-value" id="widthValue">${savedWidth}px</span>
          </div>
          <div class="control-buttons">
            <button class="control-btn reset" id="resetWidth">恢复默认</button>
          </div>
        </div>
        <div class="control-section">
          <div class="reading-tabs">
            <button class="reading-tab active" id="autoReadTab" type="button">自动阅读</button>
            <button class="reading-tab" id="voiceReadTab" type="button">语音阅读</button>
          </div>
          <div class="reading-panel" id="autoReadPanel">
            <div class="control-section-title">自动阅读</div>
            <div class="control-item" id="readingDurationItem">
              <span class="control-label">阅读时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider duration-slider" id="readingDurationSlider" min="5" max="60" step="5" value="${appState.readingDuration}">
              </div>
              <span class="control-value" id="readingDurationValue">${appState.readingDuration}秒/页</span>
            </div>
            <div class="control-item" id="autoScrollSpeedItem">
              <span class="control-label">阅读速度</span>
              <div class="slider-box">
                <input type="range" class="control-slider auto-speed-slider" id="autoScrollSpeedSlider" min="0.1" max="3" step="0.1" value="${appState.autoScrollSpeed}">
              </div>
              <span class="control-value" id="autoScrollSpeedValue">${appState.autoScrollSpeed.toFixed(1)}x</span>
            </div>
            <div class="control-item">
              <span class="control-label">定时时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider timer-slider" id="autoTimerSlider" min="0" max="120" step="1" value="0">
              </div>
              <span class="control-value" id="autoTimerValue">0分钟</span>
            </div>
            <div class="timer-display" id="autoTimerDisplay"></div>
            <div class="control-buttons">
              <button class="control-btn" id="autoLastTimerBtn">上次定时</button>
              <button class="control-btn" id="toggleAutoRead">开始阅读</button>
            </div>
          </div>
          <div class="reading-panel" id="voiceReadPanel" style="display:none;">
            <div class="control-item">
              <span class="control-label">语速</span>
              <div class="slider-box">
                <input type="range" class="control-slider speed-slider" id="ttsRateSlider" min="0.5" max="1.5" step="0.1" value="${pace.clampRate(appState.currentScrollSpeed)}">
              </div>
              <span class="control-value" id="ttsRateValue">${appState.currentScrollSpeed.toFixed(1)}x</span>
            </div>
            <div class="control-item voice-select-row">
              <span class="control-label">音色</span>
              <select class="control-select" id="ttsVoiceSelect"></select>
              <label class="control-checkbox control-checkbox-inline" for="ttsFollowCheckbox">
                <input type="checkbox" id="ttsFollowCheckbox">
                <span>章节续读</span>
              </label>
            </div>
            <div class="control-item">
              <span class="control-label">定时时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider timer-slider" id="timerSlider" min="0" max="120" step="1" value="0">
              </div>
              <span class="control-value" id="timerValue">0分钟</span>
            </div>
            <div class="timer-display" id="timerDisplay"></div>
            <div class="range-fields">
              <div class="range-row">
                <div class="control-item">
                  <span class="control-label">从文字</span>
                  <input type="text" class="range-input" id="ttsRangeStart">
                </div>
                <div class="control-item">
                  <span class="control-label">到文字</span>
                  <input type="text" class="range-input" id="ttsRangeEnd">
                </div>
              </div>
              <div class="control-buttons">
                <button class="control-btn secondary" id="ttsRangeApply">确定范围</button>
                <button class="control-btn secondary" id="ttsRangeClear">清除范围</button>
              </div>
            </div>
            <div class="control-buttons">
              <button class="control-btn" id="ttsToggleBtn">朗读</button>
              <button class="control-btn secondary" id="ttsStopBtn" disabled>停止</button>
              <button class="control-btn secondary" id="ttsRetryBtn">重试</button>
            </div>
          </div>
        </div>
        <div class="control-section">
          <div class="control-section-title">显示设置</div>
          <div class="color-options" id="colorOptionsContainer"></div>
          <div class="control-buttons">
            <button class="control-btn" id="eyeProtectionBtn">护眼模式:关</button>
          </div>
        </div>
        <div class="control-section">
          <div class="control-section-title">图片工具</div>
          <div class="control-buttons">
            <button class="control-btn" id="previewAllImages">预览/下载图片</button>
          </div>
        </div>
        <div class="panel-resizer" id="controlPanelResizer" title="拖动调整宽度"></div>
      </div>
    `);

    this.generateColorOptions();
    this.snapSliderValues();
    this.addControlButton();
    this.bindEvents();
    this.setReadingMode(appState.activeReadingMode);
    this.syncLastTimerButtons();
    this.syncTimerDisplays();
    panelDrag.init($('#mainControlPanel'));
    moduleRegistry.autoRead?.updateLastTimerButton();

    $('.control-slider').on('pointerup', function handleSliderDetent() {
      controlPanel.snapSliderValues();
    });
  },

  setReadingMode(mode) {
    appState.activeReadingMode = mode === 'voice' ? 'voice' : 'auto';
    GM_setValue('weread_reading_mode', appState.activeReadingMode);
    $('#autoReadTab').toggleClass('active', appState.activeReadingMode === 'auto');
    $('#voiceReadTab').toggleClass('active', appState.activeReadingMode === 'voice');
    $('#autoReadPanel').toggle(appState.activeReadingMode === 'auto');
    $('#voiceReadPanel').toggle(appState.activeReadingMode === 'voice');
    this.syncModeControls();
    this.updateAutoReadControls();
  },

  updateAutoReadControls() {
    const isDouble = Boolean(moduleRegistry.autoRead?.isDoubleColumnReading?.());
    $('#readingDurationItem').toggle(isDouble);
    $('#autoScrollSpeedItem').toggle(!isDouble);
    // 双栏阅读下隐藏“从文字/到文字”及相关按钮；语音阅读入口保留。
    $('#voiceReadPanel .range-fields').toggle(!isDouble);
  },

  syncModeControls() {
    if (appState.activeReadingMode === 'auto') {
      const duration = pace.clampDuration(pace.getDurationFromRate(appState.currentScrollSpeed));
      appState.readingDuration = duration;
      GM_setValue('weread_reading_duration', duration);
      $('#readingDurationSlider').val(duration);
      $('#readingDurationValue').text(`${duration}秒/页`);
      moduleRegistry.autoRead?.updateButton();
    } else {
      moduleRegistry.voiceRead?.syncAllUI();
    }
    this.syncTimerDisplays();
  },

  syncTimerDisplays() {
    const timerValue = parseInt($('#timerSlider').val(), 10) || 0;
    $('#timerValue').text(`${timerValue}分钟`);
    $('#autoTimerValue').text(`${timerValue}分钟`);
    moduleRegistry.autoRead?.updateTimerDisplay?.();
  },

  syncLastTimerButtons() {
    moduleRegistry.autoRead?.updateLastTimerButton();
  },

  generateColorOptions() {
    const container = $('#colorOptionsContainer');
    container.empty();
    const state = utils.getEyeProtectionState();

    Object.keys(EYE_PROTECTION_COLORS).forEach((colorKey) => {
      const colorInfo = EYE_PROTECTION_COLORS[colorKey];
      const isActive = colorKey === state.color;
      const colorOption = $(`
        <div class="color-option-container" data-color="${colorKey}">
          <div class="color-option color-${colorKey} ${isActive ? 'active' : ''}"></div>
          <div class="color-name">${colorInfo.name}</div>
        </div>
      `);
      container.append(colorOption);
    });
  },

  snapSliderValues() {
    const durationValue = pace.clampDuration(parseInt($('#readingDurationSlider').val(), 10) || 10);
    $('#readingDurationSlider').val(durationValue);
    $('#readingDurationValue').text(`${durationValue}秒/页`);

    const autoSpeedValue = Math.min(3, Math.max(0.1, Math.round((parseFloat($('#autoScrollSpeedSlider').val()) || 1) * 10) / 10));
    $('#autoScrollSpeedSlider').val(autoSpeedValue);
    $('#autoScrollSpeedValue').text(`${autoSpeedValue.toFixed(1)}x`);

    const timerValue = Math.min(120, Math.max(0, Math.round(parseInt($('#timerSlider').val(), 10) || 0)));
    $('#timerSlider').val(timerValue);
    $('#autoTimerSlider').val(timerValue);
    $('#timerValue').text(`${timerValue}分钟`);
    $('#autoTimerValue').text(`${timerValue}分钟`);

    const widthValue = Math.min(1400, Math.max(600, Math.round((parseInt($('#widthSlider').val(), 10) || 1000) / 100) * 100));
    $('#widthSlider').val(widthValue);
    $('#widthValue').text(`${widthValue}px`);
    widthControl.applyWidth(widthValue);

    const rateValue = pace.clampRate(parseFloat($('#ttsRateSlider').val()) || 1);
    $('#ttsRateSlider').val(rateValue);
    $('#ttsRateValue').text(`${rateValue.toFixed(1)}x`);
  },

  addControlButton() {
    $('.readerControls').append(`
      <div class="wr_tooltip_container" style="--offset: 6px;">
        <button class="readerControls_item" id="mainControl" style="color:#6a6c6c;cursor:pointer;">
          <span class="settings-icon"></span>
        </button>
        <div class="wr_tooltip_item wr_tooltip_item--right" style="display: none;">设置</div>
      </div>
    `);
  },

  bindEvents() {
    $('#mainControl').on('click', () => $('#mainControlPanel').toggle());

    $('#mainControl').hover(
      function showTooltip() { $(this).siblings('.wr_tooltip_item').show(); },
      function hideTooltip() { $(this).siblings('.wr_tooltip_item').hide(); }
    );

    $(document).on('click', '#closeControlPanel', (event) => {
      event.stopPropagation();
      $('#mainControlPanel').hide();
    });

    $('#widthSlider').on('input', function handleWidthInput() {
      const newWidth = controlPanel.snapToDetent(parseInt($(this).val(), 10), 600, 1400, 100);
      $(this).val(newWidth);
      $('#widthValue').text(`${newWidth}px`);
      widthControl.applyWidth(newWidth);
    });

    $('#resetWidth').on('click', () => {
      $('#widthSlider').val(DEFAULT_WIDTH);
      $('#widthValue').text(`${DEFAULT_WIDTH}px`);
      widthControl.reset();
    });

    $('#controlPanelResizer').on('mousedown', function handlePanelResize(event) {
      event.preventDefault();
      event.stopPropagation();

      const panel = $('#mainControlPanel');
      $('#controlPanelResizer').addClass('resizing');
      const startX = event.clientX;
      const startWidth = panel.outerWidth();

      function resizePanel(moveEvent) {
        const maxWidth = controlPanel.getMaxPanelWidth();
        const nextWidth = Math.max(260, Math.min(startWidth + moveEvent.clientX - startX, maxWidth));
        panel.css('width', `${nextWidth}px`);
      }

      function finishResize() {
        $(document).off('mousemove', resizePanel);
        $(document).off('mouseup', finishResize);
        $('#controlPanelResizer').removeClass('resizing');
        GM_setValue('weread_control_panel_width', Math.round(panel.outerWidth()));
      }

      $(document).on('mousemove', resizePanel);
      $(document).on('mouseup', finishResize);
    });

    $(document).on('click', '.color-option-container', function handleColorSelect() {
      const color = $(this).data('color');
      $('.color-option').removeClass('active');
      $(this).find('.color-option').addClass('active');
      moduleRegistry.eyeProtection?.changeColor(color);
    });

    $(document).on('click', '#eyeProtectionBtn', () => {
      const isWhite = utils.isWhiteTheme();
      const isEnabled = utils.getEyeProtectionState().enabled;
      if (!isWhite) {
        utils.notificationManager.show('护眼模式仅在白色主题下可用', 3000);
        return;
      }

      if (isEnabled) {
        moduleRegistry.eyeProtection?.disable();
      } else {
        moduleRegistry.eyeProtection?.enable(utils.getEyeProtectionState().color);
      }
    });

    $(document).on('click', '#autoReadTab', () => this.setReadingMode('auto'));
    $(document).on('click', '#voiceReadTab', () => this.setReadingMode('voice'));

    $('#readingDurationSlider').on('input', function handleDurationInput() {
      const duration = pace.clampDuration(parseInt($(this).val(), 10) || 10);
      $(this).val(duration);
      appState.readingDuration = duration;
      GM_setValue('weread_reading_duration', duration);
      $('#readingDurationValue').text(`${duration}秒/页`);
      moduleRegistry.autoRead?.syncPace();
    });

    $('#autoScrollSpeedSlider').on('input', function handleAutoSpeedInput() {
      const speed = Math.min(3, Math.max(0.1, Math.round((parseFloat($(this).val()) || 1) * 10) / 10));
      $(this).val(speed);
      appState.autoScrollSpeed = speed;
      GM_setValue('weread_auto_scroll_speed', speed);
      $('#autoScrollSpeedValue').text(`${speed.toFixed(1)}x`);
      moduleRegistry.autoRead?.syncPace();
    });

    $('#timerSlider').on('input', function handleTimerInput() {
      const minutes = controlPanel.snapToDetent(parseInt($(this).val(), 10), 0, 120, 1);
      $(this).val(minutes);
      $('#timerValue').text(`${minutes}分钟`);
      moduleRegistry.autoRead?.setTimerMinutes(minutes);
    });

    $('#autoTimerSlider').on('input', function handleAutoTimerInput() {
      const minutes = controlPanel.snapToDetent(parseInt($(this).val(), 10), 0, 120, 1);
      $(this).val(minutes);
      $('#autoTimerValue').text(`${minutes}分钟`);
      moduleRegistry.autoRead?.setTimerMinutes(minutes);
    });

    $(document).on('click', '#lastTimerBtn, #autoLastTimerBtn', () => moduleRegistry.autoRead?.applyLastTimer());
    $(document).on('click', '#toggleAutoRead', () => moduleRegistry.autoRead?.toggle());

    $('#previewAllImages').on('click', () => moduleRegistry.imagePreviewPanel?.show());

    $(document).on('click', (event) => {
      if (!$(event.target).closest('.control-panel, .voice-quick, #mainControl, #closeControlPanel').length) {
        $('.control-panel').hide();
      }
    });
  }
};
