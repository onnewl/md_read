import { memo } from "react";
import type { Element, Root } from "hast";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import { MermaidBlock } from "./MermaidBlock";
import { CodeBlock } from "./CodeBlock";
import type { Theme } from "../hooks/useTheme";
import { remarkHeadingIds } from "../utils/markdownOutline";

type MarkdownViewerProps = {
  content: string;
  baseDir: string;
  theme: Theme;
  contentRef: React.RefObject<HTMLElement>;
};

const sanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id", "className", "aria-label", "aria-hidden"],
    a: [...(defaultSchema.attributes?.a ?? []), "href", "title", "target", "rel"],
    img: [...(defaultSchema.attributes?.img ?? []), "src", "alt", "title", "width", "height"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    input: [...(defaultSchema.attributes?.input ?? []), "type", "checked", "disabled"]
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
    src: ["http", "https", "data", "md-asset"]
  }
};

const sourcePositionTags = new Set([
  "blockquote",
  "details",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "tr",
  "ul"
]);

/**
 * 在 sanitize 完成后给安全块节点附加源码范围，供预览与 CodeMirror 切换时定位。
 * 属性值只来自 unified AST 的数字位置，不接受 Markdown 内嵌 HTML 注入的同名属性。
 */
function rehypeSourcePositions() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (!sourcePositionTags.has(node.tagName) || start === undefined || end === undefined) {
        return;
      }

      node.properties["data-source-start"] = start;
      node.properties["data-source-end"] = end;
    });
  };
}

function getLanguage(className?: string): string | undefined {
  return /language-([\w-]+)/.exec(className ?? "")?.[1];
}

function MarkdownViewerContent({ content, baseDir, theme, contentRef }: MarkdownViewerProps) {
  const components: Components = {
    a({ href, children, ...props }) {
      const safeHref = href ?? "";

      return (
        <a
          {...props}
          href={safeHref}
          onClick={(event) => {
            event.preventDefault();
            if (safeHref.startsWith("#")) {
              document.getElementById(decodeURIComponent(safeHref.slice(1)))?.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
              return;
            }

            void window.mdApi.openExternal(safeHref);
          }}
        >
          {children}
        </a>
      );
    },
    img({ src, alt, ...props }) {
      const resolvedSrc = src ? window.mdApi.resolveAssetUrl(baseDir, src) : "";

      return (
        <span className="markdown-image">
          <img
            {...props}
            src={resolvedSrc}
            alt={alt ?? ""}
            onError={(event) => {
              event.currentTarget.classList.add("is-broken");
            }}
          />
          <span className="markdown-image__fallback">图片加载失败</span>
        </span>
      );
    },
    code(props) {
      const { inline, className, children, node } = props as {
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
        node?: {
          position?: {
            start: { line: number };
            end: { line: number };
          };
        };
      };
      const code = String(children).replace(/\n$/, "");
      const language = getLanguage(className);
      const isInline =
        inline ?? (!className && node?.position?.start.line === node?.position?.end.line);

      if (isInline) {
        return <code>{children}</code>;
      }

      if (!language) {
        return <CodeBlock code={code} />;
      }

      if (language.toLowerCase() === "mermaid") {
        return <MermaidBlock code={code} theme={theme} />;
      }

      return <CodeBlock code={code} language={language} />;
    }
  };

  return (
    <article ref={contentRef} className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkHeadingIds]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex, rehypeSourcePositions]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

/**
 * Markdown 正文渲染成本较高，且预览搜索会在渲染后的 DOM 中插入 mark。
 * 只在文档内容、资源目录或主题变化时重渲染，避免搜索状态刷新破坏高亮 DOM。
 */
export const MarkdownViewer = memo(
  MarkdownViewerContent,
  (previous, next) =>
    previous.content === next.content &&
    previous.baseDir === next.baseDir &&
    previous.theme === next.theme &&
    previous.contentRef === next.contentRef
);
