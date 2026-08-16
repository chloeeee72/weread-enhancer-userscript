import test from 'node:test';
import assert from 'node:assert/strict';
import { chunker } from '../src/modules/reading/voiceRead/chunker.js';

test('chunkTextWithOffsets preserves a contiguous source slice', () => {
  const text = '第一句。 第二句！ Third sentence?';
  const chunks = chunker.chunkTextWithOffsets(text, 120);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, text);
  assert.equal(chunks[0].startOffset, 120);
  assert.equal(chunks[0].endOffset, 120 + text.length);
});

test('chunkTextWithOffsets keeps absolute offsets when splitting long text', () => {
  const text = '甲'.repeat(500);
  const chunks = chunker.chunkTextWithOffsets(text, 37);

  assert.deepEqual(chunks.map((chunk) => chunk.text.length), [220, 220, 60]);
  assert.equal(chunks.map((chunk) => chunk.text).join(''), text);
  assert.equal(chunks[0].startOffset, 37);
  assert.equal(chunks.at(-1).endOffset, 537);
  for (let index = 1; index < chunks.length; index += 1) {
    assert.equal(chunks[index - 1].endOffset, chunks[index].startOffset);
  }
});

test('range end without an explicit end phrase is derived from range start', () => {
  const text = '开头内容。中间开始。后续正文直到章节结束。';
  const result = chunker.applyRange(text, '中间开始', '');
  const endOffset = result.startIndex + result.text.length;

  assert.equal(endOffset, result.totalLength);
  assert.equal(result.text, text.slice(result.startIndex));
});

test('normalization removes both supported zero-width characters', () => {
  assert.equal(chunker.normalizeText('甲\u200B乙\uFEFF丙'), '甲乙丙');
});

test('正文度评分拒绝顶部栏和书评等 UI 文案', () => {
  const body = '这是第一章的正文内容。夜色渐深，主人公沿着山路继续前行，远处的灯火忽明忽暗。他想起白天的对话，忍不住轻轻叹了口气。';
  const topBar = '书名 第一章 我的书架 书城 目录 搜索 分享 加入书架 上一章 下一页 登录 注册 会员 充值 设置 朗读 暂停 语速 音色';
  const review = '书名 第一章 我的书架 目录 上一章 下一章 加入书架 书评 推荐 简介 阅读进度 免费试读 最新章节 完本 排行 分类 搜索 登录 注册 会员 充值 购买 下载 设置 朗读 语音 暂停 停止 语速 音色 作者有话说 本章导读 查看全部 听书 笔记 想法 划线 翻译';

  assert.equal(chunker.isLikelyChapterText(body), true);
  assert.equal(chunker.isLikelyChapterText(topBar), false);
  assert.equal(chunker.isLikelyChapterText(review), false);
  assert.ok(chunker.scoreChapterText(body) > chunker.scoreChapterText(topBar));
});

test('正文中零星出现 UI 词汇时仍可朗读', () => {
  const body = '作者在文末推荐了另一本书，读者可以自行查看。这段正文并不因为包含推荐一词就失去正文特征。';

  assert.equal(chunker.isLikelyChapterText(body), true);
});
