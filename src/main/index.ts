import { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell, type MenuItemConstructorOptions } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { extname, basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MenuCommand } from "../shared/menuCommands";

type MarkdownFilePayload = {
  filePath: string;
  fileName: string;
  baseDir: string;
  content: string;
};

const markdownExtensions = new Set([".md", ".markdown"]);
const imageMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"]
]);
const openedMarkdownDirs = new Set<string>();
const unsavedWindowIds = new Set<number>();
const productName = "Markdown Viewer";
let applicationWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "md-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false
    }
  }
]);

function isMarkdownPath(filePath: string): boolean {
  return markdownExtensions.has(extname(filePath).toLowerCase());
}

/**
 * 读取 Markdown 文件并登记其所在目录，供后续图片协议做最小权限校验。
 * @param filePath 本地 Markdown 文件路径。
 * @returns 渲染进程需要的文件元数据和正文内容。
 * @throws 当文件扩展名不合法或读取失败时抛出错误。
 */
async function readMarkdownFile(filePath: string): Promise<MarkdownFilePayload> {
  const resolvedPath = resolve(filePath);

  if (!isMarkdownPath(resolvedPath)) {
    throw new Error("只能打开 .md 或 .markdown 文件。");
  }

  const content = await readFile(resolvedPath, "utf8");
  const baseDir = dirname(resolvedPath);
  openedMarkdownDirs.add(baseDir);

  return {
    filePath: resolvedPath,
    fileName: basename(resolvedPath),
    baseDir,
    content
  };
}

/**
 * 保存 Markdown 文件并返回重新读取后的内容。
 * @param filePath 目标 Markdown 文件路径，仅允许 .md / .markdown。
 * @param content 要写入磁盘的 UTF-8 文本。
 * @returns 保存后的文件元数据和正文内容。
 * @throws 当扩展名不合法或写入失败时抛出错误。
 */
async function saveMarkdownFile(filePath: string, content: string): Promise<MarkdownFilePayload> {
  const resolvedPath = resolve(filePath);

  if (!isMarkdownPath(resolvedPath)) {
    throw new Error("只能保存 .md 或 .markdown 文件。");
  }

  await writeFile(resolvedPath, content, "utf8");
  return readMarkdownFile(resolvedPath);
}

