import { RefObject, useEffect, useState } from "react";
import type { OutlineItem } from "../utils/markdownOutline";

export function useOutline(
  scrollRootRef: RefObject<HTMLElement>,
  contentRootRef: RefObject<HTMLElement>,
  outline: OutlineItem[]
): string {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const contentRoot = contentRootRef.current;
    if (!scrollRoot || !contentRoot || outline.length === 0) {
      setActiveId("");
      return;
    }

    const headings = outline
      .map((item) => contentRoot.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`))
      .filter((heading): heading is HTMLElement => Boolean(heading));

    if (headings.length === 0) {
      setActiveId("");
      return;
    }

    const updateByScrollPosition = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      let current = headings[0];

      for (const heading of headings) {
        const top = heading.getBoundingClientRect().top - rootTop;
        if (top <= 24) {
          current = heading;
        } else {
          break;
        }
      }

      setActiveId(current.id);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target instanceof HTMLElement) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-12% 0px -72% 0px",
        threshold: [0, 1]
      }
    );

    headings.forEach((heading) => observer.observe(heading));
    scrollRoot.addEventListener("scroll", updateByScrollPosition, { passive: true });
    updateByScrollPosition();

    return () => {
      observer.disconnect();
      scrollRoot.removeEventListener("scroll", updateByScrollPosition);
    };
  }, [contentRootRef, outline, scrollRootRef]);

  return activeId;
}
