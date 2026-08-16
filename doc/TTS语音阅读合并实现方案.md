# 微信读书增强脚本：TTS 语音阅读合并实现方案

## 1. 目标与范围

本方案描述实现路径，当前已按方案落地到 `src/`。目标是：

1. 把 `tts/微信读书AI朗读.user.js` 的功能合并进 `src/`，按职责拆成模块，保持代码可维护，不破坏现有宽度、护眼、自动阅读、定时、图片工具等功能。
2. 语音阅读入口放进点击设置后展开的控制面板，和自动阅读、定时共用一套状态与控件。
3. 语音启动后自动触发页面滚动或翻页。
4. 语速成为唯一阅读速度控件，滚动速度、翻页等待完全对标语速。
5. 支持“从某文字起、到某文字止”的可选阅读范围；结束文字为空时，由章节续读和定时决定范围。

## 2. 设计读与 UI 原则

按 `taste-skill` 先做设计读：

> Reading this as: 微信读书增强脚本的功能面板，面向高频阅读用户，是工具型 UI，语言安静、密度高、动效少，沿用现有 light/dark 主题与控件样式。

适用参数：

- `DESIGN_VARIANCE: 3`，保持现有面板信息架构，不引入营销式布局。
- `MOTION_INTENSITY: 2`，只保留必要的按钮状态反馈，不做装饰动画。
- `VISUAL_DENSITY: 7`，控制项紧凑排布，适合连续阅读时的快速操作。

taste skill 中关于 landing page、hero、bento、营销文案的规则不适用本任务；只采用其中与工具型 UI 相关的原则：

- 控件复用现有 `.control-slider`、`.control-btn`、`.control-value`，不新造一套设计语言。
- 圆角保持现状，所有新控件跟随现有 4px 到 8px 圆角体系。
- 新控件必须同时覆盖 light、dark、护眼背景三种状态。
- 所有按钮有可读文字或 title，不使用纯色块冒充控件。
- 不在面板里加装饰性图标、渐变圆点、品牌营销文案。

## 3. 现状梳理

### 3.1 项目现有入口

- `src/main.js` 在 `window load` 后执行 `initialize()`。
- `src/runtime/state.js` 保存 `currentScrollSpeed`、`isAutoReading`、定时剩余时间等全局状态。
- `src/runtime/registry.js` 用 `registerModules()` 注册可跨模块调用的功能。
- `src/modules/ui/controlPanel/index.js` 负责设置面板、速度滑块、定时滑块、自动阅读按钮、护眼按钮、图片工具按钮。
- `src/modules/reading/autoRead/index.js` 负责滚动阅读、页底自动翻页、定时停止。
- `src/modules/reading/autoPageTurn/index.js` 负责派发 `ArrowRight` 键盘事件触发微信读书翻页。
- `src/modules/reading/progressBar/` 负责翻页等待倒计时条。

### 3.2 TTS 脚本现状

`tts/微信读书AI朗读.user.js` 是一个独立 IIFE，主要能力：

- 从微信读书 Vue 实例、Vuex、`tempContent`、`preRenderHtml`、预渲染 DOM、普通 DOM 中提取章节正文。
- 按句子和 220 字上限分块。
- 使用 `SpeechSynthesis` 朗读，支持暂停、继续、停止。
- 支持语速、音色、章节续读、设置持久化。
- 右下角悬浮面板，独立于现有控制面板。

### 3.3 主要差距

1. TTS 与自动阅读各有一套速度设置和定时逻辑，没有统一入口。
2. TTS 面板在右下角，现有设置面板在左侧，功能分散。
3. 自动阅读的翻页等待是离散档位，不能连续对标语速。
4. TTS 没有阅读范围控件。
5. TTS 使用 `localStorage`，项目其余功能使用 `GM_setValue`，需要迁移兼容。

## 4. 目标模块结构

新增 `src/modules/reading/voiceRead/`，并在 `src/modules/reading/` 下抽出共享 pace 逻辑：