function createResponse(message: string, status = 400): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createHtmlWindow(title: string, html: string, parentWindow?: BrowserWindow): BrowserWindow {
  const childWindow = new BrowserWindow({
    width: 720,
    height: 620,
    minWidth: 520,
    minHeight: 420,
    title,
    parent: parentWindow,
    modal: Boolean(parentWindow),
    backgroundColor: "#f6f8fb",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  childWindow.webContents.on("will-navigate", (event, url) => {
    if (url === "markdown-viewer://close-window") {
      event.preventDefault();
      childWindow.close();
    }
  });
  childWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  void childWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return childWindow;
}

async function readBundledTextFile(fileName: "LICENSE" | "THIRD_PARTY_NOTICES.md"): Promise<string> {
  return readFile(resolve(app.getAppPath(), fileName), "utf8");
}

async function showThirdPartyNoticesWindow(parentWindow?: BrowserWindow): Promise<void> {
  let notices = "";

  try {
    notices = await readBundledTextFile("THIRD_PARTY_NOTICES.md");
  } catch (error) {
    notices = `无法读取第三方许可证说明。\n\n${error instanceof Error ? error.message : "Unknown error"}`;
  }

  createHtmlWindow(
    "第三方开源许可证",
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <title>第三方开源许可证</title>
    <style>
      body {
        margin: 0;
        background: #f6f8fb;
        color: #1f2937;
        font: 14px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      }
      main {
        max-width: 840px;
        margin: 0 auto;
        padding: 28px 32px;
      }
      .window-actions {
        position: sticky;
        top: 0;
        display: flex;
        justify-content: flex-end;
        padding-bottom: 14px;
        background: #f6f8fb;
      }
      .close-button {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 6px;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: 13px/1.65 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="window-actions">
        <a class="close-button" href="markdown-viewer://close-window">关闭</a>
      </div>
      <pre>${escapeHtml(notices)}</pre>
    </main>
  </body>
</html>`,
    parentWindow
  );
}

function showAboutWindow(parentWindow?: BrowserWindow): void {
  const version = app.getVersion();
  const aboutWindow = createHtmlWindow(
    `关于 ${productName}`,
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <title>关于 ${productName}</title>
    <style>
      body {
        display: flex;
        min-height: 100vh;
        align-items: center;
        justify-content: center;
        margin: 0;
        background: #f6f8fb;
        color: #1f2937;
        font: 14px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      }
      main {
        width: min(480px, calc(100vw - 48px));
        padding: 28px;
        border: 1px solid #d8dee9;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 6px;
        font-size: 24px;
      }
      p {
        margin: 8px 0;
      }
      a {
        display: inline-flex;
        margin-top: 14px;
        padding: 7px 12px;
        border-radius: 6px;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
      }
      .actions a {
        margin-top: 0;
      }
      .secondary {
        background: #eef2f7;
        color: #1f2937;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${productName}</h1>
      <p>版本 ${escapeHtml(version)}</p>
      <p>Copyright © 2026 Markdown Viewer Team</p>
      <p>本应用以 MIT License 发布，并使用 Electron、React、CodeMirror、Mermaid、KaTeX 等开源项目。</p>
      <div class="actions">
        <a href="markdown-viewer://third-party-notices">查看第三方开源许可证</a>
        <a class="secondary" href="markdown-viewer://close-window">关闭</a>
      </div>
    </main>
  </body>
</html>`,
    parentWindow
  );

  aboutWindow.webContents.on("will-navigate", (event, url) => {
    if (url === "markdown-viewer://third-party-notices") {
      event.preventDefault();
      void showThirdPartyNoticesWindow(aboutWindow);
    }
  });
}

function asBrowserWindow(window: Electron.BaseWindow | undefined): BrowserWindow | undefined {
  return window instanceof BrowserWindow ? window : undefined;
}

/**
 * 将固定的应用菜单命令发送给主工作区窗口。
 * 关于和许可证窗口没有 preload，始终定向到应用主窗口可避免误发到子窗口。
 */
function sendMenuCommand(command: MenuCommand): void {
  if (!applicationWindow || applicationWindow.isDestroyed()) {
    return;
  }

  applicationWindow.webContents.send("app:menu-command", command);
}

function createApplicationMenu(): void {
  const thirdPartyNoticesItem: MenuItemConstructorOptions = {
    label: "第三方开源许可证",
    click: (_item, focusedWindow) => void showThirdPartyNoticesWindow(asBrowserWindow(focusedWindow))
  };
  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: `关于 ${productName}`,
      click: (_item, focusedWindow) => showAboutWindow(asBrowserWindow(focusedWindow))
    },
    thirdPartyNoticesItem
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: productName,
            submenu: [
              {
                label: `关于 ${productName}`,
                click: (_item: Electron.MenuItem, focusedWindow: Electron.BaseWindow | undefined) =>
                  showAboutWindow(asBrowserWindow(focusedWindow))
              },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const }
            ]
          }
        ]
      : []),
    {
      label: "文件",
      submenu: [
        {
          label: "打开...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuCommand("open-file")
        },
        {
          label: "保存",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuCommand("save-file")
        },
        {
          label: "刷新当前文档",
          accelerator: "CmdOrCtrl+R",
          click: () => sendMenuCommand("refresh-file")
        },
        { type: "separator" },
        {
          label: "关闭标签",
          accelerator: "CmdOrCtrl+W",
          click: () => sendMenuCommand("close-tab")
        },
        ...(process.platform === "darwin"
          ? []
          : ([
              { type: "separator" as const },
              { role: "quit" as const }
            ] satisfies MenuItemConstructorOptions[]))
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { type: "separator" },
        {
          label: "查找",
          accelerator: "CmdOrCtrl+F",
          click: () => sendMenuCommand("find")
        },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: "放大正文",
          accelerator: "CmdOrCtrl+=",
          click: () => sendMenuCommand("zoom-in")
        },
        {
          label: "缩小正文",
          accelerator: "CmdOrCtrl+-",
          click: () => sendMenuCommand("zoom-out")
        },
        {
          label: "重置正文缩放",
          accelerator: "CmdOrCtrl+0",
          click: () => sendMenuCommand("reset-zoom")
        },
        { type: "separator" },
        {
          label: "切换主题",
          click: () => sendMenuCommand("toggle-theme")
        },
        {
          label: "切换大纲",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendMenuCommand("toggle-outline")
        }
      ]
    },
    {
      label: "帮助",
      submenu: helpSubmenu
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerAssetProtocol(): void {
  protocol.handle("md-asset", async (request) => {
    try {
      const url = new URL(request.url);
      const baseDirParam = url.searchParams.get("baseDir");
      const srcParam = url.searchParams.get("src");

      if (!baseDirParam || !srcParam || srcParam.includes("\0")) {
        return createResponse("Invalid asset request");
      }

      if (/^[a-z][a-z\d+.-]*:/i.test(srcParam) || srcParam.startsWith("/") || srcParam.startsWith("\\")) {
        return createResponse("Only relative local assets are allowed", 403);
      }

      const baseDir = resolve(baseDirParam);
      if (!openedMarkdownDirs.has(baseDir)) {
        return createResponse("Asset base directory is not registered", 403);
      }

      const assetSourcePath = srcParam.split(/[?#]/, 1)[0] ?? "";
      const assetPath = resolve(baseDir, assetSourcePath);
      const extension = extname(assetPath).toLowerCase();
      const mimeType = imageMimeTypes.get(extension);

      if (!mimeType) {
        return createResponse("Unsupported asset type", 415);
      }

      const data = await readFile(assetPath);
      return new Response(new Uint8Array(data), {
        headers: {
          "content-type": mimeType,
          "cache-control": "no-store"
        }
      });
    } catch (error) {
      return createResponse(error instanceof Error ? error.message : "Asset load failed", 404);
    }
  });
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 920,
    minHeight: 620,
    title: "Markdown Viewer",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: resolve(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  applicationWindow = mainWindow;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const webContentsId = mainWindow.webContents.id;

  mainWindow.on("close", (event) => {
    if (!unsavedWindowIds.has(webContentsId)) {
      return;
    }

    // 窗口关闭属于原生生命周期，放在 main process 里弹同步对话框比 renderer beforeunload 更稳定。
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["取消", "不保存并关闭"],
      defaultId: 0,
      cancelId: 0,
      title: "有未保存的修改",
      message: "还有未保存的 Markdown 文档，确定要关闭窗口吗？",
      detail: "关闭后未保存的修改会丢失。"
    });

    if (choice === 0) {
      event.preventDefault();
      return;
    }

    unsavedWindowIds.delete(webContentsId);
  });

  mainWindow.on("closed", () => {
    unsavedWindowIds.delete(webContentsId);
    if (applicationWindow === mainWindow) {
      applicationWindow = null;
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(resolve(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  registerAssetProtocol();
  createApplicationMenu();

  ipcMain.handle("markdown:open-file", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "打开 Markdown 文件",
      properties: ["openFile"],
      filters: [
        {
          name: "Markdown",
          extensions: ["md", "markdown"]
        }
      ]
    } satisfies Electron.OpenDialogOptions;

    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return readMarkdownFile(result.filePaths[0]);
  });

  ipcMain.handle("markdown:read-file", (_event, filePath: string) => readMarkdownFile(filePath));

  ipcMain.handle("markdown:save-file", (_event, filePath: string, content: string) =>
    saveMarkdownFile(filePath, content)
  );

  ipcMain.on("window:set-unsaved-changes", (event, hasUnsavedChanges: boolean) => {
    const windowId = event.sender.id;
    if (hasUnsavedChanges) {
      unsavedWindowIds.add(windowId);
    } else {
      unsavedWindowIds.delete(windowId);
    }
  });

  ipcMain.handle("shell:open-containing-folder", async (_event, filePath: string) => {
    const resolvedPath = resolve(filePath);
    if (!isMarkdownPath(resolvedPath)) {
      return;
    }

    await shell.openPath(dirname(resolvedPath));
  });

  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
      return;
    }

    await shell.openExternal(url);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

// 兼容 ESM 打包环境下的 __dirname。
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
