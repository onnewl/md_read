import { SearchQuery, setSearchQuery } from "@codemirror/search";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { RefObject, useCallback, useEffect, useState } from "react";

type SourceMatch = {
  start: number;
  end: number;
};

function findMatches(content: string, query: string): SourceMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const normalizedContent = content.toLowerCase();
  const matches: SourceMatch[] = [];
  let cursor = 0;

  while (cursor <= normalizedContent.length) {
    const index = normalizedContent.indexOf(normalizedQuery, cursor);
    if (index === -1) {
      break;
    }

    matches.push({
      start: index,
      end: index + normalizedQuery.length
    });
    cursor = index + normalizedQuery.length;
  }

  return matches;
}

function revealMatch(view: EditorView | null, match: SourceMatch | undefined, shouldFocus: boolean): void {
  if (!view || !match) {
    return;
  }

  view.dispatch({
    selection: EditorSelection.range(match.start, match.end),
    effects: EditorView.scrollIntoView(match.start, {
      y: "center",
      x: "nearest"
    })
  });

  if (shouldFocus) {
    view.focus();
  }
}

/**
 * 为 CodeMirror 源码模式提供外部搜索框适配。
 * @param editorViewRef CodeMirror EditorView 引用。
 * @param content 当前源码文本。
 * @param query 搜索关键词，大小写不敏感。
 * @param contentKey 文件或模式变化标识，用于重置旧搜索状态。
 * @returns 搜索命中数、当前索引和上下跳转方法。
 */
export function useCodeMirrorSearch(
  editorViewRef: RefObject<EditorView | null>,
  content: string,
  query: string,
  contentKey: string
) {
  const [matches, setMatches] = useState<SourceMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const view = editorViewRef.current;
      const trimmedQuery = query.trim();
      const nextMatches = findMatches(content, trimmedQuery);

      if (view) {
        view.dispatch({
          effects: setSearchQuery.of(
            new SearchQuery({
              search: trimmedQuery,
              caseSensitive: false,
              literal: true
            })
          )
        });
      }

      setMatches(nextMatches);
      setCurrentIndex(nextMatches.length > 0 ? 0 : -1);

      if (nextMatches.length > 0) {
        requestAnimationFrame(() => revealMatch(editorViewRef.current, nextMatches[0], false));
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [content, contentKey, editorViewRef, query]);

  const goToNext = useCallback(() => {
    setCurrentIndex((current) => {
      if (matches.length === 0) {
        return -1;
      }

      const next = (current + 1) % matches.length;
      revealMatch(editorViewRef.current, matches[next], true);
      return next;
    });
  }, [editorViewRef, matches]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((current) => {
      if (matches.length === 0) {
        return -1;
      }

      const next = current <= 0 ? matches.length - 1 : current - 1;
      revealMatch(editorViewRef.current, matches[next], true);
      return next;
    });
  }, [editorViewRef, matches]);

  const clear = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: "" }))
      });
    }

    setMatches([]);
    setCurrentIndex(-1);
  }, [editorViewRef]);

  return {
    matchCount: matches.length,
    currentIndex,
    goToNext,
    goToPrevious,
    clear
  };
}
