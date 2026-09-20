import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Theme } from "../hooks/useTheme";

type SourceEditorProps = {
  value: string;
  fileName: string;
  theme: Theme;
  initialRevealOffset?: number;
  editorViewRef: MutableRefObject<EditorView | null>;
  onChange(value: string): void;
  onActiveOffsetChange(offset: number): void;
};

function createEditorTheme(): Extension {
  return EditorView.theme({
    "&": {
      height: "100%",
      color: "var(--text)",
      backgroundColor: "var(--surface)"
    },
    ".cm-scroller": {
      fontFamily: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", Menlo, monospace",
      fontSize: "calc(14px * var(--document-zoom))",
      lineHeight: "1.7"
    },
    ".cm-content": {
      minHeight: "calc(100vh - 112px)",
      padding: "calc(18px * var(--document-zoom)) 0"
    },
    ".cm-line": {
      padding: "0 calc(18px * var(--document-zoom))"
    },
    ".cm-gutters": {
      borderRight: "1px solid var(--border)",
      backgroundColor: "var(--panel)",
      color: "var(--muted)"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent-strong)"
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--accent), transparent 92%)"
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent), transparent 68%)"
    },
    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--warning), transparent 52%)",
      outline: "1px solid color-mix(in srgb, var(--warning), transparent 26%)"
    },
    ".cm-searchMatch-selected": {
      backgroundColor: "color-mix(in srgb, var(--accent), transparent 48%)",
      outline: "2px solid var(--accent)"
    },
    ".cm-cursor": {
      borderLeftColor: "var(--accent-strong)"
    }
  });
}

/**
 * Markdown 源码编辑区，使用 CodeMirror 提供语法高亮、行号和稳定定位。
 * @param value 当前草稿内容。
 * @param fileName 当前文件名，用于辅助技术标签。
 * @param theme 当前明暗主题。
 * @param initialRevealOffset 编辑器首次挂载后需要显示的源码字符偏移。
 * @param editorViewRef CodeMirror 实例引用，供搜索和大纲跳转定位。
 * @param onChange 草稿变更回调，保存动作由外层统一处理。
 * @param onActiveOffsetChange 光标移动或源码滚动时上报当前文档偏移，用于联动大纲。
 */
export function SourceEditor({
  value,
  fileName,
  theme,
  initialRevealOffset,
  editorViewRef,
  onChange,
  onActiveOffsetChange
}: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onActiveOffsetChangeRef = useRef(onActiveOffsetChange);
  const initialRevealOffsetRef = useRef(initialRevealOffset);
  const isSyncingRef = useRef(false);
  const themeCompartment = useMemo(() => new Compartment(), []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onActiveOffsetChangeRef.current = onActiveOffsetChange;
  }, [onActiveOffsetChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const revealOffset = Math.max(0, Math.min(initialRevealOffsetRef.current ?? 0, value.length));
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        selection: {
          anchor: revealOffset
        },
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          rectangularSelection(),
          crosshairCursor(),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          search({ top: false }),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": `编辑 Markdown 源码：${fileName}`
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !isSyncingRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }

            if (update.selectionSet || update.docChanged) {
              onActiveOffsetChangeRef.current(update.state.selection.main.head);
            } else if (update.viewportChanged) {
              const cursorOffset = update.state.selection.main.head;
              const { from, to } = update.view.viewport;

              // 跳转会让光标居中并再次触发视口变化；光标仍可见时优先保留目标标题。
              onActiveOffsetChangeRef.current(cursorOffset >= from && cursorOffset <= to ? cursorOffset : from);
            }
          }),
          keymap.of([...searchKeymap, indentWithTab, ...historyKeymap, ...defaultKeymap]),
          createEditorTheme(),
          themeCompartment.of(theme === "dark" ? oneDark : [])
        ]
      })
    });

    editorViewRef.current = view;
    onActiveOffsetChangeRef.current(revealOffset);
    const revealFrame = window.requestAnimationFrame(() => {
      if (editorViewRef.current !== view) {
        return;
      }

      view.dispatch({
        effects: EditorView.scrollIntoView(revealOffset, {
          y: "start",
          x: "nearest"
        })
      });
    });

    return () => {
      window.cancelAnimationFrame(revealFrame);
      editorViewRef.current = null;
      view.destroy();
    };
  }, [editorViewRef, fileName, themeCompartment]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    isSyncingRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value
      }
    });
    isSyncingRef.current = false;
  }, [editorViewRef, value]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: themeCompartment.reconfigure(theme === "dark" ? oneDark : [])
    });
  }, [editorViewRef, theme, themeCompartment]);

  return (
    <div className="source-editor">
      <div ref={hostRef} className="source-editor__codemirror" />
    </div>
  );
}
