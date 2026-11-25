const searchResultsName = "markdown-search-results";
const searchCurrentName = "markdown-search-current";
const ignoredParents = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "BUTTON"]);

type HighlightRegistry = {
  set(name: string, highlight: unknown): void;
  delete(name: string): boolean;
};

type HighlightConstructor = new () => { add(range: Range): unknown };

type TextSegment = {
  node: Text;
  text: string;
  start: number;
  end: number;
};

let currentMatches: Range[] = [];

function getHighlightRegistry(): HighlightRegistry | null {
  if (typeof CSS === "undefined") {
    return null;
  }

  return (CSS as typeof CSS & { highlights?: HighlightRegistry }).highlights ?? null;
}

function createHighlight(ranges: Range[]): unknown | null {
  const HighlightClass = (globalThis as typeof globalThis & { Highlight?: HighlightConstructor }).Highlight;
  if (!HighlightClass) {
    return null;
  }

  // 高频词可能命中大量节点，逐个添加 Range 可以避开展开参数的数量上限。
  const highlight = new HighlightClass();
  for (const range of ranges) {
    highlight.add(range);
  }
  return highlight;
}

function findMatches(text: string, query: string): number[] {
  const indexes: number[] = [];
  const lowerText = text.toLocaleLowerCase();
  const lowerQuery = query.toLocaleLowerCase();
  let fromIndex = 0;

  while (fromIndex < lowerText.length) {
    const index = lowerText.indexOf(lowerQuery, fromIndex);
    if (index === -1) {
      break;
    }

    indexes.push(index);
    fromIndex = index + lowerQuery.length;
  }

  return indexes;
}

function collectTextNodes(root: HTMLElement, rejectCodeBlocks: boolean): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        !parent ||
        ignoredParents.has(parent.tagName) ||
        parent.closest(".code-block__toolbar, .markdown-image__fallback, .mermaid-block__loading") ||
        (rejectCodeBlocks && parent.closest(".code-block"))
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  return textNodes;
}

function createTextNodeRanges(textNode: Text, query: string): Range[] {
  const text = textNode.nodeValue ?? "";

  return findMatches(text, query).map((index) => {
    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + query.length);
    return range;
  });
}

function createSegments(textNodes: Text[]): TextSegment[] {
  let cursor = 0;

  return textNodes.map((node) => {
    const text = node.nodeValue ?? "";
    const segment = {
      node,
      text,
      start: cursor,
      end: cursor + text.length
    };
    cursor = segment.end;
    return segment;
  });
}

/** 将代码块里的命中映射到高亮令牌，允许一个 Range 跨越多个文本节点。 */
function createCodeBlockRanges(codeElement: HTMLElement, query: string): Range[] {
  const textNodes = collectTextNodes(codeElement, false);
  const segments = createSegments(textNodes);
  const codeText = segments.map((segment) => segment.text).join("");
  const ranges: Range[] = [];
  let startIndex = 0;
  let endIndex = 0;

  // 命中按源码顺序返回，两个游标只前移。起点在边界时取后一个节点，终点取前一个节点。
  for (const start of findMatches(codeText, query)) {
    const end = start + query.length;
    while (startIndex < segments.length && segments[startIndex].end <= start) {
      startIndex++;
    }
    while (endIndex < segments.length && segments[endIndex].end < end) {
      endIndex++;
    }

    const startSegment = segments[startIndex];
    const endSegment = segments[endIndex];
    if (!startSegment || !endSegment) {
      break;
    }

    const range = document.createRange();
    range.setStart(startSegment.node, start - startSegment.start);
    range.setEnd(endSegment.node, end - endSegment.start);
    ranges.push(range);
  }

  return ranges;
}

function collectSearchRanges(root: HTMLElement, query: string): Range[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const ranges = collectTextNodes(root, true).flatMap((textNode) =>
    createTextNodeRanges(textNode, normalizedQuery)
  );

  // highlight.js 会把一段代码拆成多个 span；Range 可以跨 token 高亮，且完全不改写 React 管理的 DOM。
  for (const codeElement of root.querySelectorAll<HTMLElement>(".code-block pre code")) {
    for (const range of createCodeBlockRanges(codeElement, normalizedQuery)) {
      ranges.push(range);
    }
  }

  // 普通正文和代码块分别收集，合并后按 DOM 起点排序才能保持从上到下的导航顺序。
  ranges.sort((left, right) => left.compareBoundaryPoints(Range.START_TO_START, right));

  return ranges;
}

/**
 * 清理预览正文中的搜索高亮，不修改任何正文节点。
 * @param _root 保留正文根节点参数以兼容搜索 Hook 的调用边界。
 */
export function clearSearchHighlights(_root: HTMLElement): void {
  const registry = getHighlightRegistry();
  registry?.delete(searchResultsName);
  registry?.delete(searchCurrentName);
  currentMatches = [];
}

/**
 * 统计当前正文中的搜索命中数量，不修改 DOM。
 * @param root Markdown 正文根节点。
 * @param query 搜索关键词，按字面量匹配且大小写不敏感。
 * @returns 命中数量。
 */
export function countSearchMatches(root: HTMLElement, query: string): number {
  return collectSearchRanges(root, query).length;
}

/**
 * 使用 CSS Custom Highlight API 高亮搜索结果。
 * @param root Markdown 正文根节点。
 * @param query 搜索关键词，按字面量匹配且大小写不敏感。
 * @returns 每个逻辑命中对应的 Range。
 */
export function highlightSearch(root: HTMLElement, query: string): Range[] {
  clearSearchHighlights(root);

  const ranges = collectSearchRanges(root, query);
  const registry = getHighlightRegistry();
  const highlight = createHighlight(ranges);
  if (registry && highlight && ranges.length > 0) {
    registry.set(searchResultsName, highlight);
  }

  currentMatches = ranges;
  return ranges;
}

/** 设置当前搜索命中样式。 */
export function activateSearchMatch(index: number): void {
  const registry = getHighlightRegistry();
  registry?.delete(searchCurrentName);

  const range = currentMatches[index];
  const highlight = range ? createHighlight([range]) : null;
  if (registry && highlight) {
    registry.set(searchCurrentName, highlight);
  }
}

/**
 * 将指定搜索命中滚动到正文视口中央。
 * @param index 命中项索引，从 0 开始。
 */
export function scrollToSearchMatch(index: number): void {
  const range = currentMatches[index];
  const startElement = range?.startContainer.parentElement;
  if (!range || !startElement) {
    return;
  }

  activateSearchMatch(index);
  const scrollRoot = startElement.closest<HTMLElement>(".document-scroll");
  const rangeRect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (scrollRoot && rangeRect) {
    const rootRect = scrollRoot.getBoundingClientRect();
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + rangeRect.top - rootRect.top - scrollRoot.clientHeight / 2 + rangeRect.height / 2,
      behavior: "smooth"
    });
  } else {
    startElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const scrollableCodeBlock = startElement.closest<HTMLElement>(".code-block pre");
  if (scrollableCodeBlock && rangeRect) {
    const blockRect = scrollableCodeBlock.getBoundingClientRect();
    scrollableCodeBlock.scrollTo({
      left: scrollableCodeBlock.scrollLeft + rangeRect.left - blockRect.left - 24,
      behavior: "smooth"
    });
  }
}
