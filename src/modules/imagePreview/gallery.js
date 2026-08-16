import { utils } from '../../utils/index.js';
import { IMAGE_PREVIEW_CONFIG } from '../../constants.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createImagePreviewGalleryMethods() {
  return {
    getBookCacheKey() {
      const candidates = [
        $('.readerTopBar_title_link').text(),
        $('.readerTopBar_bookInfo_title').text(),
        $('.readerCatalog_bookInfo_title').text(),
        document.title,
        window.location.pathname
      ];

      return candidates
        .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
        .find(Boolean) || window.location.pathname;
    },

    cloneImageEntry(image, index = 0) {
      return {
        ...image,
        chapters: Array.isArray(image?.chapters) ? image.chapters.slice() : [],
        displayIndex: image?.displayIndex ?? index + 1
      };
    },

    cloneImageList(images) {
      return (images || []).map((image, index) => this.cloneImageEntry(image, index));
    },

    mergeChapterFilters(...groups) {
      const merged = [];
      const seen = new Set();

      groups.flat().forEach((chapter) => {
        const normalized = String(chapter || '').trim();
        if (!normalized || seen.has(normalized)) {
          return;
        }
        seen.add(normalized);
        merged.push(normalized);
      });

      return merged;
    },

    mergeImageCollections(...groups) {
      const imageMap = new Map();

      groups.flat().forEach((image) => {
        if (!image?.src) {
          return;
        }

        const chapters = Array.isArray(image.chapters)
          ? image.chapters
          : (image.chapter ? [image.chapter] : []);
        const existing = imageMap.get(image.src);
        if (!existing) {
          imageMap.set(image.src, {
            ...image,
            chapters: this.mergeChapterFilters(chapters),
            duplicateCount: Math.max(image.duplicateCount || 1, chapters.length || 1),
            order: Number.isFinite(image.order) ? image.order : imageMap.size + 1
          });
          return;
        }

        const mergedChapters = this.mergeChapterFilters(existing.chapters, chapters);
        imageMap.set(image.src, {
          ...existing,
          ...image,
          width: Math.max(existing.width || 0, image.width || 0),
          height: Math.max(existing.height || 0, image.height || 0),
          chapter: existing.chapter || image.chapter || mergedChapters[0] || '',
          chapters: mergedChapters,
          duplicateCount: Math.max(
            existing.duplicateCount || 1,
            image.duplicateCount || 1,
            mergedChapters.length || 1
          ),
          order: Math.min(
            Number.isFinite(existing.order) ? existing.order : Number.MAX_SAFE_INTEGER,
            Number.isFinite(image.order) ? image.order : Number.MAX_SAFE_INTEGER
          ),
          fileName: existing.fileName || image.fileName
        });
      });

      return this.sanitizeCollectedImages(
        Array.from(imageMap.values()).sort((left, right) => (left.order || 0) - (right.order || 0))
      );
    },

    sortImagesNewestFirst(images) {
      return this.sanitizeCollectedImages(
        [...(images || [])].sort((left, right) => {
          const leftOrder = Number.isFinite(left?.order) ? left.order : 0;
          const rightOrder = Number.isFinite(right?.order) ? right.order : 0;
          return rightOrder - leftOrder;
        })
      );
    },

    buildScanStatsMarkup(discoveredCount, loadedCount, estimatedText) {
      return `
        <span class="image-preview-scan-count image-preview-scan-count-discovered">已发现 ${discoveredCount}</span>
        <span class="image-preview-scan-count image-preview-scan-count-loaded">已加载 ${loadedCount}</span>
        <span class="image-preview-scan-eta">预计 ${estimatedText || '--:--'}</span>
      `;
    },

    buildCompletedScanStatsMarkup(discoveredCount, loadedCount) {
      return `
        <span class="image-preview-scan-count image-preview-scan-count-discovered">已发现 ${discoveredCount}</span>
        <span class="image-preview-scan-count image-preview-scan-count-loaded">已加载 ${loadedCount}</span>
      `;
    },

    getLoadedImageCount(state) {
      return Math.max(0, Number(state?.loadedCount) || 0);
    },

    getDiscoveredImageCount(state) {
      const loadedCount = this.getLoadedImageCount(state);
      const loadedSourceSet = state?.loadedSourceSet || new Set();
      const currentImages = this.sanitizeCollectedImages(state?.images || []);
      const extraCount = currentImages.reduce((count, image) => {
        if (!image?.src || loadedSourceSet.has(image.src)) {
          return count;
        }
        return count + 1;
      }, 0);

      return loadedCount + extraCount;
    },

    showScanBanner(title, discoveredCount, loadedCount, estimatedText, progress, statusText) {
      $('#imagePreviewScanBanner').removeClass('is-complete').addClass('is-visible').show();
      $('#imagePreviewScanTitle').text(title || '正在扫描图片');
      $('#imagePreviewScanMeta').html(this.buildScanStatsMarkup(discoveredCount, loadedCount, estimatedText));
      $('#imagePreviewScanFill').css('width', `${Math.max(0, Math.min(100, progress || 0))}%`);
      $('#imagePreviewScanStatus').text(statusText || '正在扫描...');
    },

    showCompletedScanBanner(discoveredCount, loadedCount, statusText = '扫描完成') {
      $('#imagePreviewScanBanner').addClass('is-visible is-complete').show();
      $('#imagePreviewScanTitle').text('扫描完成');
      $('#imagePreviewScanMeta').html(this.buildCompletedScanStatsMarkup(discoveredCount, loadedCount));
      $('#imagePreviewScanFill').css('width', '100%');
      $('#imagePreviewScanStatus').empty();
    },

    hideScanBanner() {
      $('#imagePreviewScanBanner').removeClass('is-visible').hide();
    },

    readCollectionCache() {
      const cacheKey = this.getBookCacheKey();
      const cached = this.collectionCache.get(cacheKey);
      if (!cached?.images?.length) {
        return null;
      }

      this.collectionCache.delete(cacheKey);
      this.collectionCache.set(cacheKey, cached);

      return {
        chapterFilters: Array.isArray(cached.chapterFilters) ? cached.chapterFilters.slice() : [],
        images: this.cloneImageList(cached.images)
      };
    },

    writeCollectionCache(images, chapterFilters) {
      const normalizedImages = this.cloneImageList(images);
      const trimmedImages = normalizedImages.slice(0, this.collectionCacheImageLimit);
      const cacheKey = this.getBookCacheKey();

      if (this.collectionCache.has(cacheKey)) {
        this.collectionCache.delete(cacheKey);
      }

      this.collectionCache.set(cacheKey, {
        images: trimmedImages,
        chapterFilters: Array.isArray(chapterFilters) ? chapterFilters.slice() : []
      });

      while (this.collectionCache.size > this.collectionCacheLimit) {
        const oldestKey = this.collectionCache.keys().next().value;
        if (!oldestKey) {
          break;
        }
        this.collectionCache.delete(oldestKey);
      }
    },

    getDisplayImageCount(images) {
      return this.sanitizeCollectedImages(images || []).length;
    },

    touchImageResourceCache(src, resource) {
      if (!src || !resource) {
        return;
      }

      if (this.imageResourceCache.has(src)) {
        this.imageResourceCache.delete(src);
      }

      this.imageResourceCache.set(src, resource);
      while (this.imageResourceCache.size > this.imageResourceCacheLimit) {
        const oldestKey = this.imageResourceCache.keys().next().value;
        if (!oldestKey) {
          break;
        }
        this.imageResourceCache.delete(oldestKey);
      }
    },

    preloadImageResource(src) {
      if (!src) {
        return Promise.resolve('');
      }

      const cached = this.imageResourceCache.get(src);
      if (cached) {
        this.touchImageResourceCache(src, cached);
        return Promise.resolve(cached);
      }

      const pending = this.imageResourceQueue.get(src);
      if (pending) {
        return pending;
      }

      const task = new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        image.decoding = 'async';

        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          this.imageResourceQueue.delete(src);
          this.touchImageResourceCache(src, image);
          resolve(src);
        };

        image.onload = finish;
        image.onerror = finish;
        image.src = src;
        if (image.complete) {
          finish();
        }
      });

      this.imageResourceQueue.set(src, task);
      return task;
    },

    warmVisibleImageResources(images, startIndex = 0, count = IMAGE_PREVIEW_CONFIG.preloadAheadCount) {
      const visibleImages = Array.isArray(images) ? images : [];
      const endIndex = Math.min(startIndex + count, visibleImages.length);
      for (let index = startIndex; index < endIndex; index += 1) {
        this.preloadImageResource(visibleImages[index]?.src);
      }
    },

    createCancelError() {
      const error = new Error('IMAGE_PREVIEW_CANCELLED');
      error.code = 'IMAGE_PREVIEW_CANCELLED';
      return error;
    },

    isCancelError(error) {
      return error && (error.code === 'IMAGE_PREVIEW_CANCELLED' || error.message === 'IMAGE_PREVIEW_CANCELLED');
    },

    isActiveToken(token) {
      return !this.loadCancelled && this.loadToken === token;
    },

    queueTimeout(handler, delay) {
      const timerId = setTimeout(() => {
        this.pendingTimeouts.delete(timerId);
        handler();
      }, delay);
      this.pendingTimeouts.add(timerId);
      return timerId;
    },

    clearPendingWork() {
      this.pendingTimeouts.forEach((timerId) => clearTimeout(timerId));
      this.pendingTimeouts.clear();
      this.pendingWaits.forEach((task) => {
        clearTimeout(task.timerId);
        task.reject(this.createCancelError());
      });
      this.pendingWaits.clear();
    },

    wait(ms, token) {
      return new Promise((resolve, reject) => {
        if (!this.isActiveToken(token)) {
          reject(this.createCancelError());
          return;
        }

        const waitTask = { timerId: null, reject };
        waitTask.timerId = setTimeout(() => {
          this.pendingWaits.delete(waitTask);
          if (!this.isActiveToken(token)) {
            reject(this.createCancelError());
            return;
          }
          resolve();
        }, ms);
        this.pendingWaits.add(waitTask);
      });
    },

    getScrollRoot() {
      return document.scrollingElement || document.documentElement || document.body;
    },

    getScrollMetrics() {
      const root = this.getScrollRoot();
      const viewportHeight = window.innerHeight || root.clientHeight || 0;
      const scrollTop = window.scrollY || root.scrollTop || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const scrollHeight = Math.max(
        root.scrollHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0,
        viewportHeight
      );

      return {
        scrollTop,
        viewportHeight,
        scrollHeight,
        maxScrollTop: Math.max(0, scrollHeight - viewportHeight)
      };
    },

    setScrollTop(top) {
      const nextTop = Math.max(0, Math.round(top || 0));
      window.scrollTo(0, nextTop);
      const root = this.getScrollRoot();
      if (root) {
        root.scrollTop = nextTop;
      }
    },

    triggerReaderLoad() {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('scroll'));
    },

    getTimeText(seconds) {
      const safe = Math.max(0, Math.round(seconds || 0));
      return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
    },

    getCurrentChapterLabel() {
      return (
        $('.readerTopBar_title_chapter').text()
        || $('.readerTopBar_title_link').text()
        || $('.readerCatalog_currentChapter').text()
        || ''
      ).trim() || '未命名章节';
    },

    discoverChapterLabelsFromDom() {
      const selectors = [
        '.readerCatalog_list a',
        '.readerCatalog_list li',
        '.readerCatalog_list button',
        '[class*="readerCatalog"] a',
        '[class*="readerCatalog"] li',
        '[class*="readerCatalog"] button',
        '[class*="chapter"] a',
        '[class*="chapter"] li',
        '[class*="chapter"] button'
      ];

      const labels = [];
      const seen = new Set();
      selectors.forEach((selector) => {
        $(selector).each((_, node) => {
          const text = $(node).clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
          if (!text || text.length > 80) {
            return;
          }
          if (text === this.getCurrentChapterLabel() || seen.has(text)) {
            return;
          }
          seen.add(text);
          labels.push(text);
        });
      });

      const current = this.getCurrentChapterLabel();
      if (current && !seen.has(current)) {
        labels.unshift(current);
      }

      return labels;
    },

    getImageSelectors() {
      return [
        '.readerChapterContent img',
        '.readerChapterContent_container img',
        '.wr_horizontalReader_app_content img',
        '.app_content img'
      ].join(', ');
    },

    getCandidateImages() {
      return $(this.getImageSelectors()).filter((_, img) => {
        const $img = $(img);
        return !$img.closest('.image-preview-panel, .image-toolbar-container, .control-panel, .readerControls, .readerTopBar').length;
      });
    },

    getImageDimensions($img) {
      const el = $img[0];
      return {
        width: el?.naturalWidth || $img.width() || el?.width || Number($img.attr('width')) || 0,
        height: el?.naturalHeight || $img.height() || el?.height || Number($img.attr('height')) || 0
      };
    },

    getImageSizeText(image) {
      const width = image?.width || 0;
      const height = image?.height || 0;
      return width && height ? `${width}x${height}` : '尺寸未知';
    },

    isPlaceholderImageSrc(src) {
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
    },

    resolveImageSource($img) {
      const candidates = [
        $img.attr('data-src'),
        $img.attr('data-original'),
        $img.attr('data-lazy-src'),
        $img.attr('data-url'),
        $img.attr('src')
      ].map((value) => String(value || '').trim()).filter(Boolean);

      return candidates.find((src) => !this.isPlaceholderImageSrc(src)) || candidates[0] || '';
    },

    isBlankImage($img, src) {
      if (!src || this.isPlaceholderImageSrc(src)) {
        return true;
      }
      const dimensions = this.getImageDimensions($img);
      return !dimensions.width || !dimensions.height || dimensions.width <= 4 || dimensions.height <= 4;
    },

    extractFileName(src, fallbackIndex) {
      try {
        const url = new URL(src, window.location.origin);
        const lastSegment = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (lastSegment) {
          return lastSegment;
        }
      } catch {
        // 解析失败时使用兜底文件名
      }
      return `image_${fallbackIndex}.jpg`;
    },

    shouldDropTrailingImage(image) {
      if (!image?.src) {
        return true;
      }

      if (this.isPlaceholderImageSrc(image.src)) {
        return true;
      }

      const fileName = String(image.fileName || '').toLowerCase();
      if (/loading|placeholder/.test(fileName)) {
        return true;
      }

      return false;
    },

    sanitizeCollectedImages(images) {
      if (!Array.isArray(images) || !images.length) {
        return [];
      }

      const sanitized = images.filter((item) => item && item.src);
      while (sanitized.length > 0 && this.shouldDropTrailingImage(sanitized[sanitized.length - 1])) {
        sanitized.pop();
      }

      return sanitized.map((item, index) => ({
        ...item,
        displayIndex: index + 1
      }));
    },

    getRenderableImageSrc(src) {
      if (!src) {
        return '';
      }

      const cached = this.imageResourceCache.get(src);
      if (cached) {
        this.touchImageResourceCache(src, cached);
        return src;
      }

      return src;
    },

    buildImageEntry($img, src, chapter, state) {
      const dimensions = this.getImageDimensions($img);
      return {
        src,
        width: dimensions.width,
        height: dimensions.height,
        chapter,
        chapters: chapter ? [chapter] : [],
        duplicateCount: 1,
        order: state.sequence++,
        fileName: this.extractFileName(src, state.sequence)
      };
    },

    collectImageNodes(state) {
      const chapter = this.getCurrentChapterLabel();
      if (chapter && !state.chapterSet.has(chapter)) {
        state.chapterSet.add(chapter);
        state.chapterOrder.push(chapter);
        this.chapterFilters = state.chapterOrder.slice();
        this.renderChapterButtons(state.chapterOrder, { loading: true });
      }

      this.getCandidateImages().each((_, img) => {
        if (state.visitedNodes.has(img)) {
          return;
        }

        const $img = $(img);
        const src = this.resolveImageSource($img);
        if (this.isBlankImage($img, src)) {
          return;
        }
        state.visitedNodes.add(img);

        const existing = state.imageMap.get(src);
        if (existing) {
          if (chapter && !existing.chapters.includes(chapter)) {
            existing.chapters.push(chapter);
            existing.duplicateCount = existing.chapters.length;
          } else {
            existing.duplicateCount += 1;
          }
          return;
        }

        const entry = this.buildImageEntry($img, src, chapter || '未命名章节', state);
        state.imageMap.set(entry.src, entry);
        state.images.push(entry);
      });

    },

    estimateProgress() {
      const metrics = this.getScrollMetrics();
      if (metrics.maxScrollTop <= 0) {
        return 0;
      }
      return Math.min(99, Math.max(0, (metrics.scrollTop / metrics.maxScrollTop) * 100));
    },

    setLoadingView(imageCount, estimatedText, progress, statusText = '正在准备扫描章节与图片...') {
      $('#imagePreviewContent').html(`
        <div class="image-preview-loading">
          <div class="image-preview-loading-title">正在加载全书图片</div>
          <div class="image-preview-loading-stats" id="imagePreviewLoadingStats">图片 ${imageCount} | 预计 ${estimatedText}</div>
          <div class="image-preview-loading-bar">
            <div class="image-preview-loading-fill" id="imagePreviewLoadingFill" style="width:${progress}%"></div>
          </div>
          <div class="image-preview-loading-status" id="imagePreviewLoadingStatus">${statusText}</div>
          <div class="image-preview-loading-tip">关闭面板即可取消抓取与扫描</div>
        </div>
      `);
      this.showScanBanner('正在扫描全书图片', imageCount, 0, estimatedText, progress, statusText);
      this.updateStats(0);
    },

    updateLoadingView(imageCount, estimatedText, progress, statusText = '', loadedCount = imageCount) {
      $('#imagePreviewLoadingStats').text(`图片 ${imageCount} | 预计 ${estimatedText}`);
      $('#imagePreviewLoadingFill').css('width', `${Math.max(0, Math.min(100, progress))}%`);
      $('#imagePreviewLoadingStatus').text(statusText || '正在扫描...');
      this.showScanBanner(
        '正在扫描全书图片',
        imageCount,
        loadedCount,
        estimatedText,
        progress,
        statusText || '正在扫描...'
      );
      this.updateStats(loadedCount);
    },

    updateCollectionProgress(state, progress, statusText) {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const eta = progress > 0 ? Math.max(1, elapsed * (100 / progress - 1)) : 0;
      const discoveredCount = this.getDiscoveredImageCount(state);
      const loadedCount = this.getLoadedImageCount(state);
      this.updateLoadingView(
        discoveredCount,
        progress > 0 ? this.getTimeText(eta) : '--:--',
        progress,
        statusText,
        loadedCount
      );
    },

    async waitForGrowth(token, state, baseline) {
      let hasGrowth = false;
      for (let attempt = 0; attempt < IMAGE_PREVIEW_CONFIG.growthWaitAttempts; attempt += 1) {
        await this.wait(
          IMAGE_PREVIEW_CONFIG.growthWaitBaseMs + attempt * IMAGE_PREVIEW_CONFIG.growthWaitStepMs,
          token
        );
        this.triggerReaderLoad();
        this.collectImageNodes(state);
        const metrics = this.getScrollMetrics();
        const imageGrowth = state.images.length > baseline.imageCount;
        const scrollGrowth = metrics.scrollHeight > baseline.scrollHeight + 4;
        if (imageGrowth || scrollGrowth) {
          baseline.imageCount = state.images.length;
          baseline.scrollHeight = metrics.scrollHeight;
          hasGrowth = true;
        }
        this.updateCollectionProgress(
          state,
          this.estimateProgress(),
          `已发现 ${this.getDisplayImageCount(state.images)} 张图片`
        );
        if (hasGrowth && attempt >= 1) {
          break;
        }
      }
      return hasGrowth;
    },

    async startBookImageCollection(token) {
      const cachedImages = this.readCollectionCache()?.images || [];
      const state = {
        visitedNodes: new WeakSet(),
        imageMap: new Map(),
        images: [],
        chapterSet: new Set(),
        chapterOrder: [],
        sequence: 1,
        startTime: Date.now(),
        loadedCount: this.getDisplayImageCount(cachedImages),
        loadedSourceSet: new Set(cachedImages.map((image) => image?.src).filter(Boolean))
      };

      const startScrollTop = this.originalScrollTop;
      const step = Math.max(
        IMAGE_PREVIEW_CONFIG.scrollStepMinPx,
        Math.floor((window.innerHeight || 900) * IMAGE_PREVIEW_CONFIG.scrollStepViewportRatio)
      );
      let round = 0;
      let stableBottomRounds = 0;
      let stalledRounds = 0;
      let lastImageCount = 0;
      let lastScrollHeight = this.getScrollMetrics().scrollHeight;

      try {
        const domChapters = this.discoverChapterLabelsFromDom();
        if (domChapters.length) {
          this.renderChapterButtons(domChapters, { loading: true });
        }

        this.collectImageNodes(state);
        this.updateCollectionProgress(state, this.estimateProgress(), '正在扫描封面与当前章节...');

        while (round < IMAGE_PREVIEW_CONFIG.collectionMaxRounds && this.isActiveToken(token)) {
          const metrics = this.getScrollMetrics();
          const nextTop = Math.min(metrics.maxScrollTop, metrics.scrollTop + step);
          const reachedBottomSoon = nextTop >= metrics.maxScrollTop - 4;

          this.setScrollTop(nextTop);
          this.triggerReaderLoad();

          const baseline = {
            imageCount: lastImageCount,
            scrollHeight: lastScrollHeight
          };
          const hasGrowth = await this.waitForGrowth(token, state, baseline);
          const afterMetrics = this.getScrollMetrics();

          stableBottomRounds = reachedBottomSoon ? stableBottomRounds + 1 : 0;

          const hasNewImages = state.images.length > lastImageCount;
          const hasNewHeight = afterMetrics.scrollHeight > lastScrollHeight + 4;
          stalledRounds = (!hasNewImages && !hasNewHeight && !hasGrowth) ? stalledRounds + 1 : 0;

          lastImageCount = state.images.length;
          lastScrollHeight = afterMetrics.scrollHeight;

          if (state.chapterOrder.length) {
            this.chapterFilters = state.chapterOrder.slice();
            this.renderChapterButtons(this.chapterFilters, { loading: true });
          }

          if (
            stableBottomRounds >= IMAGE_PREVIEW_CONFIG.stableBottomRounds
            && stalledRounds >= IMAGE_PREVIEW_CONFIG.stalledRounds
          ) {
            break;
          }
          round += 1;
        }

        this.setScrollTop(this.getScrollMetrics().maxScrollTop);
        await this.waitForGrowth(token, state, {
          imageCount: lastImageCount,
          scrollHeight: lastScrollHeight
        });
        this.collectImageNodes(state);
        this.updateCollectionProgress(
          state,
          100,
          `扫描完成，共整理 ${this.getDisplayImageCount(state.images)} 张去重图片`
        );
        this.chapterFilters = state.chapterOrder.slice();

        return this.sanitizeCollectedImages(state.images.sort((left, right) => left.order - right.order));
      } finally {
        this.setScrollTop(startScrollTop);
      }
    },

    getImageChapterText(image) {
      const chapters = image.chapters || [];
      if (!chapters.length) {
        return image.chapter || '未命名章节';
      }
      if (chapters.length === 1) {
        return chapters[0];
      }
      return `${chapters[0]} 等 ${chapters.length} 章`;
    },

    getFilteredImages() {
      const items = this.allImages.filter((item) => item && item.src);
      if (!this.activeFilter || this.activeFilter === 'all') {
        return items;
      }
      return items.filter((item) => {
        const chapters = item.chapters || [];
        return chapters.includes(this.activeFilter) || item.chapter === this.activeFilter;
      });
    },

    renderImages(images) {
      const visibleImages = images || [];
      this.visibleImages = visibleImages;
      const content = $('#imagePreviewContent').empty();
      if (!visibleImages.length) {
        this.renderEmpty(this.activeFilter && this.activeFilter !== 'all' ? '当前章节没有可用图片' : '全书未找到可用图片');
        return;
      }
      const grid = $('<div class="image-preview-grid" id="imagePreviewGrid"></div>');
      content.append(grid);
      this.warmVisibleImageResources(visibleImages, 0, IMAGE_PREVIEW_CONFIG.preloadBatchSize);
      this.renderImagesBatch(visibleImages, 0, IMAGE_PREVIEW_CONFIG.preloadBatchSize, grid, this.loadToken);
    },

    renderImagesBatch(images, startIndex, batchSize, grid, token) {
      if (!this.isActiveToken(token)) {
        return;
      }

      const endIndex = Math.min(startIndex + batchSize, images.length);
      for (let index = startIndex; index < endIndex; index += 1) {
        const image = images[index];
        const fileSize = this.getImageSizeText(image);
        const chapterText = this.getImageChapterText(image);
        const renderSrc = this.getRenderableImageSrc(image.src);
        const item = $(`
          <div class="image-preview-item" data-src="${escapeHtml(image.src)}" data-chapter="${escapeHtml(chapterText)}">
            <input type="checkbox" class="image-preview-checkbox" id="img-checkbox-${index}" data-src="${escapeHtml(image.src)}">
            <img class="image-preview-thumb" src="${escapeHtml(renderSrc)}" alt="预览图 ${index + 1}" decoding="async" loading="lazy" onerror="this.style.display='none'">
            <div class="image-preview-info">
              <div><strong>图片 ${index + 1}</strong></div>
              <div class="image-preview-meta">${escapeHtml(chapterText)}</div>
              <div class="image-preview-meta image-preview-file-name" title="${escapeHtml(image.fileName)}">${escapeHtml(image.fileName)}</div>
              <div class="image-preview-meta">${escapeHtml(fileSize)}</div>
              <div class="image-preview-meta">${image.duplicateCount > 1 ? `重复 ${image.duplicateCount} 次` : '唯一图片'}</div>
              <div class="image-action-buttons">
                <button class="image-action-btn copy-btn" data-src="${escapeHtml(image.src)}">复制链接</button>
                <button class="image-action-btn download-btn" data-src="${escapeHtml(image.src)}">下载图片</button>
              </div>
            </div>
          </div>
        `);

        const checkbox = item.find('.image-preview-checkbox');
        checkbox.on('change', (event) => {
          event.stopPropagation();
          this.toggleImageSelection(event.target.dataset.src, event.target.checked);
        });

        item.on('click', (event) => {
          if (event.target.type !== 'checkbox' && !$(event.target).hasClass('image-action-btn')) {
            checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
          }
        });

        item.find('.copy-btn').on('click', (event) => {
          event.stopPropagation();
          this.copySingleImageUrl(image.src);
        });

        item.find('.download-btn').on('click', (event) => {
          event.stopPropagation();
          this.downloadSingleImage(image, index);
        });

        grid.append(item);
      }

      this.updateSelectAllState();
      this.updateStats();

      if (endIndex < images.length && this.isActiveToken(token)) {
        this.warmVisibleImageResources(images, endIndex, batchSize || IMAGE_PREVIEW_CONFIG.preloadBatchSize);
        this.queueTimeout(() => this.renderImagesBatch(images, endIndex, batchSize, grid, token), 60);
      }
    },

    renderEmpty(message) {
      $('#imagePreviewContent').html(`<div class="image-preview-empty">${escapeHtml(message)}</div>`);
      this.updateStats();
    },

    activateChapterFilter(filter) {
      const nextFilter = filter || 'all';
      this.activeFilter = nextFilter;
      this.selectedImages.clear();
      $('#selectAllImages').prop('checked', false).prop('indeterminate', false);
      this.renderChapterButtons(this.chapterFilters || [], { loading: this.isLoading });
      this.updateStats();

      if (this.allImages.length && !this.isLoading) {
        this.renderImages(this.getFilteredImages());
        return;
      }

      if (!this.isLoading && !this.allImages.length) {
        this.setLoadingView(0, '--:--', 0, '正在准备扫描章节与图片...');
      }
    },

    show() {
      this.clearPendingWork();
      this.selectedImages.clear();
      const cachedCollection = this.readCollectionCache();
      this.allImages = this.sortImagesNewestFirst(cachedCollection?.images || []);
      this.visibleImages = [];
      this.chapterFilters = this.mergeChapterFilters(
        cachedCollection?.chapterFilters || [],
        this.discoverChapterLabelsFromDom()
      );
      this.activeFilter = 'all';
      this.originalScrollTop = this.getScrollMetrics().scrollTop;
      this.loadCancelled = false;
      this.isLoading = true;
      this.chapterIndexReady = false;
      this.applyTheme();
      $('#selectAllImages').prop('checked', false).prop('indeterminate', false);
      $('#imagePreviewOverlay').show();
      $('#imagePreviewPanel').css('display', 'flex');
      this.renderChapterButtons(this.chapterFilters, { loading: true });
      this.setLoadingView(0, '--:--', 0, '正在准备扫描章节与图片...');
      if (cachedCollection) {
        this.chapterIndexReady = true;
        this.renderImages(this.getFilteredImages());
        this.updateLoadingView(
          this.allImages.length,
          '--:--',
          0,
          '已加载缓存，正在继续扫描未加载内容...'
        );
      }

      if (cachedCollection) {
        this.showScanBanner(
          '正在补充新图片',
          this.allImages.length,
          this.allImages.length,
          '--:--',
          0,
          '已加载缓存，正在继续扫描当前已加载内容，新图片会插入到前方...'
        );
      }

      const token = ++this.loadToken;
      Promise.resolve()
        .then(() => this.startBookImageCollection(token))
        .then((images) => {
          if (!this.isActiveToken(token)) {
            return;
          }
          const nextImages = Array.isArray(images) ? images : [];
          this.isLoading = false;
          this.chapterIndexReady = true;
          this.allImages = this.sortImagesNewestFirst(
            this.mergeImageCollections(cachedCollection?.images || [], nextImages)
          );
          this.chapterFilters = this.mergeChapterFilters(
            cachedCollection?.chapterFilters || [],
            this.chapterFilters,
            nextImages.flatMap((image) => image?.chapters || (image?.chapter ? [image.chapter] : []))
          );
          if (!this.chapterFilters.length) {
            this.chapterFilters = this.discoverChapterLabelsFromDom();
          }
          this.writeCollectionCache(this.allImages, this.chapterFilters);
          this.renderChapterButtons(this.chapterFilters, { loading: false });
          this.renderImages(this.getFilteredImages());
          this.showCompletedScanBanner(
            this.allImages.length,
            this.allImages.length,
            '扫描完成'
          );
        })
        .catch((error) => {
          if (this.isCancelError(error) || this.loadToken !== token) {
            return;
          }
          this.isLoading = false;
          this.hideScanBanner();
          this.renderEmpty('图片加载失败，请稍后重试');
        })
        .finally(() => {
          if (this.loadToken === token) {
            this.isLoading = false;
            this.updateStats();
          }
        });
    }
  };
}
