import { useLayoutEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

const defaultShare = 50;
const minShare = 25;
const maxShare = 75;
const keyboardStep = 5;
const shareProperty = "--split-preview-share";

type Drag = {
  pointerId: number;
  start: number;
  availableWidth: number;
  nextShare: number;
};

/** 调整分栏预览所占的宽度。比例由当前分栏持有，离开分栏时恢复均分。
 * @param previewId 由分隔线控制的预览栏 ID。
 */
export function SplitDivider({ previewId }: { previewId: string }) {
  const handleRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef(defaultShare);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const panes = handleRef.current?.parentElement;
    return () => {
      window.cancelAnimationFrame(frameRef.current ?? 0);
      panes?.style.removeProperty(shareProperty);
    };
  }, []);

  const applyShare = (handle: HTMLDivElement, share: number) => {
    const clampedShare = Math.max(minShare, Math.min(maxShare, share));
    if (clampedShare === shareRef.current) {
      return;
    }

    shareRef.current = clampedShare;
    handle.parentElement?.style.setProperty(shareProperty, String(clampedShare / 100));
    handle.setAttribute("aria-valuenow", String(Math.round(clampedShare)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const handle = event.currentTarget;
    const panes = handle.parentElement;
    if (!panes || !event.isPrimary || event.button !== 0 || dragRef.current) {
      return;
    }

    const panesRect = panes.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const availableWidth = panesRect.width - handleRect.width;
    if (availableWidth <= 0) {
      return;
    }

    // 捕获指针，跨进任一栏仍可拖动。记录抓取点，避免按下时分隔线跳动。
    event.preventDefault();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      start: panesRect.left + (event.clientX - handleRect.left),
      availableWidth,
      nextShare: shareRef.current
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drag.nextShare = (event.clientX - drag.start) / drag.availableWidth * 100;
    if (frameRef.current !== null) {
      return;
    }

    const handle = event.currentTarget;
    // 每帧只应用一次最新列宽，让高频拖动保持在布局层，避免重新渲染正文。
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      applyShare(handle, drag.nextShare);
    });
  };

  const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    window.cancelAnimationFrame(frameRef.current ?? 0);
    frameRef.current = null;
    if (event.type === "pointerup") {
      applyShare(event.currentTarget, (event.clientX - drag.start) / drag.availableWidth * 100);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const adjustment = event.key === "ArrowLeft" ? -keyboardStep : keyboardStep;
    applyShare(event.currentTarget, shareRef.current + adjustment);
  };

  return (
    <div
      ref={handleRef}
      className="split-divider"
      role="separator"
      aria-label="Markdown 预览"
      aria-controls={previewId}
      aria-orientation="vertical"
      aria-valuenow={defaultShare}
      aria-valuemin={minShare}
      aria-valuemax={maxShare}
      tabIndex={0}
      title="拖动或使用左右方向键调整分栏宽度"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
      onLostPointerCapture={handleDragEnd}
      onKeyDown={handleKeyDown}
    />
  );
}