```text
src/modules/reading/
├─ autoPageTurn/        # 保留，翻页动作仍由它负责
├─ autoRead/            # 保留滚动与定时，改为可被语音驱动
├─ pace/
│  ├─ index.js          # 语速到滚动步长、翻页等待的换算
│  └─ styles.css        # 可选，仅放 pace 专属样式
├─ progressBar/         # 保留
└─ voiceRead/
   ├─ index.js          # 模块入口，对外 API，生命周期编排
   ├─ speechEngine.js   # SpeechSynthesis 封装
   ├─ extractor.js      # 微信读书正文提取与解密
   ├─ chunker.js        # 文本规范化、分块、范围截断
   ├─ settings.js       # 设置读写、旧数据迁移
   └─ styles.css        # 语音阅读专属样式
```

### 4.1 模块职责

`voiceRead/index.js`

- 对外暴露 `init()`、`start()`、`pause()`、`resume()`、`stop()`、`toggle()`、`setRate()`、`setVoice()`、`setFollow()`、`setRange()`。
- 编排正文提取、分块、语音播放、章节续读、自动阅读联动。
- 创建右下角快捷控制条，和设置面板双向同步。

`voiceRead/speechEngine.js`

- 封装 `window.speechSynthesis`。
- 管理当前 `utterance`、播放状态、暂停状态、语速、音色。
- 通过回调向 `index.js` 上报 `onstart`、`onend`、`onerror`。
- 统一处理浏览器不支持、voice 列表为空、Chrome 长文本暂停等兼容问题。

`voiceRead/extractor.js`

- 迁移 TTS 脚本里的 Vue 实例扫描、Vuex 状态读取、解密、预渲染 DOM 捕获、普通 DOM fallback。
- 提供 `extractCurrentChapterText()` 和 `clearCache()`。

`voiceRead/chunker.js`

- 迁移 `normalizeText`、`splitSentences`、`splitLongSentence`、`chunkText`。
- 新增 `applyRange()`，负责解析“从某文字起、到某文字止”。

`voiceRead/settings.js`

- 定义设置 schema：语速、音色、章节续读、阅读范围起止文字。
- 使用 `GM_setValue` 持久化，并兼容读取旧的 `localStorage['wr-tts-settings']`。

`pace/index.js`

- 单一来源换算 `voiceRate` 到滚动步长和翻页等待时间。
- 提供 `applyRate()`，供控制面板、voiceRead、autoRead 共同调用。

## 5. 合并映射

| TTS 原函数或能力 | 新模块 | 说明 |
| --- | --- | --- |
| `normalizeText` / `splitSentences` / `chunkText` | `chunker.js` | 原逻辑保留，新增范围截断 |
| `collectVueInstances` / `getStore` / `findReaderVms` | `extractor.js` | 原逻辑按现状迁移 |
| `decryptEntry` / `capturePreRenderDom` / `getLegacyDomText` | `extractor.js` | 原逻辑保留 |
| `speakChunk` / `pauseReading` / `resumeReading` | `speechEngine.js` | 增加事件回调 |
| `saveSettings` / `loadSettings` | `settings.js` | 迁移到 GM 存储并兼容旧值 |
| `buildPanel` / `addStyle` | `controlPanel` + `styles.css` | 控制项移入设置面板，右下角只留快捷条 |
| `startChapterWatcher` | `index.js` | 保留，并和范围策略结合 |
| `calculateWaitTime` | `pace/index.js` | 从离散档位改为连续换算 |

## 6. 关键流程设计

### 6.1 初始化

在 `src/main.js`：

1. `import voiceReadCss` 和 `import { voiceRead }`。
2. `GM_addStyle(voiceReadCss)`。
3. `registerModules({ ..., voiceRead })`。
4. 在 `initialize()` 中调用 `voiceRead.init()`。

`voiceRead.init()` 负责：

- 注册 speech synthesis 的 voice 变化监听。
- 启动正文提取用的预渲染 DOM 观察器。
- 恢复持久化设置。
- 创建右下角快捷控制条。
- 同步控制面板内的播放按钮、语速、音色、续读、范围状态。

### 6.2 播放生命周期

