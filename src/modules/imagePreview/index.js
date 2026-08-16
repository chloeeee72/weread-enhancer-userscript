import { createImagePreviewPanelMethods } from './panel.js';
import { createImagePreviewGalleryMethods } from './gallery.js';
import { createImagePreviewActionMethods } from './actions.js';
import { IMAGE_PREVIEW_CONFIG } from '../../constants.js';

const imagePreviewPanel = {
  selectedImages: new Set(),
  allImages: [],
  visibleImages: [],
  chapterFilters: [],
  activeFilter: 'all',
  isInitialized: false,
  isLoading: false,
  chapterIndexReady: false,
  loadCancelled: false,
  loadToken: 0,
  originalScrollTop: 0,
  currentTheme: 'light',
  themeObserver: null,
  themeFramePending: false,
  pendingTimeouts: new Set(),
  pendingWaits: new Set(),
  collectionCache: new Map(),
  collectionCacheLimit: IMAGE_PREVIEW_CONFIG.collectionCacheLimit,
  collectionCacheImageLimit: IMAGE_PREVIEW_CONFIG.collectionCacheImageLimit,
  imageResourceCache: new Map(),
  imageResourceQueue: new Map(),
  imageResourceCacheLimit: IMAGE_PREVIEW_CONFIG.imageResourceCacheLimit,
  ...createImagePreviewPanelMethods(),
  ...createImagePreviewGalleryMethods(),
  ...createImagePreviewActionMethods()
};

export { imagePreviewPanel };
