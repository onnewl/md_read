import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import type { Processor } from "unified";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { createHeadingSlugger } from "./slug";

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();

export type OutlineItem = {
  id: string;
  text: string;
  depth: number;
  index: number;
  line: number;
  offset: number;
};

/**
 * 解析 Markdown，并在同一棵语法树上生成大纲及预览用的标题 ID。
 * @param markdown Markdown 原始文本。
 * @returns 预览用语法树和按文档顺序排列的大纲。
 */
export function parseMarkdownDocument(markdown: string): { tree: Root; outline: OutlineItem[] } {
  const tree = markdownParser.parse(markdown);
  const slug = createHeadingSlugger();
  const outline: OutlineItem[] = [];

  visit(tree, "heading", (node) => {
    const text = toString(node).trim();
    if (!text) {
      return;
    }

    const id = slug(text);
    const data = (node.data ??= {});
    const hProperties = ((data.hProperties ??= {}) as Record<string, unknown>);
    hProperties.id = id;

    outline.push({
      id,
      text,
      depth: node.depth,
      index: outline.length,
      line: node.position?.start.line ?? 1,
      offset: node.position?.start.offset ?? 0
    });
  });

  return { tree, outline };
}

/**
 * 让预览复用已经解析的语法树，后续 HTML 转换、清理和渲染仍走原有管线。
 * @param tree 当前文档的语法树，已带有与大纲一致的标题 ID。
 */
export function remarkParsedDocument(this: Processor, tree: Root): void {
  this.parser = () => tree;
}
