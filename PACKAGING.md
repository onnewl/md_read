# 打包说明

本项目使用 `electron-builder` 生成桌面应用安装包，产物默认输出到当前版本目录，例如 `release/0.1.4/`。

## 基础命令

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

## 跨平台注意事项

- macOS 的 `dmg` / `zip` 最稳妥是在 macOS 上构建。
- Windows 的 `nsis` 通常可以在 macOS / Linux 上交叉构建，但可能需要 Wine 环境；最稳妥是在 Windows CI 或 Windows 机器上构建。
- Linux 的 `AppImage` / `deb` 最稳妥是在 Linux 或 Linux CI 上构建。
- 未配置代码签名和公证，因此 macOS / Windows 首次打开时可能出现系统安全提示。正式发布需要配置 Apple Developer ID、Windows 代码签名证书和对应 CI secrets。
- 当前使用 `build/icon.icns`、`build/icon.ico`、`build/icon.png` 作为 macOS、Windows、Linux 应用图标。
- Linux `deb` 包要求 `homepage`、`author.email` 或 `linux.maintainer` 等元数据；当前使用示例维护者信息，正式发布前请替换为真实项目地址和维护者邮箱。
