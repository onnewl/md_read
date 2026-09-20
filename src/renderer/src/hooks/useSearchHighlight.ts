import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  activateSearchMatch,
  clearSearchHighlights,
  highlightSearch,
  scrollToSearchMatch
} from "../utils/searchHighlight";

export function useSearchHighlight(rootRef: RefObject<HTMLElement>, query: string, contentKey: string) {
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const restoreScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    restoreScrollTopRef.current = null;
  }, [contentKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      setMatchCount(0);
      setCurrentIndex(-1);
      return;
    }

    const scrollRoot = root.closest<HTMLElement>(".document-scroll");
    const trimmedQuery = query.trim();
    if (trimmedQuery && restoreScrollTopRef.current === null) {
      restoreScrollTopRef.current = scrollRoot?.scrollTop ?? null;
    }

    if (!trimmedQuery && restoreScrollTopRef.current !== null) {
      const restoreTop = restoreScrollTopRef.current;
      restoreScrollTopRef.current = null;
      requestAnimationFrame(() => {
        scrollRoot?.scrollTo({
          top: restoreTop,
          behavior: "smooth"
        });
      });
    }

    const timer = window.setTimeout(() => {
      const nextMatches = highlightSearch(root, query);
      const nextMatchCount = nextMatches.length;

      setMatchCount(nextMatchCount);
      setCurrentIndex(nextMatchCount > 0 ? 0 : -1);

      if (nextMatchCount > 0) {
        requestAnimationFrame(() => scrollToSearchMatch(0));
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      clearSearchHighlights(root);
    };
  }, [contentKey, query, rootRef]);

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
