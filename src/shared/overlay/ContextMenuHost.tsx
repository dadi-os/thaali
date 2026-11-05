import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { tidyActions } from "../interaction/actions";
import { installContextMenu, type ContextRequest } from "../interaction/contextMenu";
import { useDismiss } from "../interaction/dismiss";
import { MenuSurface } from "./Menu";

const WIDTH = 220;
/** One row's height and the panel's padding, to place the panel before it has been measured. */
const ROW = 36;
const PAD = 10;
const EDGE = 8;

/**
 * The window's one context menu: mounted once in the shell, it takes over the native menu and shows the menu
 * of whatever is right-clicked, at the pointer, kept inside the window. It closes on Escape, a press outside,
 * a scroll, a resize or the window losing focus.
 */
export function ContextMenuHost() {
  const [request, setRequest] = useState<ContextRequest | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => installContextMenu(setRequest), []);

  const close = () => setRequest(null);
  useDismiss({ open: request !== null, onDismiss: close, surface, outside: true });

  useEffect(() => {
    if (request === null) {
      return undefined;
    }
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [request]);

  const rows = request === null ? 0 : tidyActions(request.actions).length;
  const height = rows * ROW + PAD;
  const flipX = request !== null && request.x + WIDTH + EDGE > window.innerWidth;
  const flipY = request !== null && request.y + height + EDGE > window.innerHeight;
  const left = request === null ? 0 : Math.max(EDGE, flipX ? request.x - WIDTH : request.x);
  const top = request === null ? 0 : Math.max(EDGE, flipY ? request.y - height : request.y);

  return createPortal(
    <AnimatePresence>
      {request === null ? null : (
        <div key={`${request.x}:${request.y}`} ref={surface} style={{ position: "fixed", left, top, zIndex: "var(--z-menu)" }}>
          <MenuSurface actions={request.actions} onChosen={close} origin={`${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}`} width={WIDTH} />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
