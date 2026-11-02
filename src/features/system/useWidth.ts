import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** The width in px of the element the returned ref is put on, measured before the first paint and again whenever it changes. */
export function useWidth<Element extends HTMLElement>(): [RefObject<Element | null>, number] {
  const ref = useRef<Element>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentBoxSize[0]!.inlineSize + parseFloat(getComputedStyle(element).paddingLeft) + parseFloat(getComputedStyle(element).paddingRight)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
