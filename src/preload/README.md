# Electron 预加载桥接

## Overview

预加载脚本在工作区的隔离环境中通过 `contextBridge` 暴露 `window.mdApi`，将渲染进程的文件、窗口及系统操作转接到 Electron。渲染进程通过 `MdApi` 声明识别接口。 [contextBridge.exposeInMainWorld](./index.ts#L23) [MdApi](../renderer/src/types/global.d.ts#L10) [主进程契约](../main/README.md)

## Interface

- `openStartupMarkdownFile()` 和 `openMarkdownFile()` 分别请求启动文件及原生对话框选中的文件，返回文件载荷或 `null` 的 Promise。`readMarkdownFile(filePath)` 和 `saveMarkdownFile(filePath, content)` 分别请求读取或保存后回读。四个调用共享 `MarkdownFilePayload`，包含 `filePath`、`fileName`、`baseDir` 和 `content`。 [MarkdownFilePayload](./index.ts#L4) [文件操作](./index.ts#L24)
- `resolveAssetUrl(baseDir, src)` 同步转换本地图片地址。`getDroppedFilePath(file)` 同步调用 `webUtils.getPathForFile` 取得拖入文件的本地路径。 [resolveAssetUrl](./index.ts#L30) [getDroppedFilePath](./index.ts#L52)
- `openExternal(url)` 和 `openContainingFolder(filePath)` 分别请求主进程调用系统应用打开链接或文档所在目录，均返回 `Promise<void>`。 [系统操作](./index.ts#L46)
- `showStartupWindow()` 发送首屏就绪通知，实际显示时机由主进程决定。`setHasUnsavedChanges(hasUnsavedChanges)` 向主进程报告工作区是否有未保存的修改。 [窗口通知](./index.ts#L49) [showWhenReady](../main/index.ts#L522)
- `onExternalFileOpen(callback)` 从 `markdown:open-external-file` 接收文件路径。`onMenuCommand(callback)` 从 `app:menu-command` 接收 `MenuCommand`。两者均返回用于注销本次订阅的函数。 [onExternalFileOpen](./index.ts#L53) [onMenuCommand](./index.ts#L61) [MenuCommand](../shared/menuCommands.ts#L5)

## Invariants

- 桥接方法固定使用各自的 IPC 通道，订阅回调只收到路径或命令载荷。IPC 请求的读写和系统操作由主进程处理。 [contextBridge.exposeInMainWorld](./index.ts#L23) [initializeApplication](../main/index.ts#L609)
- `resolveAssetUrl` 原样返回空字符串、`http:`、`https:`、`data:` 和 `blob:` 地址，以及非支持扩展名的地址。扩展名判断忽略查询串、片段和大小写，支持 `.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.svg`。匹配项以编码后的 `baseDir` 和 `src` 生成 `md-asset://local/image` URL，由主进程验证和读取。 [imageExtensions](./index.ts#L11) [resolveAssetUrl](./index.ts#L30) [registerAssetProtocol](../main/index.ts#L434)
- Electron Vite 将该入口构建为 CommonJS 并关闭依赖外置，以匹配工作区沙箱预加载的入口配置。 [preload 构建配置](../../electron.vite.config.ts#L7) [createWindow](../main/index.ts#L477)

## Side Effects

- 在工作区注册 `window.mdApi`。调用文件或系统方法时发起异步 IPC 请求，调用窗口通知方法时发送 IPC 消息。事件订阅和注销增删对应的 `ipcRenderer` 监听器。 [contextBridge.exposeInMainWorld](./index.ts#L23) [窗口通知](./index.ts#L49) [事件订阅](./index.ts#L53)

## Verification

- 在仓库根目录运行 `pnpm build`，检查 TypeScript 类型和预加载产物构建。 [构建脚本](../../package.json#L13)
- 在实际 Electron 工作区手动检查启动文件、拖放 Markdown 文件、菜单操作及相对图片加载，以覆盖 IPC 与资源协议的运行时交互。 [文件操作](./index.ts#L24) [resolveAssetUrl](./index.ts#L30) [拖放与事件订阅](./index.ts#L52)
