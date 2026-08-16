import { utils } from '../../utils/index.js';
import { imageTools } from '../imageTools/index.js';

export function createImagePreviewActionMethods() {
  return {
    getCurrentImageItems() {
      return this.getFilteredImages().filter((item) => item && item.src);
    },

    updateStats(imageCount = 0) {
      const selected = this.selectedImages.size;
      const total = imageCount || this.getCurrentImageItems().length || this.allImages.length || $('.image-preview-checkbox').length;
      $('#imagePreviewStats').text(`已选择 ${selected} 张图片 | 共 ${total} 张`);
    },

    toggleImageSelection(src, selected) {
      if (!src) {
        return;
      }
      const items = $('.image-preview-item').filter((_, item) => item.dataset.src === src);
      if (selected) {
        this.selectedImages.add(src);
        items.addClass('selected');
      } else {
        this.selectedImages.delete(src);
        items.removeClass('selected');
      }
      this.updateStats();
      this.updateSelectAllState();
    },

    toggleSelectAll(selected) {
      const checkboxes = $('.image-preview-checkbox');
      this.selectedImages.clear();
      checkboxes.each((_, checkbox) => {
        const src = checkbox.dataset.src;
        checkbox.checked = selected;
        $(checkbox).closest('.image-preview-item').toggleClass('selected', selected);
        if (selected && src) {
          this.selectedImages.add(src);
        }
      });
      this.updateStats();
      this.updateSelectAllState();
    },

    updateSelectAllState() {
      const total = $('.image-preview-checkbox').length;
      const selected = this.selectedImages.size;
      const selectAll = $('#selectAllImages');

      if (!total || selected === 0) {
        selectAll.prop('checked', false).prop('indeterminate', false);
      } else if (selected === total) {
        selectAll.prop('checked', true).prop('indeterminate', false);
      } else {
        selectAll.prop('checked', false).prop('indeterminate', true);
      }
    },

    getSelectedImageItems() {
      return this.getCurrentImageItems().filter((item) => this.selectedImages.has(item.src));
    },

    getSelectedImageUrls() {
      return this.getSelectedImageItems().map((item) => item.src);
    },

    getAllImageItems() {
      return this.getCurrentImageItems();
    },

    getAllImageUrls() {
      return this.getAllImageItems().map((item) => item.src);
    },

    copyTextWithGM(text) {
      return imageTools.copyTextWithGM(text);
    },

    copySelectedImageUrls() {
      const urls = this.getSelectedImageUrls();
      if (!urls.length) {
        utils.notificationManager.show('请先选择要复制的图片');
        return;
      }
      const text = urls.join('\n');
      this.copyTextWithGM(text)
        .then(() => utils.notificationManager.show(`已复制 ${urls.length} 个选中图片链接到剪贴板`))
        .catch(() => {
          this.fallbackCopyText(text);
        });
    },

    copySelectedImages() {
      const items = this.getSelectedImageItems();
      if (!items.length) {
        utils.notificationManager.show('请先选择要复制的图片');
        return;
      }
      const text = items.map((item) => `![${item.fileName || 'image'}](${item.src})`).join('\n');
      this.copyTextWithGM(text)
        .then(() => utils.notificationManager.show(`已复制 ${items.length} 条图片引用`))
        .catch(() => {
          this.fallbackCopyText(text);
        });
    },

    downloadSelectedImages() {
      const items = this.getSelectedImageItems();
      if (!items.length) {
        utils.notificationManager.show('请先选择要下载的图片');
        return;
      }
      const downloadBtn = $('#downloadSelectedImages');
      if (downloadBtn.hasClass('loading')) {
        return;
      }
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${items.length} 张选中图片...`);
      imageTools.downloadImagesByUrls(items, 'selected', () => {
        downloadBtn.removeClass('loading disabled').text('下载所选图片');
      });
    },

    copyAllImageUrls() {
      const urls = this.getAllImageUrls();
      if (!urls.length) {
        utils.notificationManager.show('没有找到图片链接');
        return;
      }
      const text = urls.join('\n');
      this.copyTextWithGM(text)
        .then(() => utils.notificationManager.show(`已复制 ${urls.length} 个图片链接到剪贴板`))
        .catch(() => {
          this.fallbackCopyText(text);
        });
    },

    confirmDownloadAll(count) {
      return window.confirm(`将下载 ${count} 张图片，继续吗？`);
    },

    downloadAllImages() {
      const items = this.getAllImageItems();
      if (!items.length) {
        utils.notificationManager.show('当前页面没有找到图片');
        return;
      }
      if (!this.confirmDownloadAll(items.length)) {
        return;
      }

      const downloadBtn = $('#downloadAllImages');
      if (downloadBtn.hasClass('loading')) {
        return;
      }
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${items.length} 张图片...`);
      imageTools.downloadImagesByUrls(items, 'all', () => {
        downloadBtn.removeClass('loading disabled').text('下载所有图片');
      });
    },

    copySingleImageUrl(src) {
      if (!src) {
        utils.notificationManager.show('获取图片链接失败');
        return;
      }
      this.copyTextWithGM(src)
        .then(() => utils.notificationManager.show('图片链接已复制到剪贴板'))
        .catch(() => {
          this.fallbackCopyText(src);
        });
    },

    downloadSingleImage(image, index) {
      if (!image?.src) {
        utils.notificationManager.show('获取图片链接失败');
        return;
      }
      const downloadBtn = $('.image-action-btn.download-btn').filter((_, button) => button.dataset.src === image.src);
      if (downloadBtn.hasClass('loading')) {
        return;
      }
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show('开始下载单张图片...');
      imageTools.downloadSingleImageByUrl(image, index, () => {
        downloadBtn.removeClass('loading disabled').text('下载图片');
      });
    },

    fallbackCopyText(text) {
      imageTools.fallbackCopyText(text);
    },

    fallbackCopyText2(text) {
      imageTools.fallbackCopyText2(text);
    },

    hide() {
      const wasLoading = this.isLoading;
      this.loadCancelled = true;
      this.loadToken += 1;
      this.isLoading = false;
      this.clearPendingWork();
      this.hideScanBanner?.();
      $('#imagePreviewOverlay, #imagePreviewPanel').hide();
      $('#imagePreviewContent').empty();
      $('#selectAllImages').prop('checked', false).prop('indeterminate', false);
      this.selectedImages.clear();
      this.visibleImages = [];
      this.setScrollTop(this.originalScrollTop || 0);
      if (wasLoading) {
        utils.notificationManager.show('已取消全书图片加载');
      }
    }
  };
}
