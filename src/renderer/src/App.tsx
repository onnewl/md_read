import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EmptyState } from "./components/EmptyState";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { OutlinePanel } from "./components/OutlinePanel";
import { SourceEditor } from "./components/SourceEditor";
import { TabBar } from "./components/TabBar";
import { TopBar } from "./components/TopBar";
import type { ViewMode } from "./components/TopBar";
import { useCodeMirrorSearch } from "./hooks/useCodeMirrorSearch";
import { useOutline } from "./hooks/useOutline";
import { useSearchHighlight } from "./hooks/useSearchHighlight";
import { useTheme } from "./hooks/useTheme";
import type { MarkdownFilePayload } from "./types/global";
import { extractOutline, type OutlineItem } from "./utils/markdownOutline";
import { isMarkdownFilePath } from "./utils/pathUtils";
import { getPreviewSourceOffset, scrollPreviewToSourceOffset } from "./utils/viewPosition";
import type { MenuCommand } from "../../shared/menuCommands";

const recentFilesKey = "markdown-viewer-recent-files";
const outlineOpenKey = "markdown-viewer-outline-open";
const zoomKey = "markdown-viewer-document-zoom";
const maxRecentFiles = 8;
const minZoom = 0.7;
const maxZoom = 1.6;
const zoomStep = 0.1;

type DocumentTab = MarkdownFilePayload & {
  id: string;
  draftContent: string;
};

function createDocumentTab(payload: MarkdownFilePayload): DocumentTab {
  return {
    ...payload,
    id: payload.filePath,
    draftContent: payload.content
  };
}

