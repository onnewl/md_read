import {
  Code2,
  Eye,
  FileText,
  FolderOpen,
  FolderSearch,
  History,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  ZoomIn
} from "lucide-react";
import type { Ref } from "react";
import { SearchBox } from "./SearchBox";

export type ViewMode = "preview" | "source";

type TopBarProps = {
  fileName?: string;
  recentFiles: string[];
  searchValue: string;
  searchCurrent: number;
  searchTotal: number;
  theme: "light" | "dark";
  isOutlineOpen: boolean;
  zoomPercent: number;
  viewMode: ViewMode;
  isDirty: boolean;
  isSaving: boolean;
  searchInputRef?: Ref<HTMLInputElement>;
  onOpen(): void;
  onRefresh(): void;
  onSave(): void;
  onOpenContainingFolder(): void;
  onOpenRecent(filePath: string): void;
  onClearRecent(): void;
  onToggleOutline(): void;
  onViewModeChange(mode: ViewMode): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onResetZoom(): void;
  onSearchChange(value: string): void;
  onSearchNext(): void;
  onSearchPrevious(): void;
  onSearchClear(): void;
  onToggleTheme(): void;
};

function recentLabel(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

export function TopBar({
  fileName,
  recentFiles,
  searchValue,
  searchCurrent,
  searchTotal,
  theme,
  isOutlineOpen,
  zoomPercent,
  viewMode,
  isDirty,
  isSaving,
  searchInputRef,
  onOpen,
  onRefresh,
  onSave,
  onOpenContainingFolder,
  onOpenRecent,
  onClearRecent,
  onToggleOutline,
  onViewModeChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSearchChange,
  onSearchNext,
  onSearchPrevious,
  onSearchClear,
  onToggleTheme
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button type="button" className="primary-action" onClick={onOpen}>
          <FolderOpen size={16} aria-hidden="true" />
          打开文件
        </button>
        <button
          type="button"
          onClick={onToggleOutline}
          aria-pressed={isOutlineOpen}
          title={isOutlineOpen ? "关闭大纲" : "打开大纲"}
        >
          {isOutlineOpen ? (
            <PanelLeftClose size={16} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={16} aria-hidden="true" />
          )}
        </button>
        <button type="button" onClick={onRefresh} disabled={!fileName} title="刷新当前文件">
          <RefreshCcw size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onSave} disabled={!fileName || !isDirty || isSaving} title="保存当前文档">
          <Save size={16} aria-hidden="true" />
          {isSaving ? "保存中" : "保存"}
        </button>
        <button type="button" onClick={onOpenContainingFolder} disabled={!fileName} title="打开当前文档所在文件夹">
          <FolderSearch size={16} aria-hidden="true" />
        </button>
        <div className="recent-menu">
          <button type="button" disabled={recentFiles.length === 0} title="最近打开">
            <History size={16} aria-hidden="true" />
          </button>
          {recentFiles.length > 0 ? (
            <div className="recent-menu__list" role="menu">
              {recentFiles.map((filePath) => (
                <button key={filePath} type="button" role="menuitem" onClick={() => onOpenRecent(filePath)}>
                  <span>{recentLabel(filePath)}</span>
                  <small>{filePath}</small>
                </button>
              ))}
              <div className="recent-menu__footer">
                <button type="button" onClick={onClearRecent}>
                  <Trash2 size={14} aria-hidden="true" />
                  清除最近记录
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="file-title" title={fileName ?? "未打开文件"}>
          <FileText size={16} aria-hidden="true" />
          <span>{fileName ? `${fileName}${isDirty ? " *" : ""}` : "未打开文件"}</span>
        </div>
      </div>

      <div className="top-bar__right">
        <div className="mode-switch" aria-label="查看模式">
          <button
            type="button"
            className={viewMode === "preview" ? "is-active" : ""}
            onClick={() => onViewModeChange("preview")}
            disabled={!fileName}
            aria-pressed={viewMode === "preview"}
            title="预览模式"
          >
            <Eye size={16} aria-hidden="true" />
            预览
          </button>
          <button
            type="button"
            className={viewMode === "source" ? "is-active" : ""}
            onClick={() => onViewModeChange("source")}
            disabled={!fileName}
            aria-pressed={viewMode === "source"}
            title="源码模式"
          >
            <Code2 size={16} aria-hidden="true" />
            源码
          </button>
        </div>
        <div className="zoom-controls" aria-label="正文缩放">
          <button type="button" onClick={onZoomOut} title="缩小正文">
            <Minus size={16} aria-hidden="true" />
          </button>
          <button type="button" className="zoom-controls__value" onClick={onResetZoom} title="重置缩放">
            <RotateCcw size={14} aria-hidden="true" />
            {zoomPercent}%
          </button>
          <button type="button" onClick={onZoomIn} title="放大正文">
            <ZoomIn size={16} aria-hidden="true" />
          </button>
        </div>
        <SearchBox
          inputRef={searchInputRef}
          value={searchValue}
          current={searchCurrent}
          total={searchTotal}
          disabled={!fileName}
          onChange={onSearchChange}
          onNext={onSearchNext}
          onPrevious={onSearchPrevious}
          onClear={onSearchClear}
        />
        <button type="button" onClick={onToggleTheme} title="切换明暗主题">
          {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
