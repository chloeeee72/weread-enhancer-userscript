function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

let scrollbarWidth = 0;

/** 距边缘小于该像素时吸附贴边；超过则保持自由悬浮 */
const EDGE_SNAP_THRESHOLD = 60;

function getScrollbarWidth() {
  if (scrollbarWidth > 0) return scrollbarWidth;
  const outer = document.createElement('div');
  outer.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;';
  const inner = document.createElement('div');
  inner.style.width = '100%';
  outer.appendChild(inner);
  document.body.appendChild(outer);
  scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
  outer.remove();
  return scrollbarWidth;
}

function getSnapPosition(bar, left, top) {
  const width = bar.offsetWidth;
  const height = bar.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rightGap = getScrollbarWidth();
  const leftDistance = Math.abs(left);
  const rightDistance = Math.abs(viewportWidth - width - left);
  const topDistance = Math.abs(top);
  const bottomDistance = Math.abs(viewportHeight - height - top);
  const distances = [
    { edge: 'left', distance: leftDistance },
    { edge: 'right', distance: rightDistance },
    { edge: 'top', distance: topDistance },
    { edge: 'bottom', distance: bottomDistance }
  ].sort((a, b) => a.distance - b.distance);

  const edge = distances[0].edge;
  const nextLeft = edge === 'left' ? 0 : edge === 'right' ? viewportWidth - width - rightGap : clamp(left, 0, viewportWidth - width);
  const nextTop = edge === 'top' ? 0 : edge === 'bottom' ? viewportHeight - height : clamp(top, 0, viewportHeight - height);

  return { left: nextLeft, top: nextTop, edge };
}

/**
 * 校验持久化位置是否仍落在当前视口内。
 * 视口变化（窗口缩小、换显示器、滚动条宽度变化）后旧坐标可能把快捷条推到屏幕外，
 * 这类“失效位置”一律回退到默认右下角，而不是让快捷条消失。
 */
function isPositionUsable(saved) {
  if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return false;
  const width = saved.width || 140;
  const height = saved.height || 44;
  const margin = 24;
  if (saved.left < margin - width || saved.left > window.innerWidth - margin) return false;
  if (saved.top < margin - height || saved.top > window.innerHeight - margin) return false;
  return true;
}

export function initQuickBarDrag(bar) {
  const saved = GM_getValue('wr_voice_quick_position', null);
  if (isPositionUsable(saved)) {
    bar.style.left = `${saved.left}px`;
    bar.style.top = `${saved.top}px`;
    bar.style.right = 'auto';
    bar.style.bottom = 'auto';
  }

  // 旧版本可能保存了贴边自动隐藏状态。初始化时无条件清理，避免快捷条只剩一条窄边。
  bar.classList.remove('edge-hidden');
  delete bar.dataset.edge;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  bar.addEventListener('mousedown', (event) => {
    if (event.target.closest('button')) {
      return;
    }

    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    const rect = bar.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    bar.classList.add('dragging');
    event.preventDefault();
  });

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) {
      return;
    }

    const left = initialLeft + event.clientX - startX;
    const top = initialTop + event.clientY - startY;
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
    bar.style.right = 'auto';
    bar.style.bottom = 'auto';
    bar.classList.remove('edge-hidden');
    delete bar.dataset.edge;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    bar.classList.remove('dragging');
    const left = parseInt(bar.style.left, 10) || 0;
    const top = parseInt(bar.style.top, 10) || 0;
    const width = bar.offsetWidth;
    const height = bar.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 距最近边小于阈值时仅吸附，不再自动隐藏；否则保持自由悬浮。
    const minEdgeDistance = Math.min(
      Math.abs(left),
      Math.abs(viewportWidth - width - left),
      Math.abs(top),
      Math.abs(viewportHeight - height - top)
    );

    if (minEdgeDistance <= EDGE_SNAP_THRESHOLD) {
      const snap = getSnapPosition(bar, left, top);
      bar.style.left = `${snap.left}px`;
      bar.style.top = `${snap.top}px`;
      delete bar.dataset.edge;
      bar.classList.remove('edge-hidden');
      GM_setValue('wr_voice_quick_position', {
        left: snap.left,
        top: snap.top,
        edge: snap.edge,
        edgeHidden: false,
        width,
        height
      });
    } else {
      const clampedLeft = clamp(left, 0, Math.max(0, viewportWidth - width));
      const clampedTop = clamp(top, 0, Math.max(0, viewportHeight - height));
      bar.style.left = `${clampedLeft}px`;
      bar.style.top = `${clampedTop}px`;
      delete bar.dataset.edge;
      bar.classList.remove('edge-hidden');
      GM_setValue('wr_voice_quick_position', {
        left: clampedLeft,
        top: clampedTop,
        edge: '',
        edgeHidden: false,
        width,
        height
      });
    }
  });

  // 供 voiceRead.showQuickBar 调用：清理旧版本遗留的隐藏状态。
  return {
    reset() {
      bar.classList.remove('edge-hidden');
      delete bar.dataset.edge;
    }
  };
}
