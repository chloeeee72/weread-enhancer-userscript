import { appState } from '../../../runtime/state.js';

export const autoPageTurn = {
  trigger() {
    if (appState.isPageTurning || appState.pageTurnCooldown) {
      return;
    }

    appState.isPageTurning = true;
    appState.pageTurnCooldown = true;

    ['keydown', 'keyup'].forEach((eventType) => {
      document.dispatchEvent(new KeyboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
        key: 'ArrowRight',
        code: 'ArrowRight',
        keyCode: 39
      }));
    });

    setTimeout(() => {
      appState.pageTurnCooldown = false;
    }, 2000);

    setTimeout(() => {
      appState.isPageTurning = false;
      if (appState.activeReadingMode !== 'voice') {
        window.scrollTo(0, 100);
      }
    }, 1500);
  }
};