```text
用户点击“朗读”
  -> voiceRead.start()
     -> extractor.extractCurrentChapterText()
     -> chunker.applyRange(text, rangeSettings)
     -> chunker.chunkText(rangeText)
     -> speechEngine.speak(chunks)
     -> pace.applyRate(rate)
     -> autoRead.start() 或 autoRead.syncPace()
     -> startChapterWatcher()

用户点击“暂停”
  -> speechEngine.pause()
  -> autoRead.pause()

用户点击“继续”
  -> speechEngine.resume()
  -> autoRead.resume()

用户点击“停止”
  -> speechEngine.cancel()
  -> autoRead.stop()
  -> stopChapterWatcher()
```

自动阅读由语音阅读启动，不再由用户单独手动开启；旧 `restoreState()` 仍保留，用于刷新页面后恢复已经开始的语音阅读会话。

### 6.3 语速与自动阅读联动

语速成为唯一阅读速度控件：

- 滑块范围 `0.5` 到 `1.5`，步进 `0.1`，档位为 `0.5x / 0.6x / … / 1.4x / 1.5x`，只能停在档位，不再显示刻度标识。
- 显示值统一为 `1.0x` 这种格式。
- 默认语速 `1.0x`，`1.0x` 对应每页 `10` 秒，滚动和翻页等待都按这个基准对标。
- 语音 `utterance.rate`、`appState.currentScrollSpeed` 使用同一个值。

滚动换算：

```js
const PAGE_DURATION_AT_1X = 10;
const TICK_INTERVAL = 20; // 滚动 tick 间隔，50 次/秒

function getScrollStepFromPage(rate, scrollHeight, clientHeight) {
  const distance = Math.max(0, scrollHeight - clientHeight);
  const durationSeconds = PAGE_DURATION_AT_1X / clampRate(rate);
  return Math.max(1, distance / (durationSeconds * TICK_INTERVAL));
}
```

翻页等待换算：

```js
function getPageTurnWaitSeconds(rate) {
  return clampDuration(PAGE_DURATION_AT_1X / clampRate(rate));
}
```

换算结果统一按 5 秒档位取整；该公式替代现有离散档位：

```js
// 旧逻辑，仅作参考，不保留
// <=0.5 -> 10s, <=1 -> 8s, <=2 -> 6s, <=3 -> 4s, else -> 2s
```

控制面板滑动语速时：

1. 更新 `voiceRead` 内部 rate。
2. 更新 `appState.currentScrollSpeed`。
3. 调用 `autoRead.syncPace()`，让当前滚动间隔和待翻页等待立即变化。
4. 如果正在朗读，`speechEngine` 取消当前 chunk 并以新语速重读该 chunk，保证从滑块松手后立即对标。
5. 滑块值始终吸附到 `0.1` 倍速档位；自动阅读的“阅读时长”由语速换算并吸附到 5 秒档位，两个 Tab 显示保持一致。

### 6.4 定时

定时控件继续使用现有 `timerSlider`、`timerValue`、`timerDisplay`、`lastTimerBtn`，但移动到语音阅读小节，并且语义扩展为“语音阅读定时”。

启动规则：

- 语音启动时，如果定时大于 0 且没有正在跑的倒计时，从 `timerSlider` 分钟数开始。
- 如果已有倒计时，继续沿用剩余时间，不重复清零。
- 倒计时归零时，同时停止语音和自动阅读，显示“定时时间到，语音阅读已停止”。

结束文字为空时的范围决策：

```js
function resolveStopPolicy({ endPhrase, followEnabled, timerMinutes }) {
  if (endPhrase) return 'explicit-end';
  if (timerMinutes > 0) return 'timer';
  if (followEnabled) return 'chapter-end-follow';
  return 'chapter-end-only';
}
```

### 6.5 章节续读

保留原“章节续读”勾选项：

- 勾选：检测到章节切换后，重新提取新章节文本，继续朗读。
- 未勾选：检测到章节切换后停止朗读，并显示提示。

范围策略对续读的影响：

- 只有“到某文字止”为空且开启续读时，才会跨章节继续读。
- 用户填了明确的结束文字后，语音可以跨章节查找该文字，找到后读到该文字即停。
- 用户填了明确的开始文字后，后续章节也用同一段开始文字匹配；匹配不到时从新章节开头继续，并提示一次。

