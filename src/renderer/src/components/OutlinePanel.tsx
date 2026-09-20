import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OutlineItem } from "../utils/markdownOutline";

type OutlinePanelProps = {
  items: OutlineItem[];
  activeId: string;
  onSelectItem?(item: OutlineItem): void;
};

export function OutlinePanel({ items, activeId, onSelectItem }: OutlinePanelProps) {
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
    activeItemRef.current?.scrollIntoView({
      block: "nearest"
    });
  }, [activeId]);

  useEffect(() => {
    setCollapsedIds((current) => {
      const availableIds = new Set(items.map((item) => item.id));
      const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const handlePreviewClick = (id: string) => {
    const target = document.getElementById(id) ?? document.getElementById(`user-content-${id}`);
    if (!target) {
      return;
    }

    const scrollRoot = target.closest<HTMLElement>(".document-scroll");
    if (!scrollRoot) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return;
    }

    // 正文是独立滚动容器，直接计算容器内偏移比依赖全局 scrollIntoView 更稳定。
    const rootTop = scrollRoot.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + targetTop - rootTop - 12,
      behavior: "smooth"
    });
  };

  const handleClick = (item: OutlineItem) => {
    if (onSelectItem) {
      onSelectItem(item);
      return;
    }

    handlePreviewClick(item.id);
  };

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
            const itemIndex = items.findIndex((outlineItem) => outlineItem.id === item.id);
            const hasChildren = itemIndex >= 0 && items[itemIndex + 1]?.depth > item.depth;
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
                  onClick={() => handleClick(item)}
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
}
