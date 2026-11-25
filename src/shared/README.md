# 共享菜单命令

## Overview

主进程菜单、预加载事件桥接和渲染工作区共享 `MenuCommand` 类型。原生菜单选择产生的命令通过 `app:menu-command` 发给工作区，再由渲染端执行对应操作。 [MenuCommand](./menuCommands.ts#L5) [sendMenuCommand](../main/index.ts#L302) [onMenuCommand](../preload/index.ts#L61) [工作区命令处理](../renderer/src/App.tsx#L538)

## Interface

- `MenuCommand` 导出十个字符串字面量的联合类型。文件和标签操作包括 `open-file`、`save-file`、`refresh-file`、`close-tab`。查找和视图操作包括 `find`、`zoom-in`、`zoom-out`、`reset-zoom`、`toggle-theme`、`toggle-outline`。 [MenuCommand](./menuCommands.ts#L5)

## Invariants

- 原生菜单发送函数、预加载菜单回调和渲染端 `MdApi` 声明均引用同一命令类型。命令值应与渲染端分支保持一致，实际命令行为由工作区中的分支实现。 [sendMenuCommand](../main/index.ts#L302) [onMenuCommand](../preload/index.ts#L61) [MdApi](../renderer/src/types/global.d.ts#L10) [工作区命令处理](../renderer/src/App.tsx#L538)

## Side Effects

- 无。该文件只导出类型。 [MenuCommand](./menuCommands.ts#L5)

## Verification

- 在仓库根目录运行 `pnpm build`，执行 TypeScript 类型检查和构建。在实际 Electron 窗口选择原生菜单项，另行检查命令是否触发对应工作区操作。 [构建脚本](../../package.json#L13) [createApplicationMenu](../main/index.ts#L311) [工作区命令处理](../renderer/src/App.tsx#L538)
