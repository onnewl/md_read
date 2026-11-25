import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { MenuCommand } from "../shared/menuCommands";

type MarkdownFilePayload = {
  filePath: string;
  fileName: string;
  baseDir: string;
  content: string;
};

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

function isExternalUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
}

function getExtension(src: string): string {
  const cleanPath = src.split(/[?#]/, 1)[0] ?? "";
  const match = cleanPath.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

contextBridge.exposeInMainWorld("mdApi", {
  openStartupMarkdownFile: () => ipcRenderer.invoke("markdown:open-startup-file") as Promise<MarkdownFilePayload | null>,
  openMarkdownFile: () => ipcRenderer.invoke("markdown:open-file") as Promise<MarkdownFilePayload | null>,
  readMarkdownFile: (filePath: string) =>
    ipcRenderer.invoke("markdown:read-file", filePath) as Promise<MarkdownFilePayload>,
  saveMarkdownFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("markdown:save-file", filePath, content) as Promise<MarkdownFilePayload>,
  resolveAssetUrl: (baseDir: string, src: string) => {
    if (!src || isExternalUrl(src)) {
      return src;
    }

    if (!imageExtensions.has(getExtension(src))) {
      return src;
    }

    const params = new URLSearchParams({
      baseDir,
      src
    });

    return `md-asset://local/image?${params.toString()}`;
  },
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url) as Promise<void>,
  openContainingFolder: (filePath: string) =>
    ipcRenderer.invoke("shell:open-containing-folder", filePath) as Promise<void>,
  showStartupWindow: () => ipcRenderer.send("window:startup-rendered"),
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) =>
    ipcRenderer.send("window:set-unsaved-changes", hasUnsavedChanges),
  getDroppedFilePath: (file: File) => webUtils.getPathForFile(file),
  onExternalFileOpen: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on("markdown:open-external-file", listener);

    return () => {
      ipcRenderer.removeListener("markdown:open-external-file", listener);
    };
  },
  onMenuCommand: (callback: (command: MenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: MenuCommand) => callback(command);
    ipcRenderer.on("app:menu-command", listener);

    return () => {
      ipcRenderer.removeListener("app:menu-command", listener);
    };
  }
});
