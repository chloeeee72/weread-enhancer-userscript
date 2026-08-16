import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechClock } from '../src/modules/reading/voiceRead/speechClock.js';

function createClock() {
  const clock = new SpeechClock();
  clock.configure({
    chunks: [{ text: '甲'.repeat(100), startOffset: 20, endOffset: 120 }],
    rate: 1,
    fallbackCps: 5,
    rangeStart: 20,
    rangeEnd: 120
  });
  clock.startChunk(0, 1000);
  return clock;
}

function sampleUntil(clock, from, to, step = 16) {
  let value = clock.getOffset(from);
  for (let now = from + step; now <= to; now += step) value = clock.getOffset(now);
  return clock.getOffset(to) || value;
}

test('speech clock advances continuously from first chunk', () => {
  const clock = createClock();
  const offset = sampleUntil(clock, 1000, 2000);

  assert.ok(offset > 24 && offset < 27, `unexpected offset ${offset}`);
});

test('boundary observation does not snap current position', () => {
  const clock = createClock();
  const before = sampleUntil(clock, 1000, 1600);
  clock.observeBoundary(0, 8, 1600);
  const after = clock.getOffset(1600);

  assert.equal(after, before);
  assert.equal(clock.getConfirmedOffset(), 28);
  assert.ok(sampleUntil(clock, 1600, 2000) > after);
});

test('chunk end observation does not force a percentage jump', () => {
  const clock = createClock();
  const before = sampleUntil(clock, 1000, 1800);
  clock.finishChunk(0, 1800);
  const after = clock.getOffset(1800);

  assert.equal(after, before);
  assert.ok(after < 120);
});

test('pause freezes position and resume continues without elapsed-time jump', () => {
  const clock = createClock();
  const beforePause = sampleUntil(clock, 1000, 1500);
  clock.pause(1500);
  assert.equal(clock.getOffset(5000), beforePause);
  clock.resume(5000);
  const afterResume = sampleUntil(clock, 5000, 5500);

  assert.ok(afterResume > beforePause);
  assert.ok(afterResume - beforePause < 5);
});

test('boundary clock slows down through a long silence instead of outrunning speech', () => {
  const clock = createClock();
  clock.startChunk(0, 1000);
  clock.observeBoundary(0, 4, 1400); // 先确认 boundary 模式
  sampleUntil(clock, 1400, 2000);
  const beforeSilence = clock.getOffset(2000);
  // 模拟 rAF：3s 无 boundary，期间应该几乎停住
  let value = beforeSilence;
  for (let now = 2016; now <= 5000; now += 16) value = clock.getOffset(now);

  assert.ok(value - beforeSilence < 2, `advanced too far during silence: ${value - beforeSilence}`);
});