### 6.6 阅读范围

面板新增两个输入框：

- “从文字”：可选，空表示从章节开头。
- “到文字”：可选，空表示按定时、章节续读策略决定。

确定按钮把两个输入框保存为当前范围，清除按钮清空范围。

匹配规则：

1. 章节文本和输入文本都经过 `normalizeText`：去掉 NBSP、零宽字符、折叠空白。
2. 开始文字用 `indexOf` 找第一次出现位置。
3. 结束文字从开始位置之后用 `indexOf` 查找。
4. 截取范围包含结束文字本身。
5. 开始文字找不到：提示“未找到开始文字”，回退为整章朗读。
6. 结束文字找不到：提示“未找到结束文字”，按章节末尾处理。
7. 结束文字位于开始文字之前：提示并回退为整章朗读。

伪代码：

```js
function applyRange(text, { startText, endText }) {
  const normalized = normalizeText(text);
  const startIndex = startText
    ? normalized.indexOf(normalizeText(startText))
    : 0;

  if (startIndex === -1) {
    return { text: normalized, warning: 'start-not-found' };
  }

  if (!endText) {
    return { text: normalized.slice(startIndex), rangePolicy: 'dynamic' };
  }

  const endStart = normalized.indexOf(normalizeText(endText), startIndex);
  if (endStart === -1) {
    return { text: normalized.slice(startIndex), warning: 'end-not-found' };
  }

  const endIndex = endStart + normalizeText(endText).length;
  return { text: normalized.slice(startIndex, endIndex), rangePolicy: 'explicit' };
}
```

范围设置持久化；开启语音时自动应用，不要求用户每次重新输入。

### 6.7 右下角快捷控制

原右下角完整 TTS 面板拆除，避免两套重复控件。替换为极简快捷条：

- 只有播放/暂停和停止两个按钮，播放中显示 `当前句/总句数` 状态。
- 快捷条支持拖动，松手后吸附到最近边缘并贴边隐藏，鼠标悬停时展开；背景、文字、按钮颜色与设置面板保持同一套主题变量。
- 点击后跳到设置面板，或者直接在快捷条上暂停/继续。
- 首次点击朗读时出现，停止后淡出。

这样既保留“右下角语音调节窗口”的操作习惯，又把完整设置收进设置面板。

## 7. 控制面板 UI 方案

### 7.1 小节调整

阅读功能小节改为两个切换页，默认显示“自动阅读”：

```text
[自动阅读] [语音阅读]

自动阅读
  阅读时长  [5 - 60 秒/页滑块，5 秒档位]
  定时时长  [0 - 120 分钟滑块]  0分钟
  剩余时间显示
  [上次定时] [开始阅读]

语音阅读
  语速  [0.5 - 1.5 滑块]  1.0x
  音色  [select]
  定时时长  [0 - 120 分钟滑块]  0分钟
  剩余时间显示
  阅读范围
    [从文字 input] [到文字 input]
    [确定范围] [清除范围]
  [朗读] [停止] [重试]
```

- “阅读时长”为每页时长，范围 5 到 60 秒/页、5 秒档位，直接驱动自动阅读的滚动步长与翻页等待，默认由 `1.0x` 语速换算为 10 秒/页。
- “语音阅读”保持语速与滚动、翻页联动；切换 Tab 不停止正在进行的阅读。
- 自动阅读和语音阅读共用“上次定时”，两个定时滑块保持同步。
- 开启定时后，右下角显示定时倒计时；翻页等待时，翻页进度与定时倒计时合并显示在同一弹窗。

### 7.2 样式约束

