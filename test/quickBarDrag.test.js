import test from 'node:test';
import assert from 'node:assert/strict';

import { initQuickBarDrag } from '../src/modules/reading/voiceRead/quickBarDrag.js';

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    emit(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    }
  };
}

function installDom(savedPosition) {
  const documentTarget = createEventTarget();
  const writes = [];
  globalThis.window = { innerWidth: 1024, innerHeight: 768 };
  globalThis.document = {
    ...documentTarget,
    body: { appendChild() {} },
    createElement() {
      return {
        style: {},
        offsetWidth: 100,
        appendChild() {},
        remove() {}
      };
    }
  };
  globalThis.GM_getValue = () => savedPosition;
  globalThis.GM_setValue = (key, value) => writes.push({ key, value });
  return { documentTarget, writes };
}

function createBar({ hidden = false } = {}) {
  const target = createEventTarget();
  return {
    ...target,
    style: {},
    dataset: hidden ? { edge: 'right' } : {},
    classList: new FakeClassList(hidden ? ['edge-hidden'] : []),
    offsetWidth: 140,
    offsetHeight: 44,
    getBoundingClientRect() {
      return { left: 820, top: 680 };
    }
  };
}

test('快捷条拖拽不会恢复或触发贴边自动隐藏', () => {
  const saved = {
    left: 884,
    top: 700,
    edge: 'right',
    edgeHidden: true,
    width: 140,
    height: 44
  };
  installDom(saved);
  const restoredBar = createBar({ hidden: true });
  initQuickBarDrag(restoredBar);

  assert.equal(restoredBar.classList.contains('edge-hidden'), false);
  assert.equal(restoredBar.dataset.edge, undefined);

  const { documentTarget, writes } = installDom(null);
  const draggedBar = createBar();
  initQuickBarDrag(draggedBar);

  draggedBar.emit('mousedown', {
    clientX: 850,
    clientY: 700,
    target: { closest: () => null },
    preventDefault() {}
  });
  documentTarget.emit('mousemove', { clientX: 930, clientY: 710 });
  documentTarget.emit('mouseup');
  draggedBar.emit('mouseleave');

  assert.equal(draggedBar.style.left, '884px');
  assert.equal(draggedBar.classList.contains('edge-hidden'), false);
  assert.equal(draggedBar.dataset.edge, undefined);
  assert.equal(writes.at(-1).key, 'wr_voice_quick_position');
  assert.equal(writes.at(-1).value.edgeHidden, false);
});