function loadRecentFiles(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentFilesKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentFiles(files: string[]): void {
  localStorage.setItem(recentFilesKey, JSON.stringify(files.slice(0, maxRecentFiles)));
}

function getInitialOutlineOpen(): boolean {
  return localStorage.getItem(outlineOpenKey) !== "false";
}

/**
 * 根据源码偏移找到其所属的最后一个标题。
 * @param outline 当前文档大纲，按源码顺序排列。
 * @param offset CodeMirror 光标或视口顶部的文档偏移。
 * @returns 应高亮的标题 id；文档无标题时返回空字符串。
 */
function findSourceHeadingId(outline: OutlineItem[], offset: number): string {
  let activeId = outline[0]?.id ?? "";

  for (const item of outline) {
    if (item.offset > offset) {
      break;
    }

    activeId = item.id;
  }

  return activeId;
}

function getSourceViewportOffset(editorView: EditorView): number {
  const contentRect = editorView.contentDOM.getBoundingClientRect();
  const scrollRect = editorView.scrollDOM.getBoundingClientRect();
  const offset = editorView.posAtCoords({
    x: contentRect.left + 8,
    y: scrollRect.top + 12
  });

  return Math.max(0, Math.min(offset ?? editorView.viewport.from, editorView.state.doc.length));
}

export default function App() {
  const [openDocuments, setOpenDocuments] = useState<DocumentTab[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [recentFiles, setRecentFiles] = useState<string[]>(() => loadRecentFiles());
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isOutlineOpen, setIsOutlineOpen] = useState(() => getInitialOutlineOpen());
  const [documentZoom, setDocumentZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [sourceRevealRequest, setSourceRevealRequest] = useState<{ documentId: string; offset: number } | null>(null);
  const { theme, toggleTheme } = useTheme();

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const contentRootRef = useRef<HTMLElement>(null);
  const sourceEditorRef = useRef<EditorView | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingPreviewOffsetRef = useRef<{ documentId: string; offset: number } | null>(null);
  const menuCommandHandlerRef = useRef<(command: MenuCommand) => void>(() => undefined);

  const activeDocument = useMemo(
    () => openDocuments.find((documentItem) => documentItem.id === activeDocumentId) ?? null,
    [activeDocumentId, openDocuments]
  );
  const isDirty = Boolean(activeDocument && activeDocument.draftContent !== activeDocument.content);
  const hasDirtyDocuments = openDocuments.some((documentItem) => documentItem.draftContent !== documentItem.content);
  const activeContent = activeDocument?.draftContent ?? "";
  const outline = useMemo(() => extractOutline(activeContent), [activeContent]);
  const activeHeadingId = useOutline(scrollRootRef, contentRootRef, outline);
  const previewSearch = useSearchHighlight(
    contentRootRef,
    searchQuery,
    `${activeDocument?.id ?? "empty"}:${viewMode}:preview`
  );
  const sourceSearch = useCodeMirrorSearch(
    sourceEditorRef,
    activeContent,
    searchQuery,
    `${activeDocument?.id ?? "empty"}:${viewMode}:source`
  );
  const search = viewMode === "source" ? sourceSearch : previewSearch;
  const [sourceActiveOffset, setSourceActiveOffset] = useState(0);
  const sourceActiveHeadingId = useMemo(
    () => findSourceHeadingId(outline, sourceActiveOffset),
    [outline, sourceActiveOffset]
  );

  const rememberRecentFile = useCallback((filePath: string) => {
    setRecentFiles((current) => {
      const next = [filePath, ...current.filter((item) => item !== filePath)].slice(0, maxRecentFiles);
      saveRecentFiles(next);
      return next;
    });
  }, []);

  const clearRecentFiles = useCallback(() => {
    saveRecentFiles([]);
    setRecentFiles([]);
  }, []);

  const commitDocument = useCallback(
    (payload: MarkdownFilePayload, shouldResetViewMode = true) => {
      const nextDocument = createDocumentTab(payload);
      setOpenDocuments((current) => {
        const existingIndex = current.findIndex((item) => item.id === nextDocument.id);
        if (existingIndex === -1) {
          return [...current, nextDocument];
        }

        const next = [...current];
        next[existingIndex] = nextDocument;
        return next;
      });
      setActiveDocumentId(nextDocument.id);
      if (shouldResetViewMode) {
        setViewMode("preview");
      }
      setSearchQuery("");
      setError("");
      rememberRecentFile(payload.filePath);
    },
    [rememberRecentFile]
  );

  const focusDocument = useCallback(
    (filePath: string) => {
      setActiveDocumentId(filePath);
      setSearchQuery("");
      setError("");
      rememberRecentFile(filePath);
    },
    [rememberRecentFile]
  );

  const updateActiveDraftContent = useCallback(
    (nextContent: string) => {
      setOpenDocuments((current) =>
        current.map((documentItem) =>
          documentItem.id === activeDocumentId ? { ...documentItem, draftContent: nextContent } : documentItem
        )
      );
    },
    [activeDocumentId]
  );

  const confirmDiscardDraft = useCallback((documentItem: DocumentTab | null) => {
    // 刷新或关闭单个标签时只检查该标签草稿，切换标签不会打断未保存编辑。
    return (
      !documentItem ||
      documentItem.draftContent === documentItem.content ||
      window.confirm("当前文档有未保存修改，继续会丢弃这些修改。")
    );
  }, []);

  const confirmDiscardDocuments = useCallback((documents: DocumentTab[]) => {
    // 批量关闭标签时只弹一次确认，避免多个未保存标签连续打断用户。
    return (
      documents.every((documentItem) => documentItem.draftContent === documentItem.content) ||
      window.confirm("有文档存在未保存修改，继续会丢弃这些修改。")
    );
  }, []);

  const closeDocument = useCallback(
    (documentId: string) => {
      const closingIndex = openDocuments.findIndex((documentItem) => documentItem.id === documentId);
      if (closingIndex === -1) {
        return;
      }

      const closingDocument = openDocuments[closingIndex];
      if (!confirmDiscardDraft(closingDocument)) {
        return;
      }

      const nextDocuments = openDocuments.filter((documentItem) => documentItem.id !== documentId);
      setOpenDocuments(nextDocuments);
      if (activeDocumentId === documentId) {
        const nextActiveDocument = nextDocuments[Math.max(0, closingIndex - 1)] ?? nextDocuments[0] ?? null;
        setActiveDocumentId(nextActiveDocument?.id ?? "");
        setSearchQuery("");
      }
    },
    [activeDocumentId, confirmDiscardDraft, openDocuments]
  );

  const closeActiveDocument = useCallback(() => {
    if (activeDocumentId) {
      closeDocument(activeDocumentId);
    }
  }, [activeDocumentId, closeDocument]);

  const closeOtherDocuments = useCallback(
    (documentId: string) => {
      const keepingDocument = openDocuments.find((documentItem) => documentItem.id === documentId);
      if (!keepingDocument) {
        return;
      }

      const closingDocuments = openDocuments.filter((documentItem) => documentItem.id !== documentId);
      if (!confirmDiscardDocuments(closingDocuments)) {
        return;
      }

      setOpenDocuments([keepingDocument]);
      setActiveDocumentId(keepingDocument.id);
      setSearchQuery("");
    },
    [confirmDiscardDocuments, openDocuments]
  );

  const closeDocumentsToRight = useCallback(
    (documentId: string) => {
      const keepUntilIndex = openDocuments.findIndex((documentItem) => documentItem.id === documentId);
      if (keepUntilIndex === -1) {
        return;
      }

      const nextDocuments = openDocuments.slice(0, keepUntilIndex + 1);
      const closingDocuments = openDocuments.slice(keepUntilIndex + 1);
      if (closingDocuments.length === 0 || !confirmDiscardDocuments(closingDocuments)) {
        return;
      }

      setOpenDocuments(nextDocuments);
      if (!nextDocuments.some((documentItem) => documentItem.id === activeDocumentId)) {
        setActiveDocumentId(documentId);
        setSearchQuery("");
      }
    },
    [activeDocumentId, confirmDiscardDocuments, openDocuments]
  );

  const changeActiveDocument = useCallback(
    (documentId: string) => {
      if (activeDocumentId === documentId) {
        return;
      }

      setActiveDocumentId(documentId);
      setSearchQuery("");
      setError("");
    },
    [activeDocumentId]
  );

  const switchDocumentByOffset = useCallback(
    (offset: number) => {
      if (openDocuments.length <= 1) {
        return;
      }

      const currentIndex = Math.max(
        0,
        openDocuments.findIndex((documentItem) => documentItem.id === activeDocumentId)
      );
      const nextIndex = (currentIndex + offset + openDocuments.length) % openDocuments.length;
      changeActiveDocument(openDocuments[nextIndex].id);
    },
    [activeDocumentId, changeActiveDocument, openDocuments]
  );

  const openOrFocusFile = useCallback(
    async (filePath: string) => {
      const existingDocument = openDocuments.find((documentItem) => documentItem.id === filePath);
      if (existingDocument) {
        focusDocument(filePath);
        return;
      }

      if (!window.mdApi) {
        setError("Electron preload API 未加载，请重启应用。");
        return;
      }

      const payload = await window.mdApi.readMarkdownFile(filePath);
      commitDocument(payload);
    },
    [commitDocument, focusDocument, openDocuments]
  );

  const openFile = async () => {
    try {
      if (!window.mdApi) {
        setError("Electron preload API 未加载，请重启应用。");
        return;
      }

      const payload = await window.mdApi.openMarkdownFile();
      if (!payload) {
        return;
      }

      const existingDocument = openDocuments.find((documentItem) => documentItem.id === payload.filePath);
      if (existingDocument) {
        focusDocument(payload.filePath);
        return;
      }

      commitDocument(payload);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "打开文件失败");
    }
  };

  const readFile = async (filePath: string) => {
    try {
      await openOrFocusFile(filePath);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "文件读取失败");
    }
  };

  const refreshFile = async () => {
    try {
      if (!activeDocument || !confirmDiscardDraft(activeDocument)) {
        return;
      }

      if (!window.mdApi) {
        setError("Electron preload API 未加载，请重启应用。");
        return;
      }

      const payload = await window.mdApi.readMarkdownFile(activeDocument.filePath);
      commitDocument(payload, false);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "刷新文件失败");
    }
  };

  const saveFile = useCallback(async () => {
    try {
      if (!activeDocument || !isDirty || isSaving) {
        return;
      }

      if (!window.mdApi) {
        setError("Electron preload API 未加载，请重启应用。");
        return;
      }

      setIsSaving(true);
      const payload = await window.mdApi.saveMarkdownFile(activeDocument.filePath, activeDocument.draftContent);
      commitDocument(payload, false);
      setStatusMessage("已保存");
      window.setTimeout(() => setStatusMessage(""), 1600);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存文件失败");
    } finally {
      setIsSaving(false);
    }
  }, [activeDocument, commitDocument, isDirty, isSaving]);

  const openContainingFolder = async () => {
    try {
      if (!activeDocument) {
        return;
      }

      await window.mdApi.openContainingFolder(activeDocument.filePath);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "打开文件夹失败");
    }
  };

  const toggleOutline = () => {
    setIsOutlineOpen((current) => {
      const next = !current;
      localStorage.setItem(outlineOpenKey, String(next));
      return next;
    });
  };

  const updateZoom = (nextZoom: number) => {
    const normalizedZoom = Math.round(Math.min(maxZoom, Math.max(minZoom, nextZoom)) * 10) / 10;
    setDocumentZoom(normalizedZoom);
  };

  const changeViewMode = (mode: ViewMode) => {
    if (mode === viewMode || !activeDocument) {
      return;
    }

    if (viewMode === "preview" && mode === "source") {
      const headingOffset = outline.find((item) => item.id === activeHeadingId)?.offset ?? 0;
      const scrollRoot = scrollRootRef.current;
      const contentRoot = contentRootRef.current;
      setSourceRevealRequest({
        documentId: activeDocument.id,
        offset: scrollRoot && contentRoot ? getPreviewSourceOffset(scrollRoot, contentRoot, headingOffset) : headingOffset
      });
    }

    if (viewMode === "source" && mode === "preview") {
      pendingPreviewOffsetRef.current = {
        documentId: activeDocument.id,
        offset: sourceEditorRef.current
          ? getSourceViewportOffset(sourceEditorRef.current)
          : sourceActiveOffset
      };
    }

    setViewMode(mode);
  };

  const selectSourceHeading = useCallback((item: OutlineItem) => {
    const editorView = sourceEditorRef.current;
    if (!editorView) {
      return;
    }

    const start = Math.max(0, Math.min(item.offset, editorView.state.doc.length));

    setSourceActiveOffset(start);
    editorView.dispatch({
      selection: {
        anchor: start
      },
      effects: EditorView.scrollIntoView(start, {
        y: "center",
        x: "nearest"
      })
    });
    editorView.focus();
  }, []);

  // 菜单监听只注册一次，通过 ref 始终调用当前渲染对应的文档操作，避免重复订阅全局 IPC 事件。
  menuCommandHandlerRef.current = (command) => {
    switch (command) {
      case "open-file":
        void openFile();
        break;
      case "save-file":
        void saveFile();
        break;
      case "refresh-file":
        void refreshFile();
        break;
      case "close-tab":
        closeActiveDocument();
        break;
      case "find":
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        break;
      case "zoom-in":
        updateZoom(documentZoom + zoomStep);
        break;
      case "zoom-out":
        updateZoom(documentZoom - zoomStep);
        break;
      case "reset-zoom":
        updateZoom(1);
        break;
      case "toggle-theme":
        toggleTheme();
        break;
      case "toggle-outline":
        toggleOutline();
        break;
    }
  };

  useEffect(() => {
    if (!window.mdApi) {
      return;
    }

    return window.mdApi.onMenuCommand((command) => menuCommandHandlerRef.current(command));
  }, []);

  useEffect(() => {
    setSourceActiveOffset(0);
    pendingPreviewOffsetRef.current = null;
  }, [activeDocument?.id]);

  useEffect(() => {
    const pending = pendingPreviewOffsetRef.current;
    if (viewMode !== "preview" || !activeDocument || pending?.documentId !== activeDocument.id) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const scrollRoot = scrollRootRef.current;
      const contentRoot = contentRootRef.current;
      if (!scrollRoot || !contentRoot) {
        return;
      }

      if (!scrollPreviewToSourceOffset(scrollRoot, contentRoot, pending.offset)) {
        const headingId = findSourceHeadingId(outline, pending.offset);
        const heading = headingId ? contentRoot.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`) : null;
        if (heading) {
          const rootRect = scrollRoot.getBoundingClientRect();
          scrollRoot.scrollTop = Math.max(
            0,
            scrollRoot.scrollTop + heading.getBoundingClientRect().top - rootRect.top - 12
          );
        }
      }

      pendingPreviewOffsetRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeDocument, outline, viewMode]);

  useEffect(() => {
    localStorage.removeItem(zoomKey);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Tab") {
        event.preventDefault();
        switchDocumentByOffset(event.shiftKey ? -1 : 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [switchDocumentByOffset]);

  useEffect(() => {
    window.mdApi?.setHasUnsavedChanges(hasDirtyDocuments);

    return () => {
      window.mdApi?.setHasUnsavedChanges(false);
    };
  }, [hasDirtyDocuments]);

  useEffect(() => {
    document.title = activeDocument
      ? `${activeDocument.fileName}${isDirty ? " *" : ""} - Markdown Viewer`
      : "Markdown Viewer";
  }, [activeDocument, isDirty]);

  useEffect(() => {
    const preventDefault = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (!file) {
        return;
      }

      const filePath = window.mdApi.getDroppedFilePath(file);
      if (!isMarkdownFilePath(filePath)) {
        setError("只能拖拽 .md 或 .markdown 文件。");
        return;
      }

      void readFile(filePath);
    };

    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", handleDrop);
    };
  });

  return (
    <div className="app-shell">
      <TopBar
        fileName={activeDocument?.fileName}
        recentFiles={recentFiles}
        searchValue={searchQuery}
        searchCurrent={search.currentIndex}
        searchTotal={search.matchCount}
        theme={theme}
        isOutlineOpen={isOutlineOpen}
        zoomPercent={Math.round(documentZoom * 100)}
        viewMode={viewMode}
        isDirty={isDirty}
        isSaving={isSaving}
        searchInputRef={searchInputRef}
        onOpen={openFile}
        onRefresh={refreshFile}
        onSave={saveFile}
        onOpenContainingFolder={openContainingFolder}
        onOpenRecent={readFile}
        onClearRecent={clearRecentFiles}
        onToggleOutline={toggleOutline}
        onViewModeChange={changeViewMode}
        onZoomIn={() => updateZoom(documentZoom + zoomStep)}
        onZoomOut={() => updateZoom(documentZoom - zoomStep)}
        onResetZoom={() => updateZoom(1)}
        onSearchChange={setSearchQuery}
        onSearchNext={search.goToNext}
        onSearchPrevious={search.goToPrevious}
        onSearchClear={() => setSearchQuery("")}
        onToggleTheme={toggleTheme}
      />

      {openDocuments.length > 0 ? (
        <TabBar
          documents={openDocuments.map((documentItem) => ({
            id: documentItem.id,
            fileName: documentItem.fileName,
            filePath: documentItem.filePath,
            isDirty: documentItem.draftContent !== documentItem.content
          }))}
          activeId={activeDocumentId}
          onSelect={changeActiveDocument}
          onClose={closeDocument}
          onCloseOthers={closeOtherDocuments}
          onCloseToRight={closeDocumentsToRight}
        />
      ) : null}

      {error ? <div className="app-error">{error}</div> : null}
      {statusMessage ? <div className="app-status">{statusMessage}</div> : null}

      <main className={isOutlineOpen ? "workspace" : "workspace workspace--outline-closed"}>
        {isOutlineOpen ? (
          <OutlinePanel
            items={outline}
            activeId={viewMode === "source" ? sourceActiveHeadingId : activeHeadingId}
            onSelectItem={viewMode === "source" ? selectSourceHeading : undefined}
          />
        ) : null}
        <section
          ref={scrollRootRef}
          className="document-scroll"
          aria-label="Markdown 正文"
          style={{ "--document-zoom": documentZoom } as CSSProperties}
        >
          {activeDocument && viewMode === "preview" ? (
            <MarkdownViewer
              content={activeContent}
              baseDir={activeDocument.baseDir}
              theme={theme}
              contentRef={contentRootRef}
            />
          ) : activeDocument ? (
            <SourceEditor
              key={activeDocument.id}
              value={activeContent}
              fileName={activeDocument.fileName}
              theme={theme}
              initialRevealOffset={
                sourceRevealRequest?.documentId === activeDocument.id ? sourceRevealRequest.offset : 0
              }
              editorViewRef={sourceEditorRef}
              onChange={updateActiveDraftContent}
              onActiveOffsetChange={setSourceActiveOffset}
            />
          ) : (
            <EmptyState onOpen={openFile} />
          )}
        </section>
      </main>
    </div>
  );
}
