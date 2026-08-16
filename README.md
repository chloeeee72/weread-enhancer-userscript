# 微信读书增强脚本（WeRead Enhancer）

一个运行在 Tampermonkey / Violentmonkey 等用户脚本管理器中的**微信读书网页版增强脚本**，目标站点为 `https://weread.qq.com/web/reader/*`（微信读书网页版阅读页）。

项目使用 Vite 将模块化源码构建为**单一 `.user.js` 文件**，可直接上传 GreasyFork 分发。当前版本 `2.0.2`。**每次 `npm run build` 自动递增版本号尾号**（如 `2.0.2 → 2.0.3`），产物文件名同步更新，保留所有历史版本于 `dist/`。

---

## 一、功能总览

### 阅读体验

- **页面宽度调节**：600–1400px 可调，实时生效并持久化保存，刷新不丢失；支持一键恢复默认宽度。
- **护眼模式**：白色主题下可用，内置 7 种背景色（白/绿/黄/蓝/粉/紫/灰），一键开关、颜色持久化；深色主题下自动禁用并提示。
- **顶部栏自动隐藏**：向下滚动时顶部工具栏自动隐藏，向上滚动时恢复，让阅读区域更沉浸。

### 自动阅读

- **自动滚动阅读**：按设定"秒/页"匀速滚动，支持单栏、双栏布局。
- **自动翻页**：滚动到页底后等待设定时长，自动模拟按键翻页（单双栏通用），翻页前显示**等待进度条**。
- **定时停止**：0–120 分钟可设（步进 1 分钟），到点自动停止并提示；支持"上次定时"一键复用。
- **状态恢复**：刷新页面后自动恢复上次的自动阅读状态（滚动速度、剩余定时）。

### AI 语音阅读（TTS）

- 自动提取当前章节正文，按句子分块后使用浏览器 `SpeechSynthesis` 朗读，**语速 0.5x–1.5x 可调（步进 0.1）**。
- 支持**暂停 / 继续 / 停止 / 重试**，可选择系统已安装的中文音色（Edge 自带微软晓晓等神经网络音色效果最佳）。
- **朗读不自动滚动 / 不自动定位**：点击"朗读"后页面保持不动，用户可自由手动滚动，不会打断朗读。
- **章节续读**：翻到下一章自动继续朗读；不勾选则在切换章节时停止。
- **自定义阅读范围（单栏）**：指定"从某文字起、到某文字止"朗读；点击"确定范围"可先定位到开始文字，再点击"朗读"从定位处开始读。
- **双栏语音阅读**：双栏模式同样支持语音朗读；保留语速、音色、定时时长、朗读、停止、重试，隐藏朗读范围设置，不自动滚动。
- 右下角悬浮快捷条：可拖拽、四边自动吸附、位置持久化；显示朗读进度（当前块/总块数）。

### 图片工具

- **单图工具栏**：悬浮在阅读页图片上，支持单图下载、复制链接、新标签页打开。
- **全书图片预览**：一键扫描整本书的图片，按章节去重、批量选择/全选、批量复制（图片引用或 URL）、批量下载。
- 智能处理懒加载图片、占位图过滤、跨章节去重，内置 LRU 缓存限制内存占用，扫描进度实时展示。

### 控制面板

- 点击阅读页顶栏新增的"设置"按钮展开左侧面板，分为**宽度控制 / 自动阅读 / 语音阅读 / 显示设置 / 图片工具**等区域。
- 面板可**整体拖拽**、可**拖动边缘调整宽度**，位置与宽度均持久化。
- 自动阅读与语音阅读双 Tab 切换，定时、语速等状态在两个模式间联动同步；双栏阅读下语音 Tab 同样可用。

---

## 二、技术栈与运行环境

| 项目 | 说明 |
| --- | --- |
| 运行环境 | Chrome / Edge / Firefox 等 + Tampermonkey / Violentmonkey |
| 构建工具 | Vite 7（`vite build`，lib 模式输出 IIFE） |
| 运行时依赖 | 仅 jQuery 3.7.1（`@require`，GreasyFork 允许的 CDN） |
| 存储 | `GM_getValue` / `GM_setValue`（TTS 旧数据兼容 `localStorage` 迁移） |
| 权限 | `GM_addStyle` / `GM_download` / `GM_setClipboard` |
| 开发环境 | Node.js 20+ |

---

## 三、整体架构

项目采用 **「入口 → 运行时（状态/注册表）→ 功能模块」** 的分层结构：

