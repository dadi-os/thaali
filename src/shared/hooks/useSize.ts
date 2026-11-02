import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** The width and height in px of an element's border box. */
export type Size = { width: number; height: number };

/** The size of the element the returned ref is put on, measured before the first paint and again whenever it changes; zero until it has been. */
export function useSize<Element extends HTMLElement>(): [RefObject<Element | null>, Size] {
  const ref = useRef<Element>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    const measure = (width: number, height: number) => setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    const box = element.getBoundingClientRect();
    measure(box.width, box.height);
    const observer = new ResizeObserver(([entry]) => {
      const border = entry!.borderBoxSize[0]!;
      measure(border.inlineSize, border.blockSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
