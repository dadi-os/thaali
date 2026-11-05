/**
 * Scroll edges: no scrollbar draws anywhere, so a scrolling region says it continues by fading the edge
 * that has more content beyond it. One observer marks every scroller with `data-edge-top`, `data-edge-bottom`,
 * `data-edge-left` and `data-edge-right`; the base styles turn those marks into the fade, so no component
 * measures or styles its own.
 */

/** What counts as a scroller: the ScrollArea class and the utility classes components already use. */
const SCROLLER = ".scroll, [data-scroll], .overflow-y-auto, .overflow-auto, .overflow-x-auto";

/** How far from an edge counts as being at it, in px. */
const EDGE_SLACK_PX = 1;

/** Set or clear one edge mark. */
function mark(el: HTMLElement, name: string, on: boolean): void {
  if (on) {
    el.setAttribute(name, "");
  } else {
    el.removeAttribute(name);
  }
}

/** Read how far `el` is scrolled and mark the edges that still have content beyond them. */
function measure(el: HTMLElement): void {
  const verticalRoom = el.scrollHeight - el.clientHeight;
  const horizontalRoom = el.scrollWidth - el.clientWidth;
  mark(el, "data-edge-top", verticalRoom > EDGE_SLACK_PX && el.scrollTop > EDGE_SLACK_PX);
  mark(el, "data-edge-bottom", verticalRoom > EDGE_SLACK_PX && verticalRoom - el.scrollTop > EDGE_SLACK_PX);
  mark(el, "data-edge-left", horizontalRoom > EDGE_SLACK_PX && el.scrollLeft > EDGE_SLACK_PX);
  mark(el, "data-edge-right", horizontalRoom > EDGE_SLACK_PX && horizontalRoom - el.scrollLeft > EDGE_SLACK_PX);
}

/**
 * Start marking scroll edges on the whole document. Returns the function that stops it.
 * Scrolling is caught in the capture phase because scroll events do not bubble; size changes of a scroller
 * and of what it holds are watched so the fade follows content that arrives or leaves.
 */
export function installScrollEdges(): () => void {
  const watched = new WeakSet<Element>();
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement) {
        measure(entry.target);
      }
    }
  });

  const adopt = (root: ParentNode): void => {
    const found = root instanceof Element && root.matches(SCROLLER) ? [root, ...root.querySelectorAll(SCROLLER)] : [...root.querySelectorAll(SCROLLER)];
    for (const el of found) {
      if (!(el instanceof HTMLElement)) {
        continue;
      }
      if (!watched.has(el)) {
        watched.add(el);
        resize.observe(el);
      }
      for (const child of el.children) {
        resize.observe(child);
      }
      measure(el);
    }
  };

  const onScroll = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches(SCROLLER)) {
      measure(target);
    }
  };

  let queued = false;
  const mutated = new MutationObserver(() => {
    if (queued) {
      return;
    }
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      adopt(document);
    });
  });

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  mutated.observe(document.body, { childList: true, subtree: true });
  adopt(document);

  return () => {
    document.removeEventListener("scroll", onScroll, { capture: true });
    mutated.disconnect();
    resize.disconnect();
  };
}
