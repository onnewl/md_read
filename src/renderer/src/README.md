# React 文档工作区

## Overview

`main.tsx` 创建 React 根节点并加载应用样式。`App` 持有打开的文档、各标签草稿、预览、源码和分栏模式、搜索、大纲及主题状态。显示组件从工作区接收数据和回调，工作区通过 `window.mdApi` 与 Electron 交互。 [入口](./main.tsx) · [工作区](./App.tsx) · [桥接类型](./types/README.md)

## Interface

| 入口 | 交接 |
| --- | --- |
| [`main.tsx`](./main.tsx) | 在 `#root` 挂载 `App`，引入 KaTeX、代码高亮及项目样式。 |
| [`App`](./App.tsx) | 串联打开、激活、编辑、刷新、保存和关闭标签。监听菜单、外部打开与文件拖放。 |
| [components](./components/README.md) | 顶部工具栏、标签页、目录、搜索框、Markdown 预览和 CodeMirror 编辑器。 |
| [hooks](./hooks/README.md) | 目录滚动跟随、预览搜索、源码搜索与主题偏好。 |
| [utils](./utils/README.md) | Markdown 树和大纲、搜索范围、预览与源码位置映射、路径检查。 |
| [types](./types/README.md) | `MdApi`、文件载荷和全局 `window.mdApi` 声明。 |
| [界面样式](./styles/global.css) 与 [正文样式](./styles/markdown.css) | 工作区布局、主题、滚动容器及 Markdown 正文样式。 |

## Invariants

### 标签与草稿

- `DocumentTab.id` 取自 `MarkdownFilePayload.filePath`。`content` 是最近一次成功读取的版本，`draftContent` 是当前草稿。任一标签的草稿和原文不同，工作区就向主进程报告未保存状态。 [DocumentTab](./App.tsx) · [setHasUnsavedChanges](./types/README.md)
- `openOrFocusFile` 优先激活现有标签。异步读盘返回后，`commitDocument` 对现存标签再次去重，在普通打开路径中保留原草稿。刷新或保存成功后使用 `replace` 更新该标签的原文和草稿，刷新前会检查是否允许丢弃未保存编辑。 [openOrFocusFile 与 commitDocument](./App.tsx)
- 切换标签时，草稿留在所属标签。关闭或批量关闭时，对受影响的未保存标签确认。用户关闭整个工作区时，由主进程弹出原生确认。 [标签关闭逻辑](./App.tsx) · [主进程关闭处理](../../main/README.md)

### 启动与外部打开

1. React 挂载后向主进程请求启动文件。成功时打开初始标签，失败时记录读取错误。
2. 处理完启动文件后，渲染端等待两个 `requestAnimationFrame` 回调，再调用 `showStartupWindow()` 通知主进程。窗口还需收到 Electron 的 `ready-to-show` 才会显示。
3. 后续外部路径从 `onExternalFileOpen` 接收，串行执行读取或激活，保持请求顺序。拖放和最近打开使用同一套打开或激活逻辑。 [启动与事件订阅](./App.tsx) · [窗口生命周期](../../main/README.md)

### 预览、源码与搜索

- `parseMarkdownDocument` 生成预览树、大纲和标题 ID。编辑时立即更新草稿。源码和分栏模式在输入停顿约 180 毫秒后解析，分栏的左侧预览与大纲使用同一份解析结果。切回预览时使用最新草稿。 [工作区解析](./App.tsx) · [Markdown 工具](./utils/README.md)
- 切换模式时，工作区使用 Markdown 块的源码范围或标题偏移来定位新显示的一栏。分栏的两侧可独立滚动，点击目录时两边都跳转，源码编辑器保留选区。大纲还未刷新时，点击旧目录项会用最新草稿重新查找该标题的位置。 [模式切换和目录跳转](./App.tsx) · [位置映射](./utils/viewPosition.ts)
- 分栏中可拖动分隔线或用左右方向键调整宽度，每次进入分栏时从左右各半开始。 [分隔线组件](./components/SplitDivider.tsx)
- 预览和分栏模式搜索渲染后的正文，源码模式搜索草稿文本。预览中点击目录由 `useOutline.selectHeading` 直接选中目标并滚动正文，平滑跳转期间暂停将左侧活动项带入视野。手动滚动正文离开目标后恢复目录跟随。 [搜索与大纲 Hooks](./hooks/README.md) · [OutlinePanel](./components/OutlinePanel.tsx)

## Side Effects

| 状态或操作 | 位置 |
| --- | --- |
| 最近打开 | `localStorage` 的 `markdown-viewer-recent-files` 保存最多 8 个路径。清除最近打开会清空这一项。 |
| 大纲开关与主题 | `markdown-viewer-outline-open` 和 `markdown-viewer-theme` 写入 `localStorage`，主题同步到页面根元素的 `data-theme`。 |
| 草稿、标签与缩放 | 每个工作区在内存中保存。启动默认缩放 100%，范围为 70% 至 160%，启动时清理旧的 `markdown-viewer-document-zoom` 项。 |
| 保存和系统操作 | 保存调用主进程写文件，打开所在目录和外部链接调用系统 Shell。渲染端用窗口标题中的 `*` 表示当前标签有未保存编辑。 |

这些行为由 [App](./App.tsx)、[useTheme](./hooks/useTheme.ts) 和 [主进程接口](../../main/README.md) 实现。

## Verification

- 从仓库根目录运行 `pnpm build`，检查 TypeScript 类型及 Electron Vite 产物。 [构建脚本](../../../package.json)
- 使用 [示例文档](../../../samples/demo.md) 检查大纲、同名标题、搜索、源文切换、图表、公式及图片。用测试副本检查多个标签的独立草稿、保存和关闭确认。 [系统验收清单](../../../README.md#system-verification)
