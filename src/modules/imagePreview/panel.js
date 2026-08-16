import { utils } from '../../utils/index.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createImagePreviewTemplate() {
  return `
    <div class="image-preview-overlay" id="imagePreviewOverlay"></div>
    <div class="image-preview-panel" id="imagePreviewPanel">
      <div class="image-preview-header">
        <div class="image-preview-header-main">
          <div class="image-preview-title">全书图片预览</div>
          <div class="select-all-container select-all-container-inline">
            <input type="checkbox" class="select-all-checkbox" id="selectAllImages">
            <label class="select-all-label" for="selectAllImages">全选</label>
          </div>
        </div>
        <span class="image-preview-stats" id="imagePreviewStats">已选择 0 张图片 | 章节 0 | 共 0 张</span>
        <button class="image-preview-close" id="closeImagePreview">×</button>
      </div>
      <div class="image-preview-scan-banner" id="imagePreviewScanBanner" style="display:none;">
        <div class="image-preview-scan-banner-main">
          <div class="image-preview-scan-banner-title" id="imagePreviewScanTitle">正在扫描图片</div>
          <div class="image-preview-scan-banner-meta" id="imagePreviewScanMeta">图片 0 | 预计 --:--</div>
        </div>
        <div class="image-preview-scan-banner-bar">
          <div class="image-preview-scan-banner-fill" id="imagePreviewScanFill" style="width:0%"></div>
        </div>
        <div class="image-preview-scan-banner-status" id="imagePreviewScanStatus">正在准备扫描章节与图片...</div>
      </div>
      <div class="image-preview-content-container">
        <div class="image-preview-content" id="imagePreviewContent"></div>
      </div>
      <div class="image-preview-actions">
        <button class="control-btn" id="downloadSelectedImages">下载所选图片</button>
        <button class="control-btn" id="copySelectedImages">复制所选图片</button>
        <button class="control-btn" id="copySelectedImageUrls">复制所选图片url</button>
      </div>
    </div>
  `;
}

export function createImagePreviewPanelMethods() {
  return {
    init() {
      if (this.isInitialized) {
        return;
      }

      $('#imagePreviewOverlay, #imagePreviewPanel').remove();
      $('body').append(createImagePreviewTemplate());

      this.bindEvents();
      this.observeThemeChange();
      this.applyTheme();
      this.isInitialized = true;
    },

    bindEvents() {
      $('#closeImagePreview, #imagePreviewOverlay').off('click.imagePreview').on('click.imagePreview', () => this.hide());
      $('#selectAllImages').off('change.imagePreview').on('change.imagePreview', (event) => this.toggleSelectAll(event.target.checked));
      $('#downloadSelectedImages').off('click.imagePreview').on('click.imagePreview', () => this.downloadSelectedImages());
      $('#copySelectedImages').off('click.imagePreview').on('click.imagePreview', () => this.copySelectedImages());
      $('#copySelectedImageUrls').off('click.imagePreview').on('click.imagePreview', () => this.copySelectedImageUrls());
      $('#imagePreviewPanel').off('click.imagePreview').on('click.imagePreview', (event) => event.stopPropagation());
    },

    observeThemeChange() {
      if (this.themeObserver) {
        return;
      }
      this.themeObserver = new MutationObserver(() => {
        if (this.themeFramePending) {
          return;
        }

        this.themeFramePending = true;
        requestAnimationFrame(() => {
          this.themeFramePending = false;
          const nextTheme = this.getThemeMode();
          if (nextTheme !== this.currentTheme) {
            this.applyTheme(nextTheme);
          }
        });
      });
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    },

    getThemeMode() {
      return utils.isWhiteTheme() ? 'light' : 'dark';
    },

    applyTheme(theme = this.getThemeMode()) {
      const panel = $('#imagePreviewPanel');
      const overlay = $('#imagePreviewOverlay');
      const nextThemeClass = `theme-${theme}`;
      if (!panel.length || !overlay.length) {
        return;
      }

      if (
        theme === this.currentTheme &&
        panel.hasClass(nextThemeClass) &&
        overlay.hasClass(nextThemeClass)
      ) {
        return;
      }

      this.currentTheme = theme;
      panel.removeClass('theme-light theme-dark').addClass(nextThemeClass);
      overlay.removeClass('theme-light theme-dark').addClass(nextThemeClass);
    },

    renderChapterButtons() {
      return null;
    }
  };
}
