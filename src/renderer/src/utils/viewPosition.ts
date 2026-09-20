const sourcePositionSelector = "[data-source-start][data-source-end]";

type PositionedElement = {
  element: HTMLElement;
  start: number;
  end: number;
  rect: DOMRect;
};

function collectPositionedElements(contentRoot: HTMLElement): PositionedElement[] {
  return Array.from(contentRoot.querySelectorAll<HTMLElement>(sourcePositionSelector)).flatMap((element) => {
    const start = Number(element.dataset.sourceStart);
    const end = Number(element.dataset.sourceEnd);
    const rect = element.getBoundingClientRect();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || rect.height <= 0) {
      return [];
    }

    return [{ element, start, end, rect }];
  });
}

/**
 * 获取预览视口顶部附近内容对应的 Markdown 源码偏移。
 * @param scrollRoot 预览独立滚动容器。
 * @param contentRoot Markdown 正文根节点。
 * @param fallbackOffset 无法找到带源码位置的节点时使用的兜底偏移。
 * @returns 最接近当前预览位置的源码字符偏移。
 */
export function getPreviewSourceOffset(
  scrollRoot: HTMLElement,
  contentRoot: HTMLElement,
  fallbackOffset = 0
): number {
  const rootRect = scrollRoot.getBoundingClientRect();
  const anchorY = Math.min(rootRect.bottom - 1, rootRect.top + 20);
  const positionedElements = collectPositionedElements(contentRoot);

  if (positionedElements.length === 0) {
    return fallbackOffset;
  }

  // 同一点可能同时落在列表和列表项等嵌套块中，优先源码范围更小的节点可得到更精确的位置。
  positionedElements.sort((left, right) => {
    const leftDistance =
      anchorY < left.rect.top ? left.rect.top - anchorY : anchorY > left.rect.bottom ? anchorY - left.rect.bottom : 0;
    const rightDistance =
      anchorY < right.rect.top
        ? right.rect.top - anchorY
        : anchorY > right.rect.bottom
          ? anchorY - right.rect.bottom
          : 0;

    return leftDistance - rightDistance || left.end - left.start - (right.end - right.start);
  });

  return positionedElements[0]?.start ?? fallbackOffset;
}

/**
 * 将预览正文滚动到包含指定源码偏移的 Markdown 块。
 * @param scrollRoot 预览独立滚动容器。
 * @param contentRoot Markdown 正文根节点。
 * @param sourceOffset CodeMirror 中的源码字符偏移。
 * @returns 是否找到了可定位的预览节点。
 */
export function scrollPreviewToSourceOffset(
  scrollRoot: HTMLElement,
  contentRoot: HTMLElement,
  sourceOffset: number
): boolean {
  const positionedElements = collectPositionedElements(contentRoot);
  if (positionedElements.length === 0) {
    return false;
  }

  const containingElements = positionedElements
    .filter((item) => item.start <= sourceOffset && item.end >= sourceOffset)
    .sort((left, right) => left.end - left.start - (right.end - right.start));
  const previousElements = positionedElements
    .filter((item) => item.start <= sourceOffset)
    .sort((left, right) => right.start - left.start || left.end - left.start - (right.end - right.start));
  const nextElements = positionedElements
    .filter((item) => item.start > sourceOffset)
    .sort((left, right) => left.start - right.start || left.end - left.start - (right.end - right.start));
  const target = containingElements[0] ?? previousElements[0] ?? nextElements[0];

  if (!target) {
    return false;
  }

  const rootRect = scrollRoot.getBoundingClientRect();
  const nextScrollTop = scrollRoot.scrollTop + target.rect.top - rootRect.top - 12;

  // 切换模式时需要立即稳定到目标位置，直接赋值可避免容器的 smooth CSS 产生二次动画。
  scrollRoot.scrollTop = Math.max(0, nextScrollTop);
  return true;
}
