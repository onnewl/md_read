# 渲染层组件

## Overview

本包提供 Markdown 预览、CodeMirror 源码编辑区、大纲、搜索框、工具栏和文档标签页。应用层持有文档草稿、当前模式与搜索状态，文件操作通过应用回调或 Electron preload 接口发起。见 [App](../App.tsx) 和 [MdApi](../types/global.d.ts)。

## Interface

- `MarkdownViewer` 接收 `content`、`tree`、`baseDir`、`theme` 和 `contentRef`，渲染相应的 Markdown 语法树，并暴露预览正文根节点。见 [MarkdownViewer.tsx](./MarkdownViewer.tsx)。
- `SourceEditor` 接收当前草稿 `value`、`fileName`、`theme` 和可选的 `initialRevealOffset`，通过 `editorViewRef` 暴露 CodeMirror 实例，以 `onChange` 和 `onActiveOffsetChange` 上报草稿与位置。见 [SourceEditor.tsx](./SourceEditor.tsx)。
- `OutlinePanel` 用有序的 `OutlineItem[]`、`activeId`、`followActive` 显示大纲，并通过 `onSelectItem(item)` 通知应用跳转。见 [OutlinePanel.tsx](./OutlinePanel.tsx) 和 [OutlineItem](../utils/markdownOutline.ts)。
- `TopBar` 将文件操作、最近记录、视图切换、缩放、大纲、搜索和主题操作交给调用方回调。`ViewMode` 包含 `preview`、`source` 和 `split`。`SearchBox` 接收查询、零基索引和命中数，Enter 跳到下一项，Shift+Enter 跳到上一项，Escape 清空查询。见 [TopBar.tsx](./TopBar.tsx) 和 [SearchBox.tsx](./SearchBox.tsx)。
- `TabBar` 按 `DocumentTabSummary` 的 ID、文件名、路径和未保存标记显示标签。选择、关闭指定项、关闭其他和关闭右侧各有独立回调。`EmptyState` 在无活动文档时提供打开文件的入口。见 [TabBar.tsx](./TabBar.tsx) 和 [EmptyState.tsx](./EmptyState.tsx)。
- `CodeBlock` 接收代码及可选语言，提供高亮和复制。`MermaidBlock` 接收图表代码和主题，异步渲染 Mermaid 图表。见 [CodeBlock.tsx](./CodeBlock.tsx) 和 [MermaidBlock.tsx](./MermaidBlock.tsx)。

## Invariants

- 预览和源码模式都使用当前标签的草稿。预览复用解析器交给大纲的同一棵树，标题 ID 对应大纲项。Markdown 经 `rehypeRaw`、`rehypeSanitize`、`rehypeKatex` 处理，随后为受支持的块添加来自语法树位置的 `data-source-start` 和 `data-source-end`。这些偏移用于切换模式时尽量保持阅读位置，缺少可定位的块时应用尝试按标题定位。见 [App](../App.tsx)、[MarkdownViewer](./MarkdownViewer.tsx)、[parseMarkdownDocument](../utils/markdownOutline.ts) 和 [viewPosition.ts](../utils/viewPosition.ts)。
- 大纲折叠按标题深度隐藏连续子项，并清理文档中已不存在的折叠 ID。只有 `followActive` 为真时，可见的当前项才自动滚入目录视野。预览模式中点击大纲先选中点击项，正文离开跳转位置时恢复跟随。源码模式中，光标可见时按光标定位，视口变化且光标已在视口外时按视口起点定位。若点击时源码大纲因输入延迟尚未更新，应用按标题 ID 在最新草稿中重找字符偏移。见 [OutlinePanel](./OutlinePanel.tsx)、[SourceEditor](./SourceEditor.tsx)、[渲染层 Hooks](../hooks/README.md) 和 [App](../App.tsx)。
- 应用以活动文档 ID 作为源码编辑器的键。编辑器挂载时将初始偏移截断到文档范围，外部草稿同步只在内容有变化时替换文档，并抑制回传，避免重新发出 `onChange`。主题通过 CodeMirror 的 `Compartment` 更新。见 [SourceEditor.tsx](./SourceEditor.tsx) 和 [App](../App.tsx)。
- 文档未打开时，工具栏禁用刷新、保存、打开所在文件夹、模式切换和搜索。保存还要求草稿有修改且当前没有保存请求。应用负责在关闭或刷新有未保存内容的文档前确认是否丢弃草稿。见 [TopBar.tsx](./TopBar.tsx) 和 [App](../App.tsx)。

## Side Effects

- 预览的页内锚点在当前文档内滚动，其他链接经 `mdApi.openExternal` 交给主进程处理。图片经 `mdApi.resolveAssetUrl(baseDir, src)` 解析地址，加载失败时显示备用提示。见 [MarkdownViewer.tsx](./MarkdownViewer.tsx) 和 [preload 接口](../../../preload/index.ts)。
- `CodeBlock` 将未加高亮的代码文本写入系统剪贴板。Mermaid 按需加载渲染库，以 `securityLevel: "strict"` 渲染 SVG，丢弃过期的异步结果，失败时展示错误和图表源码。见 [CodeBlock.tsx](./CodeBlock.tsx) 和 [MermaidBlock.tsx](./MermaidBlock.tsx)。
- `SourceEditor` 创建并销毁 `EditorView`，管理外部实例引用及首帧滚动。标签右键菜单开启时监听窗口的点击和按键来收起菜单。文件打开、读取、保存和关闭等操作由 `App` 响应组件回调处理。见 [SourceEditor.tsx](./SourceEditor.tsx)、[TabBar.tsx](./TabBar.tsx) 和 [App](../App.tsx)。

## Verification

- 在仓库根目录运行 `pnpm build`，执行 TypeScript 检查和 Electron Vite 构建。见 [package.json](../../../../package.json)。
