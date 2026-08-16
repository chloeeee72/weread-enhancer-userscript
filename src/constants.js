export const DEFAULT_WIDTH = 800;

export const IMAGE_PREVIEW_CONFIG = {
  // 最多保留多少本书的整本图片缓存，超出后按最久未使用淘汰。
  collectionCacheLimit: 6,
  // 单本书最多缓存多少张图片，限制内存占用。
  collectionCacheImageLimit: 1500,
  // 缩略图资源在内存中的缓存上限。
  imageResourceCacheLimit: 120,
  // 首屏和后续批量渲染时，每次预热/渲染多少张图片。
  preloadBatchSize: 24,
  // 每批渲染前，额外向后预读多少张图片资源。
  preloadAheadCount: 18,
  // 扫描整本书时允许的最大滚动轮次，防止异常页面无限扫描。
  collectionMaxRounds: 1200,
  // 每次等待新内容加载时，最多重试多少次。
  growthWaitAttempts: 6,
  // 等待图片/章节继续加载的基础时长。
  growthWaitBaseMs: 220,
  // 每次重试递增的等待时长。
  growthWaitStepMs: 40,
  // 每轮向下滚动的最小像素值。
  scrollStepMinPx: 320,
  // 每轮滚动步长占当前视口高度的比例。
  scrollStepViewportRatio: 0.85,
  // 连续触底多少轮后，认为已接近扫描终点。
  stableBottomRounds: 4,
  // 连续多少轮没有新内容增长后，停止继续扫描。
  stalledRounds: 3
};

export const EYE_PROTECTION_COLORS = {
  white: {
    name: '白色',
    color: 'rgba(255,255,255,1)',
    className: 'eye-protection-white'
  },
  green: {
    name: '绿色',
    color: 'rgba(216,226,200,1)',
    className: 'eye-protection-green'
  },
  yellow: {
    name: '黄色',
    color: 'rgba(240,234,214,1)',
    className: 'eye-protection-yellow'
  },
  blue: {
    name: '蓝色',
    color: 'rgba(200,220,240,1)',
    className: 'eye-protection-blue'
  },
  pink: {
    name: '粉色',
    color: 'rgba(255,230,230,1)',
    className: 'eye-protection-pink'
  },
  purple: {
    name: '紫色',
    color: 'rgba(230,220,250,1)',
    className: 'eye-protection-purple'
  },
  gray: {
    name: '灰色',
    color: 'rgba(240,240,240,1)',
    className: 'eye-protection-gray'
  }
};
