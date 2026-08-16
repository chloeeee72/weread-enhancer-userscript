import { DEFAULT_WIDTH } from '../../../constants.js';

export const widthControl = {
  init() {
    const savedWidth = GM_getValue('weread_max_width', DEFAULT_WIDTH);
    this.applyWidth(savedWidth);
    return savedWidth;
  },

  applyWidth(width) {
    const content = document.querySelector('.readerContent .app_content');
    const topBar = document.querySelector('.readerTopBar');
    if (!content || !topBar) {
      return;
    }

    content.style.maxWidth = `${width}px`;
    topBar.style.maxWidth = `${width}px`;
    GM_setValue('weread_max_width', width);

    if ($('#widthSlider').length) {
      $('#widthSlider').val(width);
      $('#widthValue').text(`${width}px`);
    }

    window.dispatchEvent(new Event('resize'));
  },

  reset() {
    this.applyWidth(DEFAULT_WIDTH);
  }
};
