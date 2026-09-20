/**
 * 主进程可以发送给 Markdown 工作区的应用菜单命令。
 * 固定命令集合可以避免 preload 暴露任意 IPC 通道或任意事件名。
 */
export type MenuCommand =
  | "open-file"
  | "save-file"
  | "refresh-file"
  | "close-tab"
  | "find"
  | "zoom-in"
  | "zoom-out"
  | "reset-zoom"
  | "toggle-theme"
  | "toggle-outline";
