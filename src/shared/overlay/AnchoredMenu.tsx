import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { tidyActions, type ActionList } from "../interaction/actions";
import { useDismiss } from "../interaction/dismiss";
import { MenuSurface } from "./Menu";

/** Props of {@link AnchoredMenu}. */
export type AnchoredMenuProps = {
  /** What the menu offers. */
  actions: ActionList;
  /** The element the menu opens from, in window coordinates; `null` keeps the menu shut. */
  anchor: DOMRect | null;
  /** Asked to close: Escape, a press outside, a scroll or a resize, or after a row is chosen. */
  onClose: () => void;
  /** Lines of context drawn above the rows, such as what the menu is about. */
  header?: ReactNode;
  /** Panel width in px. */
  width?: number;
};

/** The gap between the anchor and the panel, the room kept from the window's edge, and the height of one row plus the panel's padding, in px. */
const GAP = 6;
const EDGE = 8;
const ROW = 36;
const PAD = 10;
/** The room a header takes above the rows, to place the panel before it has been measured. */
const HEADER = 64;

/**
 * The click form of a context menu: the same {@link MenuSurface} the right-click menu uses, opened under the
 * element it belongs to (above it when there is no room under), flush with its left edge, kept inside the window.
 */
export function AnchoredMenu({ actions, anchor, onClose, header, width = 220 }: AnchoredMenuProps) {
  const surface = useRef<HTMLDivElement>(null);
  const open = anchor !== null;
  useDismiss({ open, onDismiss: onClose, surface, outside: true });

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  const height = tidyActions(actions).length * ROW + PAD + (header === undefined ? 0 : HEADER);
  const flip = anchor !== null && anchor.bottom + GAP + height > window.innerHeight - EDGE;
  const left = anchor === null ? 0 : Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));
  const top = anchor === null ? 0 : flip ? Math.max(EDGE, anchor.top - GAP - height) : anchor.bottom + GAP;

  return createPortal(
    <AnimatePresence>
      {anchor === null ? null : (
        <div key="menu" ref={surface} style={{ position: "fixed", left, top, width, zIndex: "var(--z-menu)", display: "flex", flexDirection: "column", gap: 6 }}>
          {header === undefined ? null : (
            <div data-selectable className="floating" style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px", fontSize: 12, color: "var(--ink-muted)", minWidth: 0 }}>
              {header}
            </div>
          )}
          <MenuSurface actions={actions} onChosen={onClose} origin={`${flip ? "bottom" : "top"} left`} width={width} />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
