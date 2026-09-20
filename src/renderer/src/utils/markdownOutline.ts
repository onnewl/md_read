import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Plugin } from "unified";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { createHeadingSlugger } from "./slug";

export type OutlineItem = {
  id: string;
  text: string;
  depth: number;
  index: number;
  line: number;
  offset: number;
};

/**
 * 从 Markdown AST 提取标题目录，并用同一套 slug 规则处理重复标题。
 * @param markdown Markdown 原始文本。
 * @returns 按文档顺序排列的标题目录。
 */
export function extractOutline(markdown: string): OutlineItem[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const slug = createHeadingSlugger();
  const outline: OutlineItem[] = [];

  visit(tree, "heading", (node) => {
    const text = toString(node).trim();
    if (!text) {
      return;
    }

    outline.push({
      id: slug(text),
      text,
      depth: node.depth,
      index: outline.length,
      line: node.position?.start.line ?? 1,
      offset: node.position?.start.offset ?? 0
    });
  });

  return outline;
}

/**
 * react-markdown 使用的 remark 插件：为标题节点写入稳定 id。
 * @returns unified transformer。
 */
export function remarkHeadingIds(): ReturnType<Plugin<[], Root>> {
  return (tree) => {
    const slug = createHeadingSlugger();

    visit(tree, "heading", (node) => {
      const text = toString(node).trim();
      if (!text) {
        return;
      }

      const data = (node.data ??= {});
      const hProperties = ((data.hProperties ??= {}) as Record<string, unknown>);
      hProperties.id = slug(text);
    });
  };
}
