import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  activateSearchMatch,
  clearSearchHighlights,
  highlightSearch,
  scrollToSearchMatch
} from "../utils/searchHighlight";

/**
 * 搜索已渲染的正文，并在查询清空时尝试恢复之前的滚动位置。
 * @param rootRef 正文节点引用。
 * @param query 查询文本。
 * @param contentKey 当前预览文档 ID，预览关闭时为空。
 * @param renderedTree 当前渲染的语法树，更新后重建指向正文节点的高亮范围。
 * @returns 搜索计数、当前索引及跳转方法。
 */
export function useSearchHighlight(
  rootRef: RefObject<HTMLElement>,
  query: string,
  contentKey: string,
  renderedTree: object
) {
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const restoreScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    restoreScrollTopRef.current = null;
  }, [contentKey]);

  useEffect(() => {
    const root = rootRef.current;
    const trimmedQuery = query.trim();
    if (!root || !trimmedQuery) {
      setMatchCount(0);
      setCurrentIndex(-1);
      const restoreTop = restoreScrollTopRef.current;
      restoreScrollTopRef.current = null;
      const scrollRoot = root?.closest<HTMLElement>(".document-scroll");
      if (!scrollRoot || restoreTop === null) {
        return;
      }

      const frame = requestAnimationFrame(() => {
        scrollRoot.scrollTo({
          top: restoreTop,
          behavior: "smooth"
        });
      });
      return () => cancelAnimationFrame(frame);
    }

    if (restoreScrollTopRef.current === null) {
      restoreScrollTopRef.current = root.closest<HTMLElement>(".document-scroll")?.scrollTop ?? null;
    }

    let revealFrame = 0;
    const timer = window.setTimeout(() => {
      const nextMatches = highlightSearch(root, trimmedQuery);
      const nextMatchCount = nextMatches.length;

      setMatchCount(nextMatchCount);
      setCurrentIndex(nextMatchCount > 0 ? 0 : -1);

      if (nextMatchCount > 0) {
        revealFrame = requestAnimationFrame(() => scrollToSearchMatch(0));
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(revealFrame);
      clearSearchHighlights(root);
    };
  }, [contentKey, query, renderedTree, rootRef]);

  useEffect(() => {
    if (currentIndex >= 0) {
      activateSearchMatch(currentIndex);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((current) => {
      if (matchCount === 0) {
        return -1;
      }

      const next = (current + 1) % matchCount;
      scrollToSearchMatch(next);
      return next;
    });
  }, [matchCount]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((current) => {
      if (matchCount === 0) {
        return -1;
      }

      const next = current <= 0 ? matchCount - 1 : current - 1;
      scrollToSearchMatch(next);
      return next;
    });
  }, [matchCount]);

  const clear = useCallback(() => {
    const root = rootRef.current;
    if (root) {
      clearSearchHighlights(root);
    }
    setMatchCount(0);
    setCurrentIndex(-1);
  }, [rootRef]);

  return {
    matchCount,
    currentIndex,
    goToNext,
    goToPrevious,
    clear
  };
}
