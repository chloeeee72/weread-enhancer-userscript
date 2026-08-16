const MIN_FRAME_SECONDS = 1 / 240;
const MAX_FRAME_SECONDS = 0.05;
const MAX_VELOCITY = 1200;
const MAX_ACCELERATION = 3200;
const POSITION_GAIN = 7;
const VELOCITY_FILTER = 0.25;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createScrollControllerState(position = 0, target = position) {
  return {
    position,
    target,
    velocity: 0,
    targetVelocity: 0
  };
}

export function advanceScrollController(state, target, dt) {
  const seconds = clamp(Number(dt) || MIN_FRAME_SECONDS, MIN_FRAME_SECONDS, MAX_FRAME_SECONDS);
  const rawTargetVelocity = (target - state.target) / seconds;
  state.targetVelocity += (rawTargetVelocity - state.targetVelocity) * VELOCITY_FILTER;
  state.target = target;

  const error = target - state.position;
  const desiredVelocity = clamp(
    state.targetVelocity + POSITION_GAIN * error,
    -MAX_VELOCITY,
    MAX_VELOCITY
  );
  const maxVelocityChange = MAX_ACCELERATION * seconds;
  state.velocity += clamp(desiredVelocity - state.velocity, -maxVelocityChange, maxVelocityChange);

  let step = state.velocity * seconds;
  if (Math.abs(error) < 0.25 && Math.abs(state.targetVelocity) < 1) {
    step = error;
    state.velocity = 0;
  } else if (Math.sign(step) === Math.sign(error) && Math.abs(step) > Math.abs(error)) {
    step = error;
  }
  state.position += step;
  return state;
}

function getScrollRoot() {
  const doc = document.scrollingElement || document.documentElement || document.body;
  if (doc && doc.scrollHeight > doc.clientHeight + 50) return doc;
  // 部分浏览器/布局下正文滚动发生在内层容器（Chrome 尤其常见）。
  try {
    const candidates = Array.from(document.querySelectorAll('div, main, section, article'))
      .filter((el) => el.scrollHeight > el.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
    candidates.sort((a, b) => a.scrollHeight - b.scrollHeight);
    if (candidates.length) return candidates[0];
  } catch (error) {
    // 忽略查询失败
  }
  return doc;
}

function getScrollTop() {
  const root = getScrollRoot();
  return window.scrollY || root.scrollTop || 0;
}

function setScrollTop(top) {
  window.scrollTo(0, Math.max(0, top));
}

export { getScrollRoot };

export const scrollFollower = {
  frameId: null,
  running: false,
  getTarget: null,
  onHardError: null,
  controller: null,
  lastFrameAt: 0,
  hardErrorReported: false,
  originalScrollBehavior: null,
  alignmentResolve: null,

  disableNativeSmoothScroll() {
    const root = getScrollRoot();
    if (!root?.style) return;
    if (this.originalScrollBehavior === null) {
      this.originalScrollBehavior = root.style.scrollBehavior || '';
    }
    root.style.scrollBehavior = 'auto';
  },

  restoreNativeSmoothScroll() {
    const root = getScrollRoot();
    if (root?.style && this.originalScrollBehavior !== null) {
      root.style.scrollBehavior = this.originalScrollBehavior;
    }
    this.originalScrollBehavior = null;
  },

  start({ getTarget, onHardError } = {}) {
    this.stop();
    this.disableNativeSmoothScroll();
    this.getTarget = getTarget;
    this.onHardError = onHardError;
    const current = getScrollTop();
    const initialTarget = Number(getTarget?.());
    this.controller = createScrollControllerState(current, Number.isFinite(initialTarget) ? initialTarget : current);
    this.lastFrameAt = performance.now();
    this.hardErrorReported = false;
    this.running = true;

    const frame = (now) => {
      if (!this.running) return;
      const currentTop = getScrollTop();
      const rawTarget = Number(this.getTarget?.());
      if (Number.isFinite(rawTarget)) {
        const root = getScrollRoot();
        const maxTop = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
        const target = clamp(rawTarget, 0, maxTop);
        const error = target - currentTop;
        if (Math.abs(error) > Math.max(120, (window.innerHeight || 800) * 0.2)) {
          if (!this.hardErrorReported) {
            this.hardErrorReported = true;
            this.onHardError?.({ currentTop, target, error });
          }
        } else {
          this.hardErrorReported = false;
          const dt = (now - this.lastFrameAt) / 1000;
          this.controller.position = currentTop;
          advanceScrollController(this.controller, target, dt);
          setScrollTop(this.controller.position);
        }
      }
      this.lastFrameAt = now;
      this.frameId = window.requestAnimationFrame(frame);
    };
    this.frameId = window.requestAnimationFrame(frame);
    return { type: 'voice-follow' };
  },

  stop() {
    this.running = false;
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.getTarget = null;
    this.onHardError = null;
    this.controller = null;
    if (this.alignmentResolve) {
      const resolve = this.alignmentResolve;
      this.alignmentResolve = null;
      resolve(false);
    }
    this.restoreNativeSmoothScroll();
  },

  alignTo(rawTarget, { signal } = {}) {
    this.stop();
    this.disableNativeSmoothScroll();
    const root = getScrollRoot();
    const maxTop = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
    const start = getScrollTop();
    const target = clamp(Number(rawTarget) || 0, 0, maxTop);
    const distance = target - start;
    if (Math.abs(distance) < 1) {
      setScrollTop(target);
      this.restoreNativeSmoothScroll();
      return Promise.resolve(true);
    }

    const duration = clamp(180 + Math.abs(distance) * 0.35, 180, 700);
    const startedAt = performance.now();
    return new Promise((resolve) => {
      this.alignmentResolve = resolve;
      const finish = (success) => {
        if (this.alignmentResolve !== resolve) return;
        this.alignmentResolve = null;
        this.frameId = null;
        this.restoreNativeSmoothScroll();
        resolve(success);
      };
      const frame = (now) => {
        if (signal?.aborted) {
          finish(false);
          return;
        }
        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        setScrollTop(start + distance * eased);
        if (progress >= 1) {
          setScrollTop(target);
          finish(true);
          return;
        }
        this.frameId = window.requestAnimationFrame(frame);
      };
      this.frameId = window.requestAnimationFrame(frame);
    });
  }
};
