export const appState = {
  scrollInterval: null,
  timerInterval: null,
  isAutoReading: GM_getValue('weread_auto_reading', false),
  activeReadingMode: GM_getValue('weread_reading_mode', 'auto'),
  readingDuration: GM_getValue('weread_reading_duration', 10),
  autoScrollSpeed: GM_getValue('weread_auto_scroll_speed', 1.0),
  isPageTurning: false,
  pageTurnCooldown: false,
  currentScrollSpeed: GM_getValue('weread_scroll_speed', 1.0),
  remainingTime: GM_getValue('weread_remaining_time', 0),
  lastTimerValue: GM_getValue('weread_last_timer', 0),
  timerPopupActive: false,
  windowTop: 0,
  bottomReachedTimer: null,
  isWaitingForPageTurn: false,
  lastScrollPosition: 0,
  progressInterval: null
};
