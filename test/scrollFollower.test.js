import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceScrollController,
  createScrollControllerState
} from '../src/modules/reading/voiceRead/scrollFollower.js';

test('scroll controller limits the first frame of a large correction', () => {
  const state = createScrollControllerState(0, 0);
  advanceScrollController(state, 500, 1 / 60);

  assert.ok(state.position > 0);
  assert.ok(state.position < 2, `first frame moved ${state.position}px`);
});

test('scroll controller converges without overshooting a fixed target', () => {
  const state = createScrollControllerState(0, 0);
  let previous = state.position;
  for (let frame = 0; frame < 300; frame += 1) {
    advanceScrollController(state, 200, 1 / 60);
    assert.ok(state.position >= previous - 0.001);
    assert.ok(state.position <= 200.001);
    previous = state.position;
  }

  assert.ok(Math.abs(state.position - 200) < 0.5, `remaining error ${200 - state.position}px`);
});

test('scroll controller follows a moving target with bounded frame steps', () => {
  const state = createScrollControllerState(0, 0);
  let maxStep = 0;
  for (let frame = 1; frame <= 240; frame += 1) {
    const previous = state.position;
    advanceScrollController(state, frame * 0.8, 1 / 60);
    maxStep = Math.max(maxStep, Math.abs(state.position - previous));
  }

  assert.ok(maxStep < 8, `max frame step ${maxStep}px`);
  assert.ok(Math.abs(state.position - 192) < 20);
});
