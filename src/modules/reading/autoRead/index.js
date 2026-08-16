import { appState } from '../../../runtime/state.js';
import { moduleRegistry } from '../../../runtime/registry.js';
import { utils } from '../../../utils/index.js';
import { pace, PAGE_DURATION_AT_1X } from '../pace/index.js';
import { scrollFollower } from '../voiceRead/scrollFollower.js';

export const autoRead = {
  isDoubleColumnReading() {
    return typeof document !== 'undefined' && Boolean(
      document.querySelector('.wr_horizontalReader, .wr_horizontalReader_app_content')
    );
  },

  calculateWaitTime() {
    if (appState.activeReadingMode === 'auto') {
      if (this.isDoubleColumnReading()) {
        return pace.getPageTurnWaitFromDuration(appState.readingDuration);
      }
      const speed = Math.min(3, Math.max(0.1, appState.autoScrollSpeed || 1));
      // 滚动阅读触底停留时间：0.1x -> 30s，3x -> 6s，中间线性分布。
      const waitTime = 30 + (6 - 30) * ((speed - 0.1) / (3 - 0.1));
      return Math.max(1, waitTime);
    }
    // 语音模式：翻页等待时长 = 剩余朗读时长，朗读结束后尽快翻页，
    // 避免“语音还在读、页面先翻走”造成的速度脱节。
    if (moduleRegistry.voiceRead?.isWaitingChapter?.()) {
      return 1;
    }
    const remaining = moduleRegistry.voiceRead?.getRemainingSeconds?.();
    if (Number.isFinite(remaining) && remaining > 0) {
      return Math.min(Math.max(remaining, 1), 120);
    }
    return pace.getPageTurnWaitSeconds(appState.currentScrollSpeed);
  },

  getTimerSlider() {
    return $('#autoTimerSlider').length && appState.activeReadingMode === 'auto'
      ? $('#autoTimerSlider')
      : $('#timerSlider');
  },

  getTimerValue() {
    return parseInt(this.getTimerSlider().val(), 10) || 0;
  },

  start() {
    // 语音模式不自动滚动，自动阅读的定时/滚动只服务于自动阅读模式。
    if (appState.activeReadingMode === 'voice') return;
    this.stopScrolling();
    this.clearBottomTimer();

    const timerMinutes = this.getTimerValue();
    if (timerMinutes > 0) {
      appState.lastTimerValue = timerMinutes;
      GM_setValue('weread_last_timer', appState.lastTimerValue);
      this.updateLastTimerButton();
    }

    this.beginScroll();
    this.updateButton();
    this.startTimer();
    this.saveState();
  },

  beginScroll() {
    this.stopScrolling();

    if (appState.activeReadingMode === 'voice') {
      // 语音朗读不做自动滚动。
      return;
    }

    let lastScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    let stuckCount = 0;

    appState.scrollInterval = setInterval(() => {
      if (appState.isPageTurning) {
        return;
      }

      const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight = document.documentElement.clientHeight || document.body.clientHeight;
      const distance = Math.max(0, scrollHeight - clientHeight);

      if (currentScrollTop + clientHeight >= scrollHeight - 10) {
        if (!appState.isWaitingForPageTurn) {
          this.schedulePageTurn();
        }
        return;
      }

      let scrollSeconds;
      if (this.isDoubleColumnReading()) {
        scrollSeconds = appState.readingDuration;
      } else {
        const speed = Math.min(3, Math.max(0.1, appState.autoScrollSpeed || 1));
        scrollSeconds = PAGE_DURATION_AT_1X / speed * 60;
      }
      const scrollStep = this.isDoubleColumnReading()
        ? pace.getScrollStepFromDuration(scrollSeconds, scrollHeight, clientHeight)
        : pace.getScrollStepFromSeconds(scrollSeconds, scrollHeight, clientHeight);

      if (currentScrollTop === lastScrollTop) {
        stuckCount += 1;
        window.scrollBy(0, scrollStep * (stuckCount > 5 ? 3 : 1));
      } else {
        stuckCount = 0;
        window.scrollBy(0, scrollStep);
      }

      lastScrollTop = currentScrollTop;
      appState.lastScrollPosition = currentScrollTop;
    }, 20);

    appState.isAutoReading = true;
  },

  stopScrolling() {
    if (appState.scrollInterval) {
      if (appState.scrollInterval?.type === 'voice-follow') {
        scrollFollower.stop();
      } else {
        clearInterval(appState.scrollInterval);
      }
      appState.scrollInterval = null;
    }
  },

  stop() {
    this.stopScrolling();

    appState.isAutoReading = false;
    appState.isPageTurning = false;
    appState.isWaitingForPageTurn = false;
    this.updateButton();
    this.clearBottomTimer();
    moduleRegistry.progressBar?.hide();
    this.stopTimer();
    this.saveState();
  },

  pause() {
    this.stopScrolling();
    this.clearBottomTimer();
    appState.isAutoReading = false;
    this.updateButton();
    this.saveState();
  },

  resume() {
    if (appState.scrollInterval) return;
    this.beginScroll();
    this.updateButton();
    this.saveState();
  },

  syncPace() {
    if (!appState.isAutoReading) return;
    this.clearBottomTimer();
    this.beginScroll();
    this.updateButton();
    this.saveState();
  },

  toggle() {
    if (appState.isAutoReading) {
      this.stop();
      return;
    }
    this.start();
  },

  schedulePageTurn() {
    appState.isWaitingForPageTurn = true;
    const waitTime = this.calculateWaitTime();
    moduleRegistry.progressBar?.show(waitTime);
    appState.bottomReachedTimer = setTimeout(() => {
      if (appState.isWaitingForPageTurn) {
        moduleRegistry.autoPageTurn?.trigger();
        appState.isWaitingForPageTurn = false;
        moduleRegistry.progressBar?.hide();
      }

      setTimeout(() => {
        if (appState.isAutoReading) {
          appState.lastScrollPosition = 0;
        }
      }, 2000);
    }, waitTime * 1000);
  },

  clearBottomTimer() {
    if (appState.bottomReachedTimer) {
      clearTimeout(appState.bottomReachedTimer);
      appState.bottomReachedTimer = null;
    }
    appState.isWaitingForPageTurn = false;
    moduleRegistry.progressBar?.hide();
  },

  checkManualPageTurn() {
    if (!appState.isWaitingForPageTurn) {
      return;
    }
    const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (Math.abs(currentScrollTop - appState.lastScrollPosition) > 50) {
      this.clearBottomTimer();
      this.schedulePageTurn();
    }
    appState.lastScrollPosition = currentScrollTop;
  },

  startTimer() {
    const timerMinutes = this.getTimerValue();
    if (timerMinutes <= 0) {
      this.stopTimer();
      return;
    }

    if (appState.timerInterval) {
      clearInterval(appState.timerInterval);
      appState.timerInterval = null;
    }

    if (appState.remainingTime <= 0) {
      appState.remainingTime = timerMinutes * 60;
    }

    appState.timerPopupActive = true;
    this.updateTimerDisplay();
    moduleRegistry.progressBar?.showTimer(appState.remainingTime);
    appState.timerInterval = setInterval(() => {
      appState.remainingTime -= 1;
      this.updateTimerDisplay();
      GM_setValue('weread_remaining_time', appState.remainingTime);

      if (appState.remainingTime <= 0) {
        const stoppedByMode = appState.activeReadingMode;
        if (stoppedByMode === 'voice' && moduleRegistry.voiceRead) {
          moduleRegistry.voiceRead.stop({ silent: true });
        } else {
          this.stop();
        }
        const label = stoppedByMode === 'voice' ? '语音阅读' : '自动阅读';
        utils.notificationManager.show(`定时时间到，${label}已停止`);
      }
    }, 1000);
  },

  stopTimer() {
    if (appState.timerInterval) {
      clearInterval(appState.timerInterval);
      appState.timerInterval = null;
    }
    appState.remainingTime = 0;
    appState.timerPopupActive = false;
    GM_setValue('weread_remaining_time', 0);
    this.updateTimerDisplay();
    moduleRegistry.progressBar?.hideTimer();
  },

  updateTimerDisplay() {
    const displayId = appState.activeReadingMode === 'auto' ? '#autoTimerDisplay' : '#timerDisplay';
    const timerMinutes = this.getTimerValue();
    const display = $(displayId);
    if (appState.remainingTime > 0) {
      display.text(`剩余: ${Math.floor(appState.remainingTime / 60)}:${String(appState.remainingTime % 60).padStart(2, '0')}`);
    } else if (timerMinutes > 0) {
      display.text(`定时: ${timerMinutes}分钟`);
    } else {
      display.text('');
    }
    this.syncTimerSliders();
    moduleRegistry.controlPanel?.syncLastTimerButtons?.();
  },

  updateButton() {
    const button = $('#toggleAutoRead');
    if (button.length) {
      button.text(appState.isAutoReading ? '停止阅读' : '开始阅读');
      button.toggleClass('active', appState.isAutoReading);
      return;
    }
    moduleRegistry.voiceRead?.syncPlaybackUI();
  },

  updateLastTimerButton() {
    const isWhite = utils.isWhiteTheme();
    $('#lastTimerBtn, #autoLastTimerBtn').each(function updateLastTimer() {
      $(this).removeClass('disabled');
      if (isWhite) {
        $(this).css({ background: '', color: '', borderColor: '' });
      } else {
        // 黑色/深色主题下保持与其它按钮一致的深底浅字，避免背景被清成白色后文字不可见。
        $(this).css({ background: '#444', color: '#f5f5f5', borderColor: '#555' });
      }
    });
  },

  applyLastTimer() {
    if (appState.lastTimerValue <= 0) {
      utils.notificationManager.show('没有找到上次定时时间');
      return;
    }

    this.setTimerMinutes(appState.lastTimerValue);
    utils.notificationManager.show(`已设置为上次定时时间: ${appState.lastTimerValue}分钟`);
  },

  setTimerMinutes(minutes) {
    const nextMinutes = Math.max(0, parseInt(minutes, 10) || 0);
    this.setTimerValue(nextMinutes);

    const voiceActive = Boolean(
      moduleRegistry.voiceRead &&
      (moduleRegistry.voiceRead.isActive?.() ||
        moduleRegistry.voiceRead.speechEngine?.playing ||
        moduleRegistry.voiceRead.speechEngine?.paused)
    );
    if (!appState.isAutoReading && !voiceActive) {
      return;
    }

    if (nextMinutes <= 0) {
      this.stopTimer();
      return;
    }

    appState.remainingTime = nextMinutes * 60;
    this.startTimer();
    this.updateTimerDisplay();
  },

  setTimerValue(minutes) {
    const snappedMinutes = Math.max(0, Math.round(minutes));
    $('#timerSlider').val(snappedMinutes);
    $('#autoTimerSlider').val(snappedMinutes);
    $('#timerValue').text(`${snappedMinutes}分钟`);
    $('#autoTimerValue').text(`${snappedMinutes}分钟`);
    this.updateTimerDisplay();
  },

  syncTimerSliders() {
    const voiceValue = parseInt($('#timerSlider').val(), 10) || 0;
    const autoValue = parseInt($('#autoTimerSlider').val(), 10) || 0;
    const nextValue = appState.activeReadingMode === 'auto' ? autoValue : voiceValue;
    const snappedValue = Math.max(0, Math.round(nextValue));
    $('#timerSlider').val(snappedValue);
    $('#autoTimerSlider').val(snappedValue);
    $('#timerValue').text(`${snappedValue}分钟`);
    $('#autoTimerValue').text(`${snappedValue}分钟`);
  },

  getReadingDuration() {
    return pace.clampDuration(appState.readingDuration);
  },

  saveState() {
    GM_setValue('weread_auto_reading', appState.isAutoReading);
    GM_setValue('weread_scroll_speed', appState.currentScrollSpeed);
  },

  restoreState() {
    if (!appState.isAutoReading) {
      return;
    }

    // 系统语音需要用户手势，刷新后不能只恢复滚动而没有语音时钟。
    if (appState.activeReadingMode === 'voice') {
      appState.isAutoReading = false;
      this.saveState();
      this.updateButton();
      return;
    }

    const restoredRate = pace.clampRate(appState.currentScrollSpeed);
    $('#ttsRateSlider').val(restoredRate);
    $('#ttsRateValue').text(`${restoredRate.toFixed(1)}x`);
    const timerMinutes = Math.ceil(appState.remainingTime / 60);
    if (timerMinutes > 0) {
      this.setTimerValue(timerMinutes);
    }
    this.updateButton();
    this.start();
    moduleRegistry.voiceRead?.syncAllUI();
    utils.notificationManager.show('已恢复自动阅读状态');
  }
};