- 新增 `.control-select`、`.range-input`，但复用 `.control-label`、`.control-slider`、`.control-btn` 的视觉语言。
- 控制面板默认 `width: 320px`，右缘提供宽度拖拽把手并持久化，高度固定；自动阅读与语音阅读两个 Tab 共用同一面板宽度，避免切换时抖动。
- “从文字 / 到文字”放在同一行 `.range-row` 中，两个输入框均分宽度，不换行。
- 面板拖拽忽略 `button`、`input`、`select`、`textarea` 等交互控件，保证音色下拉可正常点击。
- 滑块包进 `.slider-box` 并弹性占满剩余宽度，消除左右大空隙；滑块改为档位式，拖动和键盘都只能落在档位，不再显示刻度标识。
- 语速滑块档位步进 `0.5x`，定时滑块步进 `10` 分钟，自动阅读时长滑块步进 `5` 秒/页，宽度滑块步进 `100`px。
- dark 主题适配沿用 `utils.syncControlPanelBackground()` 的现有逻辑，新增控件必须同步设置 `color`、`background`、`borderColor`。
- 所有状态按钮复用 `.control-btn.active`，不使用额外配色。

## 8. 持久化方案

新设置使用 `GM_setValue`，键名：

```text
weread_tts_rate
weread_tts_voice_uri
weread_tts_follow
weread_tts_range_start
weread_tts_range_end
```

首次运行时读取旧 `localStorage['wr-tts-settings']`：

- `rate` 迁移到 `weread_tts_rate`。
- `voiceURI` 迁移到 `weread_tts_voice_uri`。
- `follow` 迁移到 `weread_tts_follow`。

迁移成功后可继续写旧 `localStorage`，便于用户回退到独立 TTS 脚本时数据不丢；迁移不阻塞正常功能。

## 9. 边界情况

1. 浏览器不支持 `speechSynthesis`：提示一次，不启动自动阅读，其他功能不受影响。
2. 当前页没有可提取正文：沿用现有 toast，不启动语音。
3. 范围输入框同时为空：朗读整章。
4. 开始文字为空、结束文字非空：从章节开头读到结束文字。
5. 开始文字重复出现：取第一次出现位置，用户可通过输入更长上下文提高精度。
6. 播放中切换语速：当前 chunk 立即以新语速重读，滚动和翻页等待同步更新。
7. 播放中切换音色：取消当前 chunk 并按新音色立即重读，保证实时生效。
8. 播放中章节切换：按续读勾选状态决定继续或停止。
9. 定时归零：语音、自动阅读、进度条、快捷条全部复位。
10. 用户手动翻页：沿用现有 `autoRead.checkManualPageTurn()` 逻辑，不重复触发翻页。
11. 面板打开状态下主题切换：新控件颜色由现有主题同步函数覆盖。
12. `speechSynthesis` 在部分浏览器长时间播放后卡死：保留 chunk 机制，并在 `onend` 超时后做一次安全恢复。

## 10. 分步实施顺序

1. 新建 `voiceRead/chunker.js` 和 `voiceRead/extractor.js`，先把 TTS 纯逻辑迁入。
2. 新建 `voiceRead/speechEngine.js` 和 `voiceRead/settings.js`，让模块可在独立测试入口调用。
3. 新建 `voiceRead/index.js`，完成初始化、播放生命周期、章节续读。
4. 新建 `pace/index.js`，把速度换算接到 `autoRead` 和 `voiceRead`。
5. 改 `controlPanel/index.js`，重组“语音阅读”小节并接入范围输入框。
6. 改 `autoRead/index.js`，增加 `pause()`、`resume()`、`syncPace()`，保留旧恢复状态路径。
7. 改 `src/main.js`、`src/runtime/registry.js`，注册并初始化新模块。
8. 调整样式并覆盖 light、dark、护眼背景。
9. 更新 `src/metadata.txt` 的版本和描述，更新 `README.md`。
10. 构建并验证。

## 11. 验证方案

本任务明确不使用截图、图片查看或视觉模型能力，因此验证全部走构建、状态断言和浏览器控制台：

