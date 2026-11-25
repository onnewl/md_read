# 打包说明

本项目使用 `electron-builder` 生成桌面应用安装包，产物默认输出到当前版本目录，例如 `release/0.1.4/`。

## 基础命令

使用 Node.js 24 和 pnpm 10。首次运行 `pnpm dev` 或 `pnpm preview` 时会按需下载锁定版本的 Electron 二进制文件。

```bash
pnpm install
pnpm build
```

## 按平台打包

```bash
# 当前平台默认打包
pnpm dist

# macOS: dmg + zip，支持 x64 / arm64
pnpm dist:mac

# Windows: nsis 安装包 + portable，支持 x64
pnpm dist:win

# Linux: AppImage + deb，支持 x64
pnpm dist:linux

# 一次性请求三个平台目标
pnpm dist:all
```

每次修改 `package.json` 的 `version` 后，新产物会进入对应版本目录，例如 `release/0.1.4/`、`release/0.1.5/`，避免不同版本安装包混在一起。

Windows 便携包生成后也会更新 `release/Markdown Viewer Portable.exe`。桌面快捷方式可以指向这个固定文件。若 Windows 提示文件被占用，关闭正在运行的便携版后再打包。

Windows 打包直接使用 `out/` 中已编译的应用，包含随前端产物打包的依赖，并排除重复的 `node_modules`。如果以后为主进程增加运行时外部模块，需要同步核对 `build.files`。单文件便携包使用 ZIP 负载，启动时会解包。

## Windows 绿色版

绿色版是可直接运行的应用目录。下面的两条命令需要在项目根目录运行。

```powershell
pnpm build
pnpm exec electron-builder --win --x64 --dir --publish never
```

产物在 `release/<版本>/win-unpacked/`，启动入口为 `Markdown Viewer.exe`。分发时复制整个目录，Electron 运行时和 `resources/app.asar` 都在其中。有已按锁定版本准备好的 Windows x64 Electron 运行时时，可以给第二条命令追加 `--config.electronDist=node_modules/electron/dist`，前提是该目录确实包含该版本的完整运行时。

本地固定绿色版目录可使用 `release/Markdown Viewer Green/`。更新固定路径时，关闭正在使用的绿色版，保留现有版本的目录副本，然后用完整的新目录替换。桌面快捷方式可指向固定目录里的 `Markdown Viewer.exe`，`.md` 的默认打开方式由 Windows 设置。单文件便携包的构建钩子会更新自己的固定 EXE，绿色版目录需要单独更新。

## 产物核验

- 核对 Windows EXE 的文件版本与 [package.json](./package.json) 一致。检查绿色版或安装后的应用目录时，确认应用 EXE 同目录存在 `resources/app.asar`。
- 检查 `app.asar` 的文件清单，确认只包含编译产物、项目元数据和许可证。打包规则见 [package.json](./package.json) 的 `build.files`。
- 运行目标包，用 [samples/demo.md](./samples/demo.md) 检查预览、图表、公式、本地图片及源码切换。在 Windows 上再验证文件关联、多个文档标签、最小化后双击恢复和草稿保护。

## 跨平台注意事项

- 此版本的 Electron 要求 macOS 13（Ventura）或更新版本。
- macOS 的 `dmg` / `zip` 最稳妥是在 macOS 上构建。
- Windows 的 `nsis` 通常可以在 macOS / Linux 上交叉构建，但可能需要 Wine 环境；最稳妥是在 Windows CI 或 Windows 机器上构建。
- Linux 的 `AppImage` / `deb` 最稳妥是在 Linux 或 Linux CI 上构建。
- 未配置代码签名和公证，因此 macOS / Windows 首次打开时可能出现系统安全提示。正式发布需要配置 Apple Developer ID、Windows 代码签名证书和对应 CI secrets。
- 当前使用 `build/icon.icns`、`build/icon.ico`、`build/icon.png` 作为 macOS、Windows、Linux 应用图标。
- Linux `deb` 包要求 `homepage`、`author.email` 或 `linux.maintainer` 等元数据；当前使用示例维护者信息，正式发布前请替换为真实项目地址和维护者邮箱。
