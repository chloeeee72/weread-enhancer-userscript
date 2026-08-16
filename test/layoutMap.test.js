import test from 'node:test';
import assert from 'node:assert/strict';
import { getOffsetAfterY, getOffsetAtY, getLayoutY } from '../src/modules/reading/voiceRead/layoutMap.js';

const layout = {
  points: [
    { offset: 0, y: 100 },
    { offset: 50, y: 200 },
    { offset: 120, y: 300 }
  ]
};

test('getLayoutY maps offsets between measured points', () => {
  assert.equal(getLayoutY(layout, 0), 100);
  assert.equal(getLayoutY(layout, 50), 200);
  assert.equal(getLayoutY(layout, 120), 300);
});

test('getOffsetAtY maps a y coordinate back to the interpolated measured offset', () => {
  assert.equal(getOffsetAtY(layout, 100), 0);
  assert.equal(getOffsetAtY(layout, 250), 85);
  assert.equal(getOffsetAtY(layout, 350), 120);
});

test('getOffsetAfterY returns the first point at or after the given y', () => {
  assert.equal(getOffsetAfterY(layout, 100), 0);
  assert.equal(getOffsetAfterY(layout, 101), 50);
  assert.equal(getOffsetAfterY(layout, 200), 50);
  assert.equal(getOffsetAfterY(layout, 201), 120);
  assert.equal(getOffsetAfterY(layout, 999), 121);
});
