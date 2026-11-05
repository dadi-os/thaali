import { useEffect, useRef, type RefObject } from "react";

/** One open overlay waiting to be dismissed: what to call and where its surface is. */
type Entry = {
  dismiss: () => void;
  surface: RefObject<HTMLElement | null> | null;
  outside: boolean;
};

/** The open overlays, oldest first; only the last one answers Escape and outside presses. */
const stack: Entry[] = [];
let installed = false;

/** Handle Escape and presses outside the topmost overlay, for the whole document. */
function install(): void {
  if (installed) {
    return;
  }
  installed = true;

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) {
      return;
    }
    const top = stack[stack.length - 1];
    if (top === undefined) {
      return;
    }
    event.preventDefault();
    top.dismiss();
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      const top = stack[stack.length - 1];
      if (top === undefined || !top.outside || top.surface === null) {
        return;
      }
      const surface = top.surface.current;
      if (surface === null || (event.target instanceof Node && surface.contains(event.target))) {
        return;
      }
      top.dismiss();
    },
    true,
  );
}

/** Options for {@link useDismiss}. */
export type DismissOptions = {
  /** Whether the overlay is open; only an open overlay joins the stack. */
  open: boolean;
  /** Close the overlay. */
  onDismiss: () => void;
  /** The overlay's surface. With `outside`, a press outside it dismisses. */
  surface?: RefObject<HTMLElement | null>;
  /** Dismiss on a press outside the surface. */
  outside?: boolean;
};

/**
 * Join the dismiss stack while open. Escape closes only the topmost overlay, so a menu over a dialog closes
 * first and the dialog stays; with `outside`, a press outside the topmost overlay's surface closes it too.
 */
export function useDismiss({ open, onDismiss, surface, outside = false }: DismissOptions): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    install();
    const entry: Entry = { dismiss: () => latest.current(), surface: surface ?? null, outside };
    stack.push(entry);
    return () => {
      const at = stack.indexOf(entry);
      if (at >= 0) {
        stack.splice(at, 1);
      }
    };
  }, [open, surface, outside]);
}
