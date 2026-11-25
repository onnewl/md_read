# 渲染端类型约定

## Overview

本目录描述渲染进程可通过 `window.mdApi` 调用的 Electron 桥接接口。声明与 preload 暴露的对象保持对应，异步文件操作通过主进程完成。[global.d.ts](./global.d.ts) [preload/index.ts](../../../preload/index.ts)

## Interface

- `MarkdownFilePayload` 的四个字符串字段为 `filePath`、`fileName`、`baseDir`、`content`，分别表示解析后的文件路径、文件名、所在目录和正文。[global.d.ts](./global.d.ts) [main/index.ts](../../../main/index.ts)
- `openStartupMarkdownFile()` 和 `openMarkdownFile()` 返回 `Promise<MarkdownFilePayload | null>`，分别读取启动文件和打开文件选择器。`readMarkdownFile(filePath)` 和 `saveMarkdownFile(filePath, content)` 返回 `Promise<MarkdownFilePayload>`，保存后返回重新读取的文件内容与元数据。[global.d.ts](./global.d.ts) [main/index.ts](../../../main/index.ts)
- `resolveAssetUrl(baseDir, src)` 同步返回资源地址，`getDroppedFilePath(file)` 同步从拖放的 `File` 获取路径。`openExternal(url)` 和 `openContainingFolder(filePath)` 返回 `Promise<void>`，通过系统 Shell 打开链接或目录。[global.d.ts](./global.d.ts) [preload/index.ts](../../../preload/index.ts) [main/index.ts](../../../main/index.ts)
- `showStartupWindow()` 通知主进程首屏已就绪，`setHasUnsavedChanges(hasUnsavedChanges)` 报告窗口是否有未保存的更改。`onExternalFileOpen(callback)` 接收文件路径，`onMenuCommand(callback)` 接收 `MenuCommand`，两者均返回取消订阅函数。[global.d.ts](./global.d.ts) [preload/index.ts](../../../preload/index.ts) [menuCommands.ts](../../../shared/menuCommands.ts)

## Invariants

- `Window.mdApi` 的类型声明与 preload 通过 `contextBridge.exposeInMainWorld` 提供的实现保持一致。菜单通知使用共享的 `MenuCommand` 字符串联合类型。[global.d.ts](./global.d.ts) [preload/index.ts](../../../preload/index.ts) [menuCommands.ts](../../../shared/menuCommands.ts)
- 启动参数中没有文件、用户取消文件选择或选择结果为空时，相应的打开方法返回 `null`。读取和保存要求 `.md` 或 `.markdown` 扩展名，扩展名不合规或文件读写失败时 Promise 会拒绝。[main/index.ts](../../../main/index.ts)
- 事件订阅只把文件路径或菜单命令传给回调，取消订阅时移除该次注册的监听器。[preload/index.ts](../../../preload/index.ts)

## Side Effects

- 运行时调用可打开系统文件选择器、读写 Markdown 文件、打开外部链接或文件所在目录。文件成功读取后，主进程登记其所在目录供图片协议校验。[main/index.ts](../../../main/index.ts)
- 窗口状态通知通过 IPC 发送。首屏就绪通知参与主窗口显示的判断，未保存状态参与关闭窗口时的确认逻辑。事件订阅增删 preload 中的 IPC 监听器。[preload/index.ts](../../../preload/index.ts) [main/index.ts](../../../main/index.ts)

## Verification

- 在仓库根目录运行 `pnpm build`，执行 TypeScript 类型检查和应用构建。[package.json](../../../../package.json)
