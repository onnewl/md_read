import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { OutlineItem } from "../utils/markdownOutline";

type HeadingJump = {
  top: number;
  scrolling: boolean;
};

function findHeading(contentRoot: HTMLElement, id: string): HTMLElement | null {
  return contentRoot.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    ?? contentRoot.querySelector<HTMLElement>(`#${CSS.escape(`user-content-${id}`)}`);
}

/**
 * 同步预览与大纲。点击时以选中的标题为准，用户继续滚动正文后恢复位置跟随。
 * @param scrollRootRef 正文滚动容器。
 * @param contentRootRef 渲染后的 Markdown 根节点。
 * @param outline 当前文档的大纲。
 * @param previewDocumentId 预览标签 ID，空字符串表示预览关闭。
 * @returns 选中标题、目录是否跟随及点击标题的处理函数。
 */
export function useOutline(
  scrollRootRef: RefObject<HTMLElement>,
  contentRootRef: RefObject<HTMLElement>,
  outline: OutlineItem[],
  previewDocumentId: string
) {
  const [selection, setSelection] = useState({ id: "", followActive: true });
  const jumpRef = useRef<HeadingJump | null>(null);

  const selectHeading = useCallback((item: OutlineItem) => {
    const scrollRoot = scrollRootRef.current;
    const contentRoot = contentRootRef.current;
    if (!scrollRoot || !contentRoot) {
      return;
    }

    const target = findHeading(contentRoot, item.id);
    if (!target) {
      return;
    }

    const currentTop = scrollRoot.scrollTop;
    const distance = target.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top - 12;
    const maxTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    const destination = Math.max(0, Math.min(maxTop, currentTop + distance));
    const moves = Math.abs(currentTop - destination) > 1;
    const smooth = moves && "onscrollend" in scrollRoot && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const jump = { top: moves ? destination : currentTop, scrolling: smooth };

    // 文末多个标题可能对应同一个最大滚动位置，直接选中点击项，避免依赖标题能否抵达视口顶部。
    jumpRef.current = jump;
    setSelection({ id: item.id, followActive: false });
    const completion: unknown = scrollRoot.scrollTo({ top: jump.top, behavior: smooth ? "smooth" : "instant" });
    if (completion instanceof Promise) {
      const finish = () => {
        // 连续点击时，前一次动画结束不能解除后一次跳转的状态。
        if (jumpRef.current === jump) {
          jump.scrolling = false;
        }
      };
      void completion.then(finish, finish);
    }
  }, [contentRootRef, scrollRootRef]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const contentRoot = contentRootRef.current;
    if (!previewDocumentId || !scrollRoot || !contentRoot || outline.length === 0) {
      setSelection({ id: "", followActive: true });
      return;
    }

    const headings = outline
      .flatMap((item) => {
        const element = findHeading(contentRoot, item.id);
        return element ? [{ id: item.id, element }] : [];
      });

    if (headings.length === 0) {
      setSelection({ id: "", followActive: true });
      return;
    }

    const updateByScrollPosition = () => {
      const jump = jumpRef.current;
      // 忽略平滑跳转经过的标题，并在停在目标位置时保留点击选中。
      if (jump && (jump.scrolling || Math.abs(scrollRoot.scrollTop - jump.top) <= 1)) {
        return;
      }
      jumpRef.current = null;

      const rootTop = scrollRoot.getBoundingClientRect().top;
      let current = headings[0];

      for (const heading of headings) {
        const top = heading.element.getBoundingClientRect().top - rootTop;
        if (top <= 24) {
          current = heading;
        } else {
          break;
        }
      }

      setSelection((previous) => previous.id === current.id && previous.followActive
        ? previous
        : { id: current.id, followActive: true });
    };

    const finishScroll = () => {
      const jump = jumpRef.current;
      if (jump) {
        // 旧版 Chromium 通过事件告知滚动结束；用户中断跳转时按实际位置恢复跟随。
        jump.scrolling = false;
        updateByScrollPosition();
      }
    };

    const observer = new ResizeObserver(updateByScrollPosition);
    observer.observe(scrollRoot);
    observer.observe(contentRoot);
    scrollRoot.addEventListener("scroll", updateByScrollPosition, { passive: true });
    scrollRoot.addEventListener("scrollend", finishScroll);
    updateByScrollPosition();

    return () => {
      jumpRef.current = null;
      observer.disconnect();
      scrollRoot.removeEventListener("scroll", updateByScrollPosition);
      scrollRoot.removeEventListener("scrollend", finishScroll);
    };
  }, [contentRootRef, outline, previewDocumentId, scrollRootRef]);

  return { activeId: selection.id, followActive: selection.followActive, selectHeading };
}
