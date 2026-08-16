const UI_NOISE_RE = /(上一章|下一章|上一页|下一页|加入书架|我的书架|书架|书城|目录|返回|分享|复制|书评|评论|推荐|简介|阅读进度|免费试读|最新章节|完本|排行|分类|搜索|登录|注册|会员|充值|购买|下载|设置|朗读|语音|暂停|停止|语速|音色|作者有话说|本章导读|查看全部|听书|笔记|想法|划线|翻译)/g;

function countCjk(value) {
  return (String(value).match(/[\u3400-\u9FFF]/g) || []).length;
}

export const chunker = {
  normalizeText(raw) {
    return String(raw || '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  splitSentences(text) {
    const parts = text.match(/[^。！？!?；;…]+[。！？!?；;…]?/g) || [];
    return parts.map((part) => part.trim()).filter(Boolean);
  },

  splitLongSentence(sentence) {
    if (sentence.length <= 220) return [sentence];
    const parts = sentence.match(/[^，、：:，。！？!?；;…]+[，、：:，。！？!?；;…]?/g) || [sentence];
    return parts.map((part) => part.trim()).filter(Boolean);
  },

  chunkText(text) {
    return this.chunkTextWithOffsets(text).map((chunk) => chunk.text);
  },

  /**
   * 分块时保留正文绝对偏移。chunk 文本始终是源文本的连续切片，
   * SpeechSynthesisEvent.charIndex 因而可以直接换算为整章偏移。
   */
  chunkTextWithOffsets(text, baseOffset = 0) {
    const source = String(text || '');
    const pieces = [];
    const sentencePattern = /[^。！？!?；;…]+[。！？!?；;…]?/g;
    const secondaryPattern = /[^，、：:，。！？!?；;…]+[，、：:，。！？!?；;…]?/g;
    let sentenceMatch;

    const addPiece = (start, end) => {
      let safeStart = start;
      let safeEnd = end;
      while (safeStart < safeEnd && /\s/.test(source[safeStart])) safeStart += 1;
      while (safeEnd > safeStart && /\s/.test(source[safeEnd - 1])) safeEnd -= 1;
      for (let cursor = safeStart; cursor < safeEnd; cursor += 220) {
        pieces.push({ start: cursor, end: Math.min(safeEnd, cursor + 220) });
      }
    };

    while ((sentenceMatch = sentencePattern.exec(source))) {
      const sentenceStart = sentenceMatch.index;
      const sentenceEnd = sentenceStart + sentenceMatch[0].length;
      if (sentenceMatch[0].length <= 220) {
        addPiece(sentenceStart, sentenceEnd);
        continue;
      }

      secondaryPattern.lastIndex = sentenceStart;
      let pieceMatch;
      while ((pieceMatch = secondaryPattern.exec(source))) {
        if (pieceMatch.index >= sentenceEnd) break;
        addPiece(pieceMatch.index, Math.min(sentenceEnd, pieceMatch.index + pieceMatch[0].length));
        if (secondaryPattern.lastIndex >= sentenceEnd) break;
      }
    }

    if (!pieces.length && source.trim()) {
      const first = source.search(/\S/);
      const last = source.search(/\s*$/);
      addPiece(Math.max(0, first), Math.max(0, last));
    }

    const chunks = [];
    let currentStart = -1;
    let currentEnd = -1;

    const flush = () => {
      if (currentStart < 0 || currentEnd <= currentStart) return;
      chunks.push({
        text: source.slice(currentStart, currentEnd),
        startOffset: Number(baseOffset) + currentStart,
        endOffset: Number(baseOffset) + currentEnd
      });
      currentStart = -1;
      currentEnd = -1;
    };

    for (const piece of pieces) {
      if (currentStart < 0) {
        currentStart = piece.start;
        currentEnd = piece.end;
        continue;
      }
      const candidateLength = piece.end - currentStart;
      if (candidateLength > 220) {
        flush();
        currentStart = piece.start;
        currentEnd = piece.end;
      } else {
        currentEnd = piece.end;
      }
    }
    flush();
    return chunks;
  },

  isPlausibleText(text) {
    const value = this.normalizeText(text);
    if (value.length < 12) return false;
    return /[\u3400-\u9FFF]/.test(value) || /[A-Za-z]{4,}/.test(value);
  },

  /**
   * 正文度评分：长度、中文占比、标点密度给正分；导航/UI 短语给负分。
   * 评分只用于在“看起来有文字”的候选里挑选更像正文的内容，
   * 避免把顶部栏、目录、书评、推荐等整块 UI 文案朗读出来。
   */
  scoreChapterText(text) {
    const value = this.normalizeText(text);
    if (!value) return -Infinity;
    if (value.length < 12) return -Infinity;

    const cjkCount = countCjk(value);
    const cjkRatio = cjkCount / value.length;
    const hasEnglish = /[A-Za-z]{4,}/.test(value);
    if (cjkRatio < 0.2 && !hasEnglish) return -Infinity;

    let score = 0;
    score += Math.min(30, Math.floor(value.length / 60));
    if (cjkRatio >= 0.5) {
      score += 30;
    } else if (cjkRatio >= 0.25 || hasEnglish) {
      score += 20;
    }

    const sentenceEnds = (value.match(/[。！？!?；;]/g) || []).length;
    const commas = (value.match(/[，、：:,]/g) || []).length;
    score += Math.min(24, sentenceEnds * 4);
    score += Math.min(12, commas * 2);

    const noiseMatches = value.match(UI_NOISE_RE) || [];
    const noiseDensity = noiseMatches.length / Math.max(1, value.length);
    score -= Math.min(60, noiseMatches.length * 8);
    if (noiseMatches.length >= 3 || noiseDensity > 0.06) score -= 30;

    if (cjkRatio >= 0.4) {
      const spaceCount = (value.match(/ /g) || []).length;
      if (spaceCount / value.length > 0.1) score -= 20;
    }
    if (sentenceEnds === 0 && commas === 0 && noiseMatches.length >= 2) score -= 40;

    return score;
  },

  isLikelyChapterText(text) {
    return this.isPlausibleText(text) && this.scoreChapterText(text) > 0;
  },

  /**
   * 解析“从某文字起、到某文字止”的阅读范围。
   * 返回结构里附带定位信息，供朗读开始时把页面滚动到“从文字”位置：
   * - startIndex / endIndex：起止文字在整章归一化文本中的偏移（endIndex 为 0 表示读到章末）；
   * - totalLength：整章归一化文本长度（定位与比例估算共用）。
   */
  applyRange(text, startText, endText) {
    const normalized = this.normalizeText(text);
    const startPhrase = this.normalizeText(startText);
    const endPhrase = this.normalizeText(endText);
    const totalLength = normalized.length;

    const startIndex = startPhrase ? normalized.indexOf(startPhrase) : 0;
    if (startIndex === -1) {
      return { text: normalized, warning: 'start-not-found', rangePolicy: 'dynamic', startIndex: 0, endIndex: 0, totalLength };
    }

    if (!endPhrase) {
      return { text: normalized.slice(startIndex), rangePolicy: 'dynamic', startIndex, endIndex: 0, totalLength };
    }

    const endStart = normalized.indexOf(endPhrase, startIndex);
    if (endStart === -1) {
      return { text: normalized.slice(startIndex), warning: 'end-not-found', rangePolicy: 'dynamic', startIndex, endIndex: 0, totalLength };
    }

    const endIndex = endStart + endPhrase.length;
    return { text: normalized.slice(startIndex, endIndex), rangePolicy: 'explicit', startIndex, endIndex, totalLength };
  }
};
