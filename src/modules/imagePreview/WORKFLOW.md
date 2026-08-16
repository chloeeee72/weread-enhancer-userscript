# imagePreview 工作流

1. 面板渲染：`init` 创建 DOM，顶部保留全选，底部保留三按钮。
2. 图片加载与渲染：`show` 启动扫描，`startBookImageCollection` 去重，`renderImages` 输出列表。
3. 选择与操作：`toggleSelectAll` / `toggleImageSelection` / `copy*` / `download*` / `hide` 负责交互和清理。

## 拆分要点

- 三个功能文件即可，不再继续拆碎。
- 选择状态直接跟随全选按钮和卡片勾选联动。
- 所有子模块继续通过 `this` 共享同一状态对象。