1. 运行 `npm run build`，确认产物为单一 `dist/weread.user-1.10.0.js`，旧版产物不被覆盖。
2. 运行 `node --check` 或构建期语法检查，确认无语法错误。
3. 在微信读书阅读页加载产物，检查：
   - 设置面板可打开、可拖拽，原有宽度、护眼、图片功能正常。
   - 语音小节控件齐全，右下角快捷条可暂停、停止。
   - 点击朗读后 `appState.isAutoReading` 为 true，滚动间隔存在。
   - 语速滑块变化后，`appState.currentScrollSpeed` 同步变化。
   - 翻页等待时间符合 `10 / rate` 的语速换算，且进度条同步更新。
   - 语速滑块只能落在 `0.5x` 倍速档位，自动阅读时长吸附 5 秒/页，定时吸附 10 分钟。
   - 右下角快捷条可拖动，松手吸附边缘并贴边隐藏，悬停展开；颜色与设置面板一致。
   - 定时归零后语音与自动阅读同时停止。
   - 范围起止文字匹配、找不到文字提示、结束文字为空三种路径符合预期。
4. 通过控制台调用 `moduleRegistry.voiceRead` 和 `moduleRegistry.autoRead` 断言状态，不用视觉判断。

## 12. 风险与兼容

- 微信读书内部 Vue 字段可能变化：提取器保留多级 fallback，字段变化时优先走预渲染 DOM 和普通 DOM。
- 移除旧“阅读速度”滑块会改变老用户操作路径，但这是本需求的明确替换项；自动阅读仍由语音内部驱动。
- `speechSynthesis` 的语速实际效果因浏览器和音色而异，滚动速度按数值对标，最终可读性需人工确认。
- 控制面板变宽可能影响窄屏布局，需在验证时检查横向溢出。
- 定时逻辑从 autoRead 私有方法变成共享调用时，必须保留 `lastTimerBtn` 和 `remainingTime` 的恢复行为。

## 13. 落地状态

- 已新增 `src/modules/reading/pace/` 与 `src/modules/reading/voiceRead/`。
- `autoRead` 已改为语速驱动滚动与翻页，并增加 `pause()`、`resume()`、`syncPace()`。
- 控制面板“语音阅读”小节已包含朗读/停止/重试、语速、音色、章节续读、阅读范围与定时。
- 右下角仅保留播放/停止快捷条，完整设置收进设置面板。
- 控制面板已改为“自动阅读 / 语音阅读”双 Tab，默认自动阅读；自动页包含阅读时长、定时时长、上次定时与开始阅读。
- 自动阅读与语音阅读开启定时后共用右下角倒计时弹窗，翻页等待进度可与其合并显示。
- 当前版本为 `1.10.0`，构建产物为 `dist/weread.user-1.10.0.js`，旧产物 `1.1.0` 至 `1.9.0` 保留。
- `1.4.0` 修复：范围起止输入框同行显示、音色下拉可点击、两个阅读 Tab 面板宽度一致。
- `1.6.0` 优化：滑块加长并消除左右大空隙，增加整数节点刻度与语速整数吸附，吸附阈值仅覆盖接近整数的 0.06x 范围，避免误吞 1.1x 等档位。
- `1.7.0` 优化：“上次定时”按钮样式与“开始阅读”统一；护眼模式不可用提示展示满 3 秒后自动关闭；四个设置模块之间只保留一条分割线；设置面板支持手动调节宽度并持久化、高度固定；朗读中可实时切换语速、定时与音色。
- `1.8.0` 优化：滑动调节改为档位式并移除刻度标识，语速默认 `1.0x`、最低 `0.5x`，滚动与翻页按 10 秒/页基准对标语速；右下角快捷条支持拖动、贴边隐藏，背景与设置面板主题一致。
- `1.9.0` 修复：“上次定时”按钮移除禁用态差异，暗色主题下与“开始阅读”样式一致；提示通知修复旧通知延迟移除误删新通知的问题，护眼不可用提示展示满 3 秒；设置面板宽度调节与位置恢复均限制在当前浏览器窗口内，右缘不可越出窗口。
- `1.10.0` 修复：滚动 tick 换算从 `50ms` 对齐为实际 `20ms` 滚动间隔，滚动、翻页速度严格对标语速；右下角快捷条右侧贴边时避让浏览器滚动条宽度，并加宽右侧隐藏把手至 `32px`，悬停可正常拉出。
- 构建验证使用 `npm run build` 与 `node --check`，不使用截图或视觉能力。
