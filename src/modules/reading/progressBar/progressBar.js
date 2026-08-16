import { appState } from '../../../runtime/state.js';

export const progressBar = {
  waitTime: 0,
  startTime: 0,
  timerRemaining: 0,
  pageTurnActive: false,
  timerActive: false,

  init() {
    if ($('#auto-turn-progress').length) {
      return;
    }

    $('body').append(`
      <div id="auto-turn-progress" style="display:none;">
        <div class="timer-popup-row" id="timerPopupRow" style="display:none;">
          <div class="progress-text" id="timerPopupText">0秒后停止</div>
        </div>
        <div class="page-turn-popup-row" id="pageTurnPopupRow" style="display:none;">
          <div class="progress-text" id="pageTurnPopupText">0秒后自动翻页</div>
          <div class="progress-bar"><div class="progress-fill"></div></div>
        </div>
      </div>
    `);
  },

  show(waitTime) {
    this.waitTime = waitTime;
    this.startTime = Date.now();
    this.pageTurnActive = true;
    $('#pageTurnPopupRow').show();
    this.refreshContainerVisibility();
    this.update();
    this.startInterval();
  },

  showTimer(totalSeconds) {
    this.timerRemaining = totalSeconds;
    this.timerActive = true;
    appState.timerPopupActive = true;
    $('#timerPopupText').text(this.formatCountdown(totalSeconds) + '后停止');
    $('#timerPopupRow').show();
    this.refreshContainerVisibility();
    this.startInterval();
  },

  formatCountdown(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes > 0
      ? `${minutes}分${String(remainder).padStart(2, '0')}秒`
      : `${remainder}秒`;
  },

  startInterval() {
    if (appState.progressInterval) {
      return;
    }
    appState.progressInterval = setInterval(() => this.update(), 100);
  },

  refreshContainerVisibility() {
    $('#auto-turn-progress').toggle(Boolean(this.pageTurnActive || this.timerActive));
  },

  update() {
    if (this.pageTurnActive) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const remaining = Math.max(0, this.waitTime - elapsed);
      const percentage = (remaining / this.waitTime) * 100;
      $('#pageTurnPopupText').text(`${remaining.toFixed(1)}秒后自动翻页`);
      $('.progress-fill').css('width', `${percentage}%`);
      if (remaining <= 0) {
        this.hidePageTurn();
      }
    }

    if (this.timerActive && appState.timerPopupActive && appState.remainingTime >= 0) {
      this.timerRemaining = appState.remainingTime;
      $('#timerPopupText').text(this.formatCountdown(this.timerRemaining) + '后停止');
    }
  },

  hide() {
    this.hidePageTurn();
    this.hideTimer();
  },

  hidePageTurn() {
    this.pageTurnActive = false;
    $('#pageTurnPopupRow').hide();
    this.refreshContainerVisibility();
    this.stopInterval();
  },

  hideTimer() {
    this.timerActive = false;
    appState.timerPopupActive = false;
    $('#timerPopupRow').hide();
    this.refreshContainerVisibility();
    this.stopInterval();
  },

  stopInterval() {
    if (this.pageTurnActive || this.timerActive) {
      return;
    }
    if (appState.progressInterval) {
      clearInterval(appState.progressInterval);
      appState.progressInterval = null;
    }
  }
};
