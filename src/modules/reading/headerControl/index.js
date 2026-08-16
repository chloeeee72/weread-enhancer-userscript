import { appState } from '../../../runtime/state.js';
import { moduleRegistry } from '../../../runtime/registry.js';

export const headerControl = {
  init() {
    $(window).on('scroll', function handleHeaderScroll() {
      const scrollTop = $(this).scrollTop();
      const topBar = document.querySelector('.readerTopBar');
      if (!topBar) {
        return;
      }

      $('.readerControls').hover(
        () => $('.readerControls').css('opacity', '1'),
        () => $('.readerControls').css('opacity', '0')
      );

      topBar.style.opacity = scrollTop >= appState.windowTop ? 0 : 1;
      appState.windowTop = scrollTop;

      if (appState.isAutoReading) {
        moduleRegistry.autoRead?.checkManualPageTurn();
      }
    });
  }
};
