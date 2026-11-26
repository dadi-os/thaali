import { useCallback, useRef, useState } from "react";

/**
 * Whether an element has been scrolled into view, and the ref callback to put on it. Once seen it stays seen, so a
 * lazy check runs once when the element first arrives and not again each time it scrolls past.
 */
export function useInView<El extends Element>(): [ref: (element: El | null) => void, seen: boolean] {
  const [seen, setSeen] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const ref = useCallback((element: El | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (element === null) {
      return;
    }
    const watching = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        watching.disconnect();
      }
    });
    watching.observe(element);
    observer.current = watching;
  }, []);
  return [ref, seen];
}
