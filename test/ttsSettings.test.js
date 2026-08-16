import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.GM_getValue = (_key, fallback) => fallback;
globalThis.GM_setValue = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { ttsSettings } = await import('../src/modules/reading/voiceRead/settings.js');

function installStorage(initialValues = {}, legacyValue = null) {
  const values = new Map(Object.entries(initialValues));
  let legacy = legacyValue;

  globalThis.GM_getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
  globalThis.GM_setValue = (key, value) => values.set(key, value);
  globalThis.localStorage = {
    getItem: () => legacy,
    setItem: (_key, value) => { legacy = value; }
  };

  return { values, getLegacy: () => legacy };
}

test('章节续读默认开启，并持久化用户取消勾选的设置', () => {
  const storage = installStorage();

  ttsSettings.load();
  assert.equal(ttsSettings.follow, true);

  ttsSettings.follow = false;
  ttsSettings.save();
  assert.equal(storage.values.get('weread_tts_follow'), false);
  assert.equal(JSON.parse(storage.getLegacy()).follow, false);

  ttsSettings.follow = true;
  ttsSettings.load();
  assert.equal(ttsSettings.follow, false);
});

test('章节续读兼容旧版脚本保存的关闭状态', () => {
  installStorage({}, JSON.stringify({ follow: false }));

  ttsSettings.follow = true;
  ttsSettings.load();

  assert.equal(ttsSettings.follow, false);
});
