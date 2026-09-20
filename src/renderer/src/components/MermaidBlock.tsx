import { useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";
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

  useEffect(() => {
    let disposed = false;

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "strict"
    });

    setState({ status: "rendering", svg: "", error: "" });

    // Mermaid 渲染是异步的，主题切换和快速换文档时要丢弃过期结果。
    mermaid
      .render(renderId, code)
      .then(({ svg }) => {
        if (!disposed) {
          setState({ status: "ready", svg, error: "" });
        }
      })
      .catch((error: unknown) => {
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
      {state.svg ? <div dangerouslySetInnerHTML={{ __html: state.svg }} /> : null}
    </div>
  );
}
