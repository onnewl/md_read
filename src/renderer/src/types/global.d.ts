import type { MenuCommand } from "../../../shared/menuCommands";

export type MarkdownFilePayload = {
  filePath: string;
  fileName: string;
  baseDir: string;
  content: string;
};

export type MdApi = {
  openMarkdownFile(): Promise<MarkdownFilePayload | null>;
  readMarkdownFile(filePath: string): Promise<MarkdownFilePayload>;
  saveMarkdownFile(filePath: string, content: string): Promise<MarkdownFilePayload>;
  resolveAssetUrl(baseDir: string, src: string): string;
  openExternal(url: string): Promise<void>;
  openContainingFolder(filePath: string): Promise<void>;
  setHasUnsavedChanges(hasUnsavedChanges: boolean): void;
  getDroppedFilePath(file: File): string;
  onMenuCommand(callback: (command: MenuCommand) => void): () => void;
};

declare global {
  interface Window {
    mdApi: MdApi;
  }
}
