# 渲染层 Hooks

## Overview

本包把预览滚动、正文搜索、源码搜索和主题偏好接入 React。应用为当前模式提供 Markdown 正文根节点或 CodeMirror 实例，并将搜索结果和大纲状态交给界面组件。见 [App](../App.tsx)、[MarkdownViewer](../components/MarkdownViewer.tsx) 和 [SourceEditor](../components/SourceEditor.tsx)。

## Interface

- `useOutline(scrollRootRef, contentRootRef, outline, previewDocumentId)` 返回 `activeId`、`followActive` 和 `selectHeading(item)`。空的预览文档 ID 表示预览未启用。见 [useOutline.ts](./useOutline.ts)。
- `useSearchHighlight(rootRef, query, contentKey, renderedTree)` 搜索预览正文，返回 `matchCount`、从 0 开始的 `currentIndex`、`goToNext`、`goToPrevious` 和 `clear`。当前渲染树变化时，按新正文重建高亮。见 [useSearchHighlight.ts](./useSearchHighlight.ts)。
- `useCodeMirrorSearch(editorViewRef, content, query, contentKey)` 搜索当前 Markdown 源码，返回与预览搜索同名的计数、索引和操作。见 [useCodeMirrorSearch.ts](./useCodeMirrorSearch.ts)。
- `useTheme()` 返回 `theme` 和 `toggleTheme`。`Theme` 的取值为 `light` 和 `dark`。见 [useTheme.ts](./useTheme.ts)。

## Invariants

- `useOutline` 依赖文档顺序的大纲，在预览正文内部按标题 ID 查找节点，并兼容 `user-content-` 前缀。预览未启用、引用缺失或找不到任何标题时，活动 ID 为空。正常滚动选择最后一个进入距滚动容器顶部 24 像素以内的标题，尚未到达首个标题时选中首项。见 [useOutline](./useOutline.ts) 和 [parseMarkdownDocument](../utils/markdownOutline.ts)。
- 点击预览目录时，`selectHeading` 立即选中点击项并关闭目录侧的自动跟随，目标滚动位置限制在实际可滚范围内。平滑跳转经过其他标题或多个文末标题共享滚动上限时，仍保留点击项。跳转结束后，正文滚动位置与目标的差值超过 1 像素时恢复按位置选中和跟随。见 [selectHeading 和 updateByScrollPosition](./useOutline.ts) 和 [OutlinePanel](../components/OutlinePanel.tsx)。
- 两种搜索都去除查询首尾空白，按大小写不敏感的字面量匹配，延迟 150 毫秒后更新结果。命中后从首项开始，上下跳转循环，无结果时索引为 `-1`。调用方用 `contentKey` 标识文件和模式，使用当前模式的搜索结果，并将清空操作接到查询文本状态。见 [useSearchHighlight](./useSearchHighlight.ts)、[useCodeMirrorSearch](./useCodeMirrorSearch.ts) 和 [App](../App.tsx)。
- 预览从渲染后的文本节点取命中，对高亮代码允许跨语法令牌匹配，普通正文按单个文本节点搜索。源码从草稿文本计算非重叠的字符区间，并向 CodeMirror 提交同一查询。见 [collectSearchRanges](../utils/searchHighlight.ts) 和 [findMatches](./useCodeMirrorSearch.ts)。
- `useTheme` 优先采用有效的本地偏好，缺少有效值时以系统的 `prefers-color-scheme` 初始化。见 [getInitialTheme](./useTheme.ts)。

## Side Effects

- `useOutline` 监听预览滚动和滚动结束事件，用 `ResizeObserver` 观察滚动容器与正文尺寸，依赖变化或卸载时清理监听和跳转状态。使用即时滚动或平滑滚动，取决于实际滚动距离、`scrollend` 支持和减弱动态效果偏好。见 [useOutline.ts](./useOutline.ts)。
- 平台支持 CSS Custom Highlight API 时，预览搜索向注册表写入全部命中和当前命中的 `Range`。开始查询时记录正文滚动位置，查询文本清空时尝试恢复，文件或模式键变化时丢弃旧位置。效应清理会清除计时器和已注册高亮。见 [useSearchHighlight](./useSearchHighlight.ts) 和 [搜索高亮工具](../utils/searchHighlight.ts)。
- 源码搜索向编辑器派发查询、选区和视口定位事务。查询更新后自动滚到首个命中并保持当前焦点，显式跳到上一项或下一项时聚焦编辑器。见 [revealMatch](./useCodeMirrorSearch.ts)。
- 主题初始化和切换时同步设置根元素的 `data-theme`，并写入 `localStorage` 的 `markdown-viewer-theme`。见 [useTheme.ts](./useTheme.ts)。

## Verification

- 在仓库根目录运行 `pnpm build`，执行 TypeScript 检查和 Electron Vite 构建。见 [package.json](../../../../package.json)。
