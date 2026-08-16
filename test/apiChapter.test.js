import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let importId = 0;

async function importApiChapter() {
  importId += 1;
  return (await import(`../src/modules/reading/voiceRead/apiChapter.js?test=${importId}`)).apiChapter;
}

function installDom() {
  globalThis.DOMParser = class DOMParser {
    parseFromString(html) {
      return {
        querySelectorAll: () => [],
        body: {
          innerText: String(html).replace(/<[^>]+>/g, ' '),
          textContent: String(html).replace(/<[^>]+>/g, ' ')
        }
      };
    }
  };
}

function randomPrefix(length = 32) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function wrapPayload(payload) {
  return randomPrefix() + Buffer.from(payload, 'utf8').toString('base64');
}

function chapterHtml(text) {
  return [
    '<!DOCTYPE html>',
    '<html><body>',
    '<p class="content">' + text + '</p>',
    '<p class="content">' + text + '</p>',
    '</body></html>'
  ].join('');
}

function requestBody(uid, bookId = 'book-1') {
  return JSON.stringify({ b: bookId, c: uid });
}

test('随机前缀加 base64 的接口响应可被识别为章节正文', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const body = '这一章从一场晚归开始。巷口的灯坏了，她只能借着月色辨认路。远处传来狗叫，她加快脚步，却在转角撞见一个不该出现的人。';
  const html = chapterHtml(body);

  const list = apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_1', requestBody('uid-1'), wrapPayload(html));

  assert.ok(Array.isArray(list) && list.length > 0);
  const result = apiChapter.getChapterText('uid-1');
  assert.ok(result);
  assert.equal(result.source, 'API:chapter');
  assert.equal(result.text.includes(body), true);
});

test('getChapterHtml 返回可用于重建排版 DOM 的整章 XHTML', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const body = '这一章从一场晚归开始。巷口的灯坏了，她只能借着月色辨认路。远处传来狗叫，她加快脚步，却在转角撞见一个不该出现的人。';
  const html = chapterHtml(body);

  apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_1', requestBody('uid-html'), wrapPayload(html));

  const result = apiChapter.getChapterHtml('uid-html');
  assert.ok(result);
  assert.equal(result.chapterUid, 'uid-html');
  assert.equal(result.html.includes('class="content"'), true);
});


test('错位解码得到的标签残段不作为正文', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const fragment = 'class="content">吴定缘肯定还活着。他从船舷边探出半个身子，看着黑黢黢的江水从指缝间流过，脑子里只剩这一个念头。';

  const list = apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_1',
    requestBody('uid-fragment'),
    wrapPayload(fragment)
  );

  assert.equal(list, null);
  assert.equal(apiChapter.getChapterText('uid-fragment'), null);
});

test('封面 XHTML 不作为正文候选', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const cover = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE html>',
    '<html><head><title>封面</title></head><body>',
    '<div class="frontCover">',
    '<p class="content">这是图书封面上的完整宣传文案。它虽然很长，但不是章节正文，不能让朗读从这里开始。</p>',
    '</div>',
    '</body></html>'
  ].join('');

  const list = apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_0', requestBody('uid-cover'), wrapPayload(cover));

  assert.equal(list, null);
  assert.equal(apiChapter.getChapterText('uid-cover'), null);
});

test('CSS 资源不作为正文候选', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const css = '/* 章节样式 */.readerChapterContent .content{text-indent:2em}.readerChapterContent .frontCover{text-align:center}';

  const list = apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_2', requestBody('uid-css'), wrapPayload(css));

  assert.equal(list, null);
  assert.equal(apiChapter.getChapterText('uid-css'), null);
});

test('同一章节多个接口响应只取正文，不混入封面或样式', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const body = '他沿着河堤走了很远，直到城楼上的灯一盏接一盏熄灭。水面倒映着零星的渔火，风从对岸送来潮湿的气息。';
  const cover = '<?xml version="1.0" encoding="utf-8"?><html><head><title>封面</title></head><body><div class="frontCover"><p class="content">这是图书封面上的完整宣传文案。它虽然很长，但不是章节正文，不能让朗读从这里开始。</p></div></body></html>';
  const css = '/* css */.content{text-indent:2em}';

  apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_0', requestBody('uid-multi'), wrapPayload(cover));
  apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_2', requestBody('uid-multi'), wrapPayload(css));
  const bodyList = apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_3', requestBody('uid-multi'), wrapPayload(chapterHtml(body)));

  assert.ok(bodyList && bodyList.length > 0);
  const result = apiChapter.getChapterText('uid-multi');
  assert.ok(result);
  assert.equal(result.text.includes(body), true);
  assert.equal(result.text.includes('封面'), false);
  assert.equal(result.text.includes('text-indent'), false);
});

test('按 bookId 过滤缓存，避免同名章节跨书串号', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const bookA = '这是甲书第一章的正文内容。夜风从窗缝里钻进来，桌上的灯芯跳了两下。';
  const bookB = '这是乙书第一章的正文内容。雨点敲在青瓦上，屋里的火盆烧得正旺。';

  apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_1', requestBody('uid-same', 'book-a'), wrapPayload(chapterHtml(bookA)));
  apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_1', requestBody('uid-same', 'book-b'), wrapPayload(chapterHtml(bookB)));

  const resultA = apiChapter.getChapterText('uid-same', { bookId: 'book-a' });
  const resultB = apiChapter.getChapterText('uid-same', { bookId: 'book-b' });
  assert.ok(resultA && resultA.text.includes('甲书'));
  assert.ok(resultB && resultB.text.includes('乙书'));
  assert.equal(resultA.text.includes('乙书'), false);
  assert.equal(resultB.text.includes('甲书'), false);
});

