# 渲染进程

## Overview

Electron Vite 从仓库根目录的 `index.html` 加载 React 入口。渲染代码负责本地文档的预览和编辑，文件系统与系统 Shell 操作经 `window.mdApi` 转给主进程。 [HTML 入口](../../index.html) · [构建配置](../../electron.vite.config.ts) · [预加载桥接](../preload/README.md)

## Subdirectories & Boundaries

- [src](./src/README.md) 记录工作区状态、组件、渲染流程与 Electron IPC 的交接。
