import { utils } from '../../utils/index.js';

function normalizeDownloadItem(item, index) {
  const normalizedIndex = index + 1;

  if (typeof item === 'string') {
    const fileName = buildFileNameFromItem({ src: item, fileName: extractFileName(item, normalizedIndex) }, index);
    return {
      src: item,
      fileName,
      chapter: 'book',
      order: index
    };
  }

  const src = item?.src || '';
  const baseItem = {
    ...item,
    src,
    chapter: item?.chapter || item?.chapters?.[0] || '',
    order: item?.order ?? index
  };

  return {
    ...baseItem,
    fileName: buildFileNameFromItem({
      ...baseItem,
      fileName: item?.fileName || extractFileName(src, normalizedIndex)
    }, index)
  };
}

function extractFileName(src, fallbackIndex) {
  if (!src) {
    return `image_${fallbackIndex}.jpg`;
  }

  try {
    const url = new URL(src, window.location.origin);
    const lastSegment = decodeURIComponent(url.pathname.split('/').pop() || '');
    if (lastSegment) {
      return lastSegment;
    }
  } catch (_error) {
    const segments = src.split('/');
    const fallback = segments[segments.length - 1];
    if (fallback) {
      return fallback;
    }
  }

  return `image_${fallbackIndex}.jpg`;
}

function isPlaceholderImageSrc(src) {
  if (!src) {
    return true;
  }

  if (src.startsWith('data:image/gif')) {
    return true;
  }

  try {
    const url = new URL(src, window.location.origin);
    const fileName = decodeURIComponent(url.pathname.split('/').pop() || '').toLowerCase();
    return fileName.startsWith('loading_') || fileName === 'loading.png' || fileName.includes('placeholder');
  } catch (_error) {
    return /loading_|placeholder/i.test(src);
  }
}