- `src/main.js` 是唯一入口：注入全部样式、通过 `registerModules()` 注册各模块到注册表、在 `window load` 后初始化。
- 模块之间**不直接互相 import 对方**，统一通过 `src/runtime/registry.js` 的 `moduleRegistry` 间接调用（如 `autoRead` 调 `voiceRead`、`controlPanel` 调 `imagePreviewPanel`），避免循环依赖。
- 全局运行状态集中在 `src/runtime/state.js`（`appState`），可跨模块读写，并即时持久化到 GM 存储。
- 每个功能是一个"模块对象"，暴露 `init()` 与若干方法；样式 CSS 就近放在模块目录内，由 `main.js` 以 `?raw` 方式引入后 `GM_addStyle`。

```text
.
├─ build/
│  ├─ greasyfork-plugin.js          # Vite 插件：把 metadata.txt 拼接到产物头部
│  └─ version-bump.js              # 预构建脚本：构建前自动递增 metadata.txt 中的版本号
├─ dist/                            # 构建产物（单文件 .user.js，按版本归档）
│  ├─ weread.user-1.1.0.js
│  ├─ …（1.2.0 ~ 1.9.0）
│  └─ weread.user-2.0.2.js         # 当前最新产物
├─ src/
│  ├─ main.js                       # 入口：注入样式、注册模块、初始化、主题监听
│  ├─ metadata.txt                  # userscript 元数据（@name/@version/@match/@grant…）
│  ├─ constants.js                  # 全局常量：默认宽度、护眼色板、图片扫描调参
│  ├─ runtime/
│  │  ├─ registry.js                # 模块注册表，跨模块间接调用
│  │  └─ state.js                   # 全局运行状态 appState（GM 持久化）
│  ├─ styles/
│  │  ├─ base.css                   # 全局基础样式 + 顶部通知样式
│  │  └─ eyeProtectionStyles.js     # 按色板动态生成护眼背景样式
│  ├─ utils/
│  │  ├─ dom.js                     # 主题检测/同步、护眼状态读写、面板与快捷条主题
│  │  ├─ index.js                   # utils 统一导出
│  │  └─ notifications.js           # 顶部居中轻提示（淡入淡出）
│  └─ modules/
│     ├─ imagePreview/              # 全书图片扫描与预览
│     │  ├─ index.js                # 组装共享状态 + 三个方法工厂
│     │  ├─ panel.js                # 面板 DOM、事件绑定、明暗主题切换
│     │  ├─ gallery.js              # 全书扫描、去重合并、渲染、LRU 缓存
│     │  ├─ actions.js              # 选择/全选/复制/下载等操作
│     │  ├─ styles.css
│     │  └─ WORKFLOW.md             # 模块内部工作流备忘
│     ├─ imageTools/                # 单图悬浮工具栏 + 批量下载
│     │  ├─ index.js                # 图片识别、工具栏、下载/复制/打开
│     │  └─ styles.css
│     ├─ reading/
│     │  ├─ autoPageTurn/           # 模拟 ←/→ 按键触发微信读书翻页
│     │  ├─ autoRead/               # 自动滚动阅读、翻页调度、定时停止、状态恢复
│     │  ├─ eyeProtection/          # 护眼模式开关与换色
│     │  ├─ headerControl/          # 顶部栏随滚动隐藏 + 手动翻页检测
│     │  ├─ pace/                   # 语速 ⇄ 翻页等待 ⇄ 滚动步长换算（唯一速度基准）
│     │  ├─ progressBar/            # 翻页等待进度条 + 定时倒计时合并展示
│     │  ├─ voiceRead/              # AI 语音阅读（TTS）
│     │  │  ├─ index.js             # 模块入口：生命周期编排、UI 同步、章节监听
│     │  │  ├─ extractor.js         # 从 Vue 内部状态提取正文（多级降级解密）
│     │  │  ├─ chunker.js           # 文本规范化、分句、220 字分块、范围截断
│     │  │  ├─ speechEngine.js      # SpeechSynthesis 封装（暂停/继续/换速/换音色）
│     │  │  ├─ speechClock.js       # boundary 观测、连续字符时钟、相位/速度平滑
│     │  │  ├─ layoutMap.js         # 规范化字符偏移到真实排版行 y 的映射
│     │  │  ├─ scrollFollower.js    # rAF 前馈 + 闭环滚动和初始平滑对齐
│     │  │  ├─ settings.js          # TTS 设置读写 + 旧 localStorage 数据迁移
│     │  │  ├─ quickBarDrag.js      # 悬浮快捷条拖拽、四边吸附、位置持久化
│     │  │  └─ styles.css
│     │  └─ widthControl/           # 阅读宽度应用与持久化
│     └─ ui/
│        └─ controlPanel/           # 左侧设置面板
│           ├─ index.js             # 面板 DOM 构建、事件绑定、模式切换
│           ├─ panelDrag.js         # 面板拖拽 + 位置持久化
│           └─ styles.css
├─ tts/
│  ├─ 微信读书AI朗读.user.js        # 旧的独立 TTS 脚本（功能已合并进 src，保留作参考）
│  └─ README.md                     # 旧 TTS 脚本说明
├─ 原项目.js                        # 原始单文件脚本（唯一功能基准）
├─ package.json                     # 依赖与脚本（build / dev / test）
├─ package-lock.json
└─ vite.config.js                   # 构建配置：IIFE 单文件 + 版本化文件名
```

