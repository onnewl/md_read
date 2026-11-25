import { ChevronRight } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { OutlineItem } from "../utils/markdownOutline";

type OutlinePanelProps = {
  items: OutlineItem[];
  activeId: string;
  followActive: boolean;
  onSelectItem(item: OutlineItem): void;
};

/** 展示标题层级，并在正文主动改变阅读位置时将当前标题保持在目录视野内。 */
export const OutlinePanel = memo(function OutlinePanel({ items, activeId, followActive, onSelectItem }: OutlinePanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  const visibleItems = useMemo(() => {
    const nextItems: OutlineItem[] = [];
    let hiddenDepth = 0;

    for (const item of items) {
      if (hiddenDepth > 0 && item.depth > hiddenDepth) {
        continue;
      }

      hiddenDepth = 0;
      nextItems.push(item);

      if (collapsedIds.has(item.id)) {
        hiddenDepth = item.depth;
      }
    }

    return nextItems;
  }, [collapsedIds, items]);

  useEffect(() => {
    // 只有正文滚动改变当前标题时才跟随，用户点击的目录项已经在视野内。
    if (followActive) {
      activeItemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId, followActive]);

  useEffect(() => {
    setCollapsedIds((current) => {
      const availableIds = new Set(items.map((item) => item.id));
      const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const toggleCollapsed = (item: OutlineItem) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  return (
    <aside className="outline-panel" aria-label="文档大纲">
      <div className="outline-panel__title">大纲</div>
      {items.length === 0 ? (
        <div className="outline-panel__empty">暂无标题</div>
      ) : (
        <nav>
          {visibleItems.map((item) => {
            const hasChildren = items[item.index + 1]?.depth > item.depth;
            const isCollapsed = collapsedIds.has(item.id);

            return (
              <div key={`${item.id}-${item.index}`} className="outline-row">
                <button
                  type="button"
                  className="outline-collapse"
                  style={{ marginLeft: `${8 + (item.depth - 1) * 14}px` }}
                  disabled={!hasChildren}
                  aria-label={isCollapsed ? "展开标题层级" : "折叠标题层级"}
                  onClick={() => toggleCollapsed(item)}
                >
                  {hasChildren ? (
                    <ChevronRight
                      size={13}
                      aria-hidden="true"
                      className={isCollapsed ? "outline-collapse__icon" : "outline-collapse__icon is-open"}
                    />
                  ) : null}
                </button>
                <button
                  ref={item.id === activeId ? activeItemRef : undefined}
                  type="button"
                  className={item.id === activeId ? "outline-item is-active" : "outline-item"}
                  aria-current={item.id === activeId ? "location" : undefined}
                  onClick={() => onSelectItem(item)}
                  title={item.text}
                >
                  <span className="outline-item__marker">H{item.depth}</span>
                  <span className="outline-item__text">{item.text}</span>
                </button>
              </div>
            );
          })}
        </nav>
      )}
    </aside>
  );
});
