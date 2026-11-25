# Electron 主进程

## Overview

主进程管理 Markdown 工作区窗口、原生菜单和本地文件访问。渲染进程通过预加载桥接调用文件、窗口及系统操作，通过 `md-asset` 协议加载符合条件的本地图片。应用入口与桥接分别由构建配置和窗口配置指定。 [应用入口](../../package.json#L5) [createWindow](./index.ts#L477) [预加载桥接](../preload/README.md)

## Interface

- 工作区窗口处理 `markdown:open-startup-file`，读取启动参数中的文件，无启动文件时返回 `null`。`markdown:open-external-file` 事件向工作区提供后续请求的文件路径。 [createWindow](./index.ts#L477)
- `markdown:open-file` 打开原生单文件选择对话框，取消或未选择文件时返回 `null`。`markdown:read-file` 接收路径，`markdown:save-file` 接收路径和内容。读取或保存成功后返回 `{ filePath, fileName, baseDir, content }`。 [initializeApplication](./index.ts#L609) [readMarkdownFile](./index.ts#L56) [saveMarkdownFile](./index.ts#L82)
- `window:startup-rendered` 接收工作区的首屏就绪通知，`window:set-unsaved-changes` 接收发送窗口的未保存状态。 [createWindow](./index.ts#L477) [window:set-unsaved-changes](./index.ts#L643)
- `shell:open-external` 接收 URL，`shell:open-containing-folder` 接收 Markdown 文件路径。原生菜单通过 `app:menu-command` 向工作区发送共享的 `MenuCommand`，帮助菜单可直接打开关于和许可证窗口。 [系统操作 IPC](./index.ts#L652) [sendMenuCommand](./index.ts#L302) [createApplicationMenu](./index.ts#L311) [MenuCommand](../shared/menuCommands.ts#L5)
- `md-asset` 协议从查询参数 `baseDir` 和 `src` 取得图片路径，成功时返回带图片 MIME 类型和 `cache-control: no-store` 的响应。 [registerAssetProtocol](./index.ts#L434)

## Invariants

- 工作区启用 `contextIsolation` 和沙箱，关闭 `nodeIntegration`，加载 `../preload/index.cjs`。关于和许可证窗口使用相同的隔离设置，拥有父窗口时以模态显示。 [createWindow](./index.ts#L477) [createHtmlWindow](./index.ts#L111)
- 工作区初始隐藏，同时收到 Electron 的 `ready-to-show` 和渲染进程的 `window:startup-rendered` 后才显示，并依序发送排队的打开请求。启动阶段的超时阈值为 15 秒，加载失败或渲染进程退出也可使启动提前失败。 [showWhenReady](./index.ts#L522) [failStartup](./index.ts#L536) [rendererUrl](./index.ts#L599)
- 文件读写先将路径解析为绝对路径，并按不区分大小写的扩展名接受 `.md` 或 `.markdown`。成功读取后登记父目录，保存先写入 UTF-8 再重新读取。 [isMarkdownPath](./index.ts#L46) [readMarkdownFile](./index.ts#L56) [saveMarkdownFile](./index.ts#L82)
- 图片请求要求 `baseDir` 解析后的路径已被登记，`src` 使用相对路径。剥离 `src` 中的查询串或片段后解析实际路径，扩展名限于 `.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.svg`。 [imageMimeTypes](./index.ts#L21) [registerAssetProtocol](./index.ts#L434)
- `shell:open-external` 处理器接受 `http://`、`https://`、`mailto:` 和 `tel:`，`shell:open-containing-folder` 处理器仅处理 Markdown 扩展名的路径。 [系统操作 IPC](./index.ts#L652)
- Windows 打包运行时获取单实例锁，后续启动在应用初始化后复用工作区，窗口不存在时创建。启动时从命令行筛选首个符合 Markdown 扩展名且不以 `-` 开头的参数。 [startApplication](./index.ts#L679)

## Side Effects

- 读取、创建或覆盖本地 Markdown 文件，记录成功读取的文件所在目录。响应资源协议时读取本地图片，打开许可证窗口时从应用目录读取 `THIRD_PARTY_NOTICES.md`。 [readMarkdownFile](./index.ts#L56) [saveMarkdownFile](./index.ts#L82) [registerAssetProtocol](./index.ts#L434) [showThirdPartyNoticesWindow](./index.ts#L144)
- 设置应用菜单，调用原生文件选择框和系统 Shell。工作区的窗口打开处理器把 URL 交给 `shell.openExternal` 并阻止创建新窗口。 [createApplicationMenu](./index.ts#L311) [initializeApplication](./index.ts#L609) [setWindowOpenHandler](./index.ts#L560)
- 按 `webContents.id` 记录未保存状态。工作区尝试关闭时，如该窗口有未保存的修改，则显示原生确认框。取消时阻止关闭，确认或关闭完成时清理记录。启动失败时显示原生错误框并销毁未就绪的窗口。 [window:set-unsaved-changes](./index.ts#L643) [窗口关闭处理](./index.ts#L565) [failStartup](./index.ts#L536)
- Windows 打包运行且没有 `user-data-dir` 参数时，创建默认 `userData` 目录下的 `windows-profile`，并将 `userData` 和 `sessionData` 指向它。创建失败或获取单实例锁失败时退出进程。 [startApplication](./index.ts#L679)

## Verification

- 在仓库根目录运行 `pnpm build`，执行 TypeScript 类型检查和 Electron Vite 构建。应用脚本没有定义独立测试入口。 [构建脚本](../../package.json#L13)
- 在实际 Electron 窗口手动检查打开和取消、读写 Markdown、本地图片及未保存时关闭。Windows 打包版的重复启动和文件交付需要在打包应用中检查。 [initializeApplication](./index.ts#L609) [registerAssetProtocol](./index.ts#L434) [createWindow](./index.ts#L477) [startApplication](./index.ts#L679)
