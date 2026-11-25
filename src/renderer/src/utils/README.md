# 渲染端工具

## Overview

本目录提供 Markdown 解析与大纲生成、预览搜索、源码位置与预览滚动位置映射，以及路径字符串处理。工作区解析当前文档，再将语法树交给正文组件，将大纲交给导航组件。[App.tsx](../App.tsx)

## Interface

- `parseMarkdownDocument(markdown)` 返回 `{ tree, outline }`。`OutlineItem` 包含 `id`、`text`、`depth`、`index`、`line`、`offset`。`remarkParsedDocument(tree)` 作为 remark 插件将这棵树接入预览管线。[markdownOutline.ts](./markdownOutline.ts)
- `createHeadingSlugger()` 返回一个有状态的标题 ID 生成函数，按调用顺序处理重复标题。[slug.ts](./slug.ts)
- `countSearchMatches(root, query)` 返回命中数量，`highlightSearch(root, query)` 返回并记录命中的 `Range[]`。`activateSearchMatch(index)` 设置当前命中样式，`scrollToSearchMatch(index)` 滚动到指定命中，`clearSearchHighlights(root)` 清除搜索状态。[searchHighlight.ts](./searchHighlight.ts)
- `getPreviewSourceOffset(scrollRoot, contentRoot, fallbackOffset)` 从视口顶部附近选取源码偏移，缺少可用节点时返回兜底偏移。`scrollPreviewToSourceOffset(scrollRoot, contentRoot, sourceOffset)` 尝试恢复预览位置，返回是否找到目标节点。[viewPosition.ts](./viewPosition.ts)
- `isMarkdownFilePath(filePath)` 检查大小写不敏感的 `.md` 或 `.markdown` 后缀。`getFileName(filePath)` 识别 `/` 和 `\`，返回最后一个非空路径段，找不到路径段时返回原字符串。[pathUtils.ts](./pathUtils.ts)

## Invariants

- 使用启用 GFM 和数学语法的解析器。大纲和预览共用一棵语法树及同一组标题 ID。每次解析为当前文档创建一个 slug 生成器，按文档顺序访问标题并跳过空标题。`index` 从 0 开始，缺失源码位置时 `line` 和 `offset` 分别取 1 和 0。[markdownOutline.ts](./markdownOutline.ts)
- 搜索查询先去除首尾空白，再按大小写不敏感的字面量查找非重叠命中。正文以单个文本节点为单位，代码块允许跨语法高亮令牌匹配。结果按 DOM 起点排序，导航索引从 0 开始。代码工具栏、图片失败占位、Mermaid 加载提示及指定交互元素中的文字会被过滤。[searchHighlight.ts](./searchHighlight.ts)
- 位置映射依赖正文中的 `data-source-start` 和 `data-source-end`，要求两个偏移是有限数值、结束偏移不早于起点且元素边界矩形的高度大于零。获取位置时，同等视口距离下优先更小的范围。恢复位置时依次选择最小的包含范围、起点最近的前方块、起点最近的后方块。[viewPosition.ts](./viewPosition.ts) [MarkdownViewer.tsx](../components/MarkdownViewer.tsx)

## Side Effects

- `parseMarkdownDocument` 在返回的新语法树上写入标题的 `data.hProperties.id`，`remarkParsedDocument` 设置预览处理器的 `parser`。[markdownOutline.ts](./markdownOutline.ts)
- 高亮函数维护模块内共享的命中列表，并在浏览器支持时修改 `CSS.highlights` 中的 `markdown-search-results` 和 `markdown-search-current`。搜索匹配通过 DOM `Range` 记录，保留 React 管理的正文节点。`scrollToSearchMatch` 平滑滚动正文，命中代码块时还可横向滚动代码容器。[searchHighlight.ts](./searchHighlight.ts) [useSearchHighlight.ts](../hooks/useSearchHighlight.ts)
- `scrollPreviewToSourceOffset` 直接设置预览容器的 `scrollTop`，在定位成功时为目标节点留出 12 像素的顶部间距，滚动值下限为 0。[viewPosition.ts](./viewPosition.ts)

## Verification

- 在仓库根目录运行 `pnpm build`，执行 TypeScript 类型检查和应用构建。[package.json](../../../../package.json)
