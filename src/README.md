# 应用源码

## Overview

源码由 Electron 主进程、预加载桥接、React 渲染端和共享类型组成。主进程提供本地操作，预加载暴露具体的 IPC 方法，渲染端持有文档标签、草稿和浏览状态。菜单命令类型在三层之间共享。 [构建配置](../electron.vite.config.ts)

## Subdirectories & Boundaries

| 目录 | 职责 |
| --- | --- |
| [main](./main/README.md) | 工作区与原生菜单，Markdown 读写，Windows 文件关联启动，本地图片协议。 |
| [preload](./preload/README.md) | 把受约束的 IPC 调用和事件订阅暴露给 `window.mdApi`。 |
| [renderer](./renderer/README.md) | React 工作区、查看和编辑、目录、搜索与偏好。 |
| [shared](./shared/README.md) | 跨进程共享的原生菜单命令类型。 |