function resolveImageSource($img) {
  const candidates = [
    $img.attr('data-src'),
    $img.attr('data-original'),
    $img.attr('data-lazy-src'),
    $img.attr('data-url'),
    $img.attr('src')
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return candidates.find((src) => !isPlaceholderImageSrc(src)) || candidates[0] || '';
}

function sanitizeFileSegment(text, fallback = 'image') {
  return String(text || fallback)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || fallback;
}

function getFileExtension(src) {
  try {
    const url = new URL(src, window.location.origin);
    const match = (url.pathname || '').match(/\.([a-zA-Z0-9]{2,5})$/);
    return match ? match[1].toLowerCase() : 'jpg';
  } catch (_error) {
    return 'jpg';
  }
}

function buildFileNameFromItem(item, index) {
  const chapter = sanitizeFileSegment(item?.chapter || item?.chapters?.[0] || 'book', 'book');
  const baseName = sanitizeFileSegment(item?.fileName || `image_${index + 1}`, `image_${index + 1}`);
  const ext = baseName.includes('.') ? '' : `.${getFileExtension(item?.src || '')}`;
  return `${String(index + 1).padStart(4, '0')}_${chapter}_${baseName}${ext}`;
}

const imageTools = {
  observer: null,

  init() {
    this.observeImages();
  },

  observeImages() {
    if (this.observer) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type !== 'childList') {
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            this.processImageNode(node);
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      $('img.wr_readerImage_opacity').each((_, img) => this.addImageToolbar(img));
    }, 1000);
  },

  processImageNode(node) {
    if (node.tagName === 'IMG' && node.classList.contains('wr_readerImage_opacity')) {
      this.addImageToolbar(node);
    }

    $(node).find('img.wr_readerImage_opacity').each((_, img) => {
      this.addImageToolbar(img);
    });
  },

  addImageToolbar(img) {
    const $img = $(img);
    const src = resolveImageSource($img);

    if (!src || $img.data('toolbar-added')) {
      return;
    }
    $img.data('toolbar-added', true);

    const toolbarContainer = $(`
      <div class="image-toolbar-container">
        <div class="image-toolbar">
          <button class="image-tool-btn download-btn" title="下载图片">
            <span class="image-tool-icon">↓</span>
          </button>
          <button class="image-tool-btn copy-btn" title="复制链接">
            <span class="image-tool-icon">⧉</span>
          </button>
          <button class="image-tool-btn open-btn" title="新标签页打开">
            <span class="image-tool-icon">↗</span>
          </button>
        </div>
      </div>
    `);

    const isDoubleColumn = $img.closest('.passageContent_wrapper').length > 0;
    const isSingleColumn = $img.closest('.passage-content').length > 0;
    let parentContainer;

    if (isDoubleColumn) {
      parentContainer = $img.closest('.passageContent_wrapper');
      parentContainer.append(toolbarContainer);
    } else if (isSingleColumn) {
      parentContainer = $img.closest('.passage-content');
      parentContainer.css('position', 'relative');
      toolbarContainer.css({
        position: 'absolute',
        left: `${img.getBoundingClientRect().width}px`,
        display: 'flex',
        transform: $img.css('transform')
      });
      parentContainer.append(toolbarContainer);
    } else {
      $img.after(toolbarContainer);
    }

    this.bindToolbarEvents(toolbarContainer, src);
  },

  bindToolbarEvents(toolbarContainer, src) {
    const downloadBtn = toolbarContainer.find('.download-btn');
    const copyBtn = toolbarContainer.find('.copy-btn');
    const openBtn = toolbarContainer.find('.open-btn');

    downloadBtn.on('click', () => {
      if (downloadBtn.hasClass('disabled') || downloadBtn.hasClass('loading')) {
        return;
      }

      downloadBtn
        .addClass('loading disabled')
        .attr('title', '下载中...')
        .find('.image-tool-icon')
        .text('…');

      this.downloadImage(src, () => {
        setTimeout(() => {
          downloadBtn
            .removeClass('loading disabled')
            .attr('title', '下载图片')
            .find('.image-tool-icon')
            .text('↓');
        }, 1000);
      });
    });

    copyBtn.on('click', () => {
      this.copyImageUrl(src);
    });

    openBtn.on('click', () => {
      this.openImage(src);
    });

    const $img = toolbarContainer.prev('img.wr_readerImage_opacity');
    if ($img.length) {
      $img.hover(
        () => toolbarContainer.show(),
        () => setTimeout(() => !toolbarContainer.is(':hover') && toolbarContainer.hide(), 100)
      );
    }

    toolbarContainer.hover(
      () => toolbarContainer.show(),
      () => toolbarContainer.hide()
    );
  },

  downloadImage(src, callback) {
    if (!src) {
      callback?.();
      return;
    }

    const fileName = extractFileName(src, 1);
    try {
      GM_download({
        url: src,
        name: fileName,
        onload: () => {
          utils.notificationManager.show('图片下载成功');
          callback?.();
        },
        onerror: (error) => {
          utils.notificationManager.show(`图片下载失败: ${error.error}`);
          callback?.();
        }
      });
    } catch (_error) {
      this.downloadImageFallback(src, fileName);
      callback?.();
    }
  },

  downloadImageFallback(src, fileName) {
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    utils.notificationManager.show('图片下载成功');
  },

  openImage(src) {
    if (src) {
      window.open(src, '_blank');
    }
  },

  copyImageUrl(src) {
    if (!src) {
      return;
    }

    this.copyTextWithGM(src)
      .then(() => utils.notificationManager.show('图片链接已复制到剪贴板'))
      .catch(() => {
        this.fallbackCopyText(src);
      });
  },

  copyTextWithGM(text) {
    return new Promise((resolve, reject) => {
      try {
        const result = GM_setClipboard(text, 'text/plain');
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  fallbackCopyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
          .then(() => utils.notificationManager.show('图片链接已复制到剪贴板'))
          .catch(() => this.fallbackCopyText2(text));
      } else {
        this.fallbackCopyText2(text);
      }
    } catch {
      this.fallbackCopyText2(text);
    }
  },

  fallbackCopyText2(text) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        utils.notificationManager.show('图片链接已复制到剪贴板');
      } else {
        utils.notificationManager.show('复制失败，请手动复制链接');
      }
    } catch {
      utils.notificationManager.show('复制失败，请手动复制链接');
    }
  },

  downloadImagesByUrls(items, _type = 'all', callback) {
    const normalizedItems = (items || []).map((item, index) => normalizeDownloadItem(item, index));
    if (!normalizedItems.length) {
      return;
    }

    let downloaded = 0;
    let hasError = false;

    normalizedItems.forEach((item, index) => {
      setTimeout(() => {
        this.downloadSingleImageByUrl(item, index, (success) => {
          if (!success) {
            hasError = true;
          }
          downloaded += 1;
          if (downloaded === normalizedItems.length) {
            callback?.();
            if (hasError) {
              utils.notificationManager.show(`图片下载完成，部分图片下载失败 (${downloaded}/${normalizedItems.length})`);
            } else {
              utils.notificationManager.show(`所有图片下载完成 (${downloaded}/${normalizedItems.length})`);
            }
          }
        });
      }, index * 1000);
    });
  },

  downloadSingleImageByUrl(item, index, callback, attempt = 0) {
    const normalizedItem = normalizeDownloadItem(item, index);
    if (!normalizedItem.src) {
      callback?.(false);
      return;
    }

    try {
      GM_download({
        url: normalizedItem.src,
        name: normalizedItem.fileName,
        onload: () => callback?.(true),
        onerror: () => {
          if (attempt < 2) {
            setTimeout(() => {
              this.downloadSingleImageByUrl(normalizedItem, index, callback, attempt + 1);
            }, 500 * (attempt + 1));
            return;
          }
          callback?.(false);
        }
      });
    } catch (_error) {
      this.downloadImageFallback(normalizedItem.src, normalizedItem.fileName);
      callback?.(true);
    }
  },

  downloadImagesBatch(images, callback) {
    let downloaded = 0;
    const total = images.length;
    let hasError = false;

    images.each((index, img) => {
      const src = resolveImageSource($(img));
      if (!src) {
        downloaded += 1;
        if (downloaded === total) {
          callback?.();
        }
        return;
      }

      setTimeout(() => {
        this.downloadSingleImageByUrl(src, index, (success) => {
          if (!success) {
            hasError = true;
          }
          downloaded += 1;
          if (downloaded === total) {
            if (hasError) {
              utils.notificationManager.show(`图片下载完成，部分图片下载失败 (${downloaded}/${total})`);
            } else {
              utils.notificationManager.show(`所有图片下载完成 (${downloaded}/${total})`);
            }
            callback?.();
          }
        });
      }, index * 1000);
    });
  }
};

export { imageTools };
