import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Props of {@link FadeScroll}. */
export type FadeScrollProps = {
  /** The tallest the region grows to, in px, before it scrolls; it also gives up height when its parent is short. */
  maxHeight?: number;
  className?: string;
  children: ReactNode;
};

/** Height of the fade at a scrolled edge, in px. */
const FADE_PX = 18;

/** A vertical scroll region that fades its content out at an edge that has more beyond it, so cut-off text reads as continuing. */
export function FadeScroll({ maxHeight, className, children }: FadeScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild !== null) {
      observer.observe(el.firstElementChild);
    }
    return () => observer.disconnect();
  }, [measure]);
  const mask = `linear-gradient(to bottom, transparent 0, #000 ${edges.top ? FADE_PX : 0}px, #000 calc(100% - ${edges.bottom ? FADE_PX : 0}px), transparent 100%)`;
  return (
    <div
      ref={ref}
      onScroll={measure}
      className={`scroll min-h-0 overscroll-contain ${className ?? ""}`}
      style={{ maxHeight, overflowX: "hidden", overflowY: "auto", maskImage: mask, WebkitMaskImage: mask }}
      data-top={edges.top}
      data-bottom={edges.bottom}
    >
      <div>{children}</div>
    </div>
  );
}
