import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Theme } from "../hooks/useTheme";

type MermaidBlockProps = {
  code: string;
  theme: Theme;
};

type RenderState =
  | { status: "rendering"; svg: ""; error: "" }
  | { status: "ready"; svg: string; error: "" }
  | { status: "error"; svg: ""; error: string };

export function MermaidBlock({ code, theme }: MermaidBlockProps) {
  const renderId = useMemo(() => `mermaid-${crypto.randomUUID()}`, [code]);
  const [state, setState] = useState<RenderState>({ status: "rendering", svg: "", error: "" });
  const diagramRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) {
      return;
    }

    // 用 Mermaid 计算的原始宽度，避免 SVG 随预览栏变窄而缩小文字。
    const width = diagram.querySelector("svg")?.viewBox.baseVal.width ?? 0;
    diagram.style.width = Number.isFinite(width) && width > 0 ? `${width}px` : "";
  }, [state.svg]);

  useEffect(() => {
    let disposed = false;
    setState({ status: "rendering", svg: "", error: "" });

    const renderDiagram = async () => {
      // 只有文档包含 Mermaid 时才加载渲染库，避免普通文档的首屏承担这段开销。
      const { default: mermaid } = await import("mermaid");
      if (disposed) {
        return;
      }

      mermaid.initialize({
        startOnLoad: false,
        theme: theme === "dark" ? "dark" : "default",
        themeVariables: { fontSize: "15px" },
        securityLevel: "strict"
      });

      const { svg } = await mermaid.render(renderId, code);
      // 主题切换或快速换文档时丢弃过期图表。
      if (!disposed) {
        setState({ status: "ready", svg, error: "" });
      }
    };

    void renderDiagram().catch((error: unknown) => {
      if (!disposed) {
        setState({
          status: "error",
          svg: "",
          error: error instanceof Error ? error.message : "Mermaid 渲染失败"
        });
      }
    });

    return () => {
      disposed = true;
    };
  }, [code, renderId, theme]);

  if (state.status === "error") {
    return (
      <div className="mermaid-block mermaid-block--error">
        <strong>Mermaid 渲染失败</strong>
        <p>{state.error}</p>
        <pre>{code}</pre>
      </div>
    );
  }

  return (
    <div className="mermaid-block">
      {state.status === "rendering" ? <div className="mermaid-block__loading">正在渲染图表...</div> : null}
      {state.svg ? (
        <div ref={diagramRef} className="mermaid-block__diagram" dangerouslySetInnerHTML={{ __html: state.svg }} />
      ) : null}
    </div>
  );
}