---

## 四、核心模块说明

### 4.1 入口与运行时

| 文件 | 职责 |
| --- | --- |
| `src/main.js` | 引入全部 CSS 并 `GM_addStyle`；注册 8 个功能模块；`window load` 后初始化；通过 `MutationObserver` 监听 `body` 的 class 变化，rAF 合并后同步主题（白/深色）到各组件 |
| `src/runtime/state.js` | `appState` 集中管理滚动定时器、阅读模式、剩余定时、滚动速度等，初始化时从 GM 存储读回 |
| `src/runtime/registry.js` | `moduleRegistry` 供跨模块调用（`autoRead` ↔ `voiceRead` ↔ `progressBar` ↔ `controlPanel` 等） |
| `src/constants.js` | 所有可调参数集中于此：默认宽度、护眼色板、图片扫描的批次/重试/缓存上限等 |

### 4.2 阅读类模块

- **widthControl**：对 `.readerContent .app_content` 与 `.readerTopBar` 设置 `maxWidth` 并持久化，同时派发 `resize` 让微信读书重排。
- **pace**：管理语速档位、自动阅读每页时长和无边界音色的初始 CPS；语音当前位置由 `speechClock` 决定。
- **autoRead**：自动阅读模式保留 20ms 固定循环，支持定时停止、暂停/恢复和自动阅读状态恢复；语音模式不自动滚动。
- **autoPageTurn**：向 `document` 派发 `keydown/keyup` 的 `ArrowRight` 事件；语音模式由最后一个语音 chunk 完成触发翻章，不再由页面触底决定。
- **progressBar**：右下角合并展示两条进度——"N 秒后自动翻页"（进度条百分比）与"定时倒计时"。
- **headerControl**：滚动方向判定顶部栏显隐；同时检测用户手动翻页以重置翻页等待计时。

### 4.3 voiceRead（TTS，最复杂模块）

- **extractor.js**：微信读书新版阅读器用 **canvas 绘制正文，页面没有正文 DOM**，因此提取器从 Vue 内部状态取数，优先级：
  1. 预渲染阶段短暂出现的明文 DOM（`#preRenderContent` 等，由 MutationObserver 常驻捕获）；
  2. Vue 实例/组件树上缓存的 `preRenderHtml` / `tempContent` 明文；
  3. Vuex store 中的加密正文条目 → 调用组件内部 `decryptRenderHtml()` / `preRender()` 解密（必要时临时翻转 `isShowPreRender` 探测）；
  4. 兜底：扫描普通 DOM（`.readerChapterContent` 等）按文本长度与中文占比评分取最优。
- **chunker.js**：去零宽字符/归一化空白、范围截断和 ≤220 字分块；每块保留整章绝对 UTF-16 起止偏移，语音事件可直接映射正文。
- **speechEngine.js / speechClock.js**：前者封装 `SpeechSynthesisUtterance` 并输出带单调时间的边界事件；后者把稀疏事件变成连续字符位置，历史 CPS 按音色、语速和浏览器持久化。
- **layoutMap.js / scrollFollower.js**：保留排版测量与平滑滚动能力，当前仅用于"确定范围"时的主动定位；语音朗读过程中不自动滚动。
- **settings.js**：语速/音色/续读开关/阅读范围持久化，并兼容读取旧独立 TTS 脚本写入的 `localStorage` 数据（`wr-tts-settings`）。
- **章节监听**：朗读期间 700ms 轮询当前章节 UID，翻章后按"续读"开关决定继续朗读还是停止。

### 4.4 图片类模块

- **imageTools**：`MutationObserver` 监听新增的 `img.wr_readerImage_opacity`，解析真实图片地址（过滤 `loading_*` 占位图、懒加载 `data-src` 等），注入悬浮工具栏；下载走 `GM_download`，异常时降级为 `<a download>` 点击；复制走 `GM_setClipboard`，逐级降级到 `navigator.clipboard` / `execCommand`。
- **imagePreview**：全书图片扫描器。逐轮向下滚动（步长=视口 85%）、等待懒加载（递增重试）、连续触底/无增长判定扫描终点；按 `src` 跨章节去重合并；LRU 缓存控制内存（最多 6 本书 × 每本 1500 张、缩略图资源 120 张）；支持取消（loadToken 失效旧扫描）、进度/ETA 展示、批量复制与批量下载（间隔 1s 逐个触发，规避浏览器并发下载限制）。