test('真实抓包：e_0 章首被接受，e_1/e_3 续文合并为完整章节', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const debugDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../debug/captured16');
  const readBody = (name) => fs.readFileSync(path.join(debugDir, name), 'utf8');
  const uid = 'd8232f00235d82c8d161fb2';

  const startList = apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_0',
    requestBody(uid),
    readBody('32160.5450_e_0.body.txt')
  );
  const cssList = apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_2',
    requestBody(uid),
    readBody('32160.5452_e_2.body.txt')
  );
  const bodyList = apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_1',
    requestBody(uid),
    readBody('32160.5451_e_1.body.txt')
  );
  const tailList = apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_3',
    requestBody(uid),
    readBody('32160.5453_e_3.body.txt')
  );

  assert.ok(startList && startList.length > 0);
  assert.equal(cssList, null);
  assert.ok(bodyList && bodyList.length > 0);
  assert.ok(tailList && tailList.length > 0);

  const result = apiChapter.getChapterText(uid);
  assert.ok(result);
  assert.equal(result.chapterUid, uid);
  assert.match(result.text, /^第十六章/);
  assert.equal(result.text.includes('吴定缘肯定还活着'), true);
  assert.equal(result.text.includes('大明湖畔'), true);
  assert.equal(result.text.includes('.frontCover'), false);
});

test('真实抓包：第十三章从 firstTitle 开始并拼接后续 e_1/e_3 片段', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const debugDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../debug/captured-c0c3');
  const readBody = (name) => fs.readFileSync(path.join(debugDir, name), 'utf8');
  const uid = 'c0c320a0232c0c7c76d365a';

  apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_0',
    requestBody(uid),
    readBody('37512.10834_e_0.body.txt')
  );
  apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_1',
    requestBody(uid),
    readBody('37512.10835_e_1.body.txt')
  );
  const cssList = apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_2',
    requestBody(uid),
    readBody('37512.10836_e_2.body.txt')
  );
  apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_3',
    requestBody(uid),
    readBody('37512.10837_e_3.body.txt')
  );

  assert.equal(cssList, null);
  const result = apiChapter.getChapterText(uid);
  assert.ok(result);
  assert.match(result.text, /^第十三章 八盏明晃晃/);
  assert.equal(result.text.includes('这里只有两个护院'), true);
  assert.equal(result.text.includes('于谦假装迷路'), true);
  assert.equal(result.text.includes('父皇的迁都之议'), true);
  assert.equal(result.text.includes('我会一直盯着你'), true);
  assert.equal(result.text.includes('\uFFFD'), false);
});

test('e_1 先到、e_0 后到时等待章首而不是提前朗读中段', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const debugDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../debug/captured-c0c3');
  const uid = 'c0c320a0232c0c7c76d365a';
  const readBody = (name) => fs.readFileSync(path.join(debugDir, name), 'utf8');

  apiChapter.storeResponse(
    'https://weread.qq.com/web/book/chapter/e_1',
    requestBody(uid),
    readBody('37512.10835_e_1.body.txt')
  );
  assert.equal(apiChapter.getChapterText(uid, { requireChapterStart: true }), null);

  const pending = apiChapter.waitForChapter(uid, { timeout: 600, interval: 30 });
  setTimeout(() => {
    apiChapter.storeResponse(
      'https://weread.qq.com/web/book/chapter/e_0',
      requestBody(uid),
      readBody('37512.10834_e_0.body.txt')
    );
  }, 120);

  const result = await pending;
  assert.ok(result);
  assert.match(result.text, /^第十三章 八盏明晃晃/);
  assert.equal(result.text.includes('守，他们正兴致勃勃'), true);
});

test('fetch hook 截获 e_* 响应并按章节 uid 缓存', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const body = '雨后的巷子泛着潮湿的光。她踩过积水，在一扇旧木门前停下来，抬手敲了三下。';
  const raw = wrapPayload(chapterHtml(body));
  const response = {
    clone() {
      return { text: async () => raw };
    }
  };
  const pageWindow = {
    fetch: async () => response
  };

  apiChapter.installHooks(pageWindow);
  assert.ok(pageWindow.__wrApiHooked);

  await pageWindow.fetch('https://weread.qq.com/web/book/chapter/e_1', {
    method: 'POST',
    body: requestBody('uid-hooked')
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const result = apiChapter.getChapterText('uid-hooked');
  assert.ok(result);
  assert.equal(result.text.includes(body), true);
});

test('clearCache 清空已缓存的章节正文', async () => {
  installDom();
  const apiChapter = await importApiChapter();
  const body = '清晨的码头还没什么人。船工蹲在船头抽烟，偶尔抬头看一眼远处的江面。';

  apiChapter.storeResponse('https://weread.qq.com/web/book/chapter/e_1', requestBody('uid-clear'), wrapPayload(chapterHtml(body)));
  assert.ok(apiChapter.getChapterText('uid-clear'));

  apiChapter.clearCache();
  assert.equal(apiChapter.getChapterText('uid-clear'), null);
});
