import { X } from "lucide-react";
import { useEffect, useState } from "react";

export type DocumentTabSummary = {
  id: string;
  fileName: string;
  filePath: string;
  isDirty: boolean;
};

type TabBarProps = {
  documents: DocumentTabSummary[];
  activeId: string;
  onSelect(documentId: string): void;
  onClose(documentId: string): void;
  onCloseOthers(documentId: string): void;
  onCloseToRight(documentId: string): void;
};

/**
 * 多文档标签栏，只保存运行期打开状态；关闭未保存标签时由外层负责确认。
 * @param documents 当前已打开的 Markdown 文档摘要。
 * @param activeId 当前激活文档 id。
 * @param onSelect 切换激活文档。
 * @param onClose 关闭指定文档。
 */
export function TabBar({ documents, activeId, onSelect, onClose, onCloseOthers, onCloseToRight }: TabBarProps) {
  const [menuState, setMenuState] = useState<{ documentId: string; x: number; y: number } | null>(null);
  const activeMenuDocument = menuState ? documents.find((documentItem) => documentItem.id === menuState.documentId) : null;
  const activeMenuIndex = activeMenuDocument
    ? documents.findIndex((documentItem) => documentItem.id === activeMenuDocument.id)
    : -1;

  useEffect(() => {
    if (!menuState) {
      return;
    }

    const closeMenu = () => setMenuState(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [menuState]);

  return (
    <nav className="tab-bar" aria-label="已打开文件">
      {documents.map((documentItem) => (
        <div
          key={documentItem.id}
          className={documentItem.id === activeId ? "tab-item is-active" : "tab-item"}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuState({
              documentId: documentItem.id,
              x: event.clientX,
              y: event.clientY
            });
          }}
        >
          <button
            type="button"
            className="tab-item__select"
            title={documentItem.filePath}
            onClick={() => onSelect(documentItem.id)}
          >
            <span className="tab-item__title">{documentItem.fileName}</span>
          </button>
          {documentItem.isDirty ? <span className="tab-item__dirty" aria-label="未保存修改" /> : null}
          <button
            type="button"
            className="tab-item__close"
            title="关闭标签"
            aria-label={`关闭 ${documentItem.fileName}`}
            onClick={() => onClose(documentItem.id)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      {menuState && activeMenuDocument ? (
        <div
          className="tab-menu"
          style={{ left: `${menuState.x}px`, top: `${menuState.y}px` }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose(activeMenuDocument.id);
              setMenuState(null);
            }}
          >
            关闭
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={documents.length <= 1}
            onClick={() => {
              onCloseOthers(activeMenuDocument.id);
              setMenuState(null);
            }}
          >
            关闭其他
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={activeMenuIndex === -1 || activeMenuIndex === documents.length - 1}
            onClick={() => {
              onCloseToRight(activeMenuDocument.id);
              setMenuState(null);
            }}
          >
            关闭右侧
          </button>
        </div>
      ) : null}
    </nav>
  );
}
