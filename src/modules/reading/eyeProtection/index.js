import { utils } from '../../../utils/index.js';

export const eyeProtection = {
  init() {
    const enabled = utils.getEyeProtectionState().enabled;
    const color = utils.getEyeProtectionState().color;

    if (enabled) {
      this.enable(color);
    } else {
      this.disable();
    }

    return enabled;
  },

  enable(color) {
    utils.saveEyeProtectionState(true, color);
    utils.syncControlPanelBackground();
  },

  disable() {
    utils.clearEyeProtectionClasses();
    utils.saveEyeProtectionState(false, utils.getEyeProtectionState().color);
    utils.syncControlPanelBackground();
  },

  changeColor(color) {
    const enabled = utils.getEyeProtectionState().enabled;
    utils.saveEyeProtectionState(enabled, color);
    utils.syncControlPanelBackground();
  },

  restoreState() {
    const state = utils.getEyeProtectionState();
    if (!state.enabled) {
      return;
    }

    setTimeout(() => {
      this.enable(state.color);
      document.querySelectorAll('.color-option-container').forEach((container) => {
        const colorOption = container.querySelector('.color-option');
        const colorKey = container.getAttribute('data-color');
        if (colorOption) {
          colorOption.classList.toggle('active', colorKey === state.color);
        }
      });
    }, 50);
  },

  syncButtonState() {
    const state = utils.getEyeProtectionState();
    const isWhite = utils.isWhiteTheme();

    if (!isWhite) {
      $('#eyeProtectionBtn').addClass('disabled');
      utils.updateEyeProtectionButton(false, false);
      return;
    }

    $('#eyeProtectionBtn').removeClass('disabled');
    utils.updateEyeProtectionButton(state.enabled, true);
  }
};