### 4.5 控制面板与工具

- **controlPanel**：动态构建整个左侧面板 DOM；宽度/时长/定时/语速滑块全部按档位吸附；自动/语音双 Tab 切换并同步控件状态；点击空白处收起面板；右上角拖拽手柄调整面板宽度。
- **panelDrag / quickBarDrag**：面板与语音快捷条的可拖拽实现，均做边界钳制与位置持久化；快捷条额外支持四边吸附与边缘隐藏（测量滚动条宽度避免贴边遮挡）。

---

## 五、构建与部署

### 6.1 环境要求

- Node.js 20+

### 6.2 安装依赖

```bash
npm install
```

### 6.3 开发（监听构建）

```bash
npm run dev
```

`vite build --watch` 模式，修改源码后自动重新构建到 `dist/`。**注意：`npm run dev` 不会触发版本递增**，避免开发时频繁升版。

### 6.4 正式构建

```bash
npm run build
```

流程说明：

0. **`build/version-bump.js`** 自动递增 `src/metadata.txt` 中的 `@version` 尾号（如 `2.0.2 → 2.0.3`）；
1. `vite.config.js` 读取已递增的 `@version`，产物命名为 `weread.user-<version>.js`；
2. Vite 以 lib 模式打包 `src/main.js` 为**单一 IIFE 文件**（`inlineDynamicImports`，不压缩、CSS 内联）；
3. `build/greasyfork-plugin.js` 在 `generateBundle` 阶段把 `src/metadata.txt`（已含新版本号）头信息拼接到产物顶部；
4. 产物输出到 `dist/`（`emptyOutDir: false`，历史版本保留归档）。

### 6.5 安装到浏览器（开发自测）

1. 打开 Tampermonkey 管理面板 → 新建脚本；
2. 把 `dist/` 中最新版本的 `.user.js` 文件内容整体粘贴进去保存（构建后产物文件名自动跟随版本号）；
3. 打开任意微信读书书籍阅读页（`https://weread.qq.com/web/reader/*`），顶栏右侧出现"设置"按钮即生效。

### 6.6 发布到 GreasyFork

1. 运行 `npm run build`（自动递增版本号并产出最新文件）；
2. 检查 `dist/` 中最新的 `.user.js` 文件：metadata 版本号正确、功能完整、是单文件；
4. 登录 [GreasyFork](https://greasyfork.org/)，新建脚本并粘贴产物内容（或上传文件）；
5. 填写简介时可直接参考根目录 [greasyfork-intro.md](greasyfork-intro.md)。

### 6.7 GreasyFork 发布约束（务必遵守）

- 最终产物是单一 `.user.js` 文件；
- 外部依赖仅保留 `@require https://code.jquery.com/jquery-3.7.1.min.js`；
- 不做远程动态脚本注入，不做站外 `eval`；
- 不固化 `@downloadURL` 和 `@updateURL`。

参考：[Greasy Fork external scripts policy](https://greasyfork.org/en/help/external-scripts)、[Greasy Fork allowed CDNs](https://greasyfork.org/en/help/cdns)、[Greasy Fork meta keys](https://greasyfork.org/en/help/meta-keys)

---

## 六、开发指南：如何新增一个功能模块

1. 在 `src/modules/` 下按功能分类新建目录（如 `src/modules/reading/xxx/`），创建 `index.js` 导出模块对象；
2. 模块对象提供 `init()` 与对外方法，需要全局状态时读写 `appState`，需要调用其他模块时经 `moduleRegistry`；
3. 样式放同目录 `styles.css`，在 `src/main.js` 顶部 `import xxxCss from '...styles.css?raw'` 并 `GM_addStyle`；
4. 在 `src/main.js` 的 `registerModules({ ... })` 中注册，并在 `initialize()` 中调用 `init()`；
5. 需要持久化的状态用 `GM_getValue` / `GM_setValue`（参考 `runtime/state.js` 的键命名风格 `weread_*`）；
6. 功能完成后：`npm run build`（自动递增版本号）→ 检查 `dist/` 产物的 metadata → 自测 → 发布。

---

## 七、维护约定

- **功能基准**：一切功能行为以 [原项目.js](原项目.js)（原始单文件脚本）为准，重构不得改变既有行为；
- 修改功能后同步检查 `@version` 是否需要递增；
- 新增依赖时优先保证产物仍适合 GreasyFork 单文件发布（尽量零依赖）；
- 样式优先放在对应模块目录，不堆回全局样式；
- 涉及站点内部实现（Vue 实例、加密正文）的代码改动时，务必保留多级降级路径；
- 大型设计先写设计文档再实现。
