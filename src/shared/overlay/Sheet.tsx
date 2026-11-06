import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "../interaction/dismiss";
import { floatingSheetMotion, SCRIM } from "../motion";

/** How far the panel floats in from the edges of the surface, in px. */
const MARGIN = 12;

/** Props of {@link Sheet}. */
export type SheetProps = {
  /** Whether the sheet is showing. Closing plays the exit animation. */
  open: boolean;
  /** Asked to close: Escape, or a press on the scrim. */
  onClose: () => void;
  /** The sheet's accessible name. */
  label: string;
  /** Panel width in px; the panel is never wider than the surface less its margins. */
  width?: number;
  /** The edge it slides from. */
  from?: "left" | "right";
  /** A press on the scrim and Escape do not close it, for a sheet with unsaved work in flight. */
  locked?: boolean;
  children: ReactNode;
};

/**
 * A side sheet over the surface it is placed in (the nearest positioned ancestor): a light scrim and a rounded panel that
 * floats a margin in from the window's edges, lifting off the side it enters from and back. Escape and the scrim close it
 * through the shared dismiss stack.
 */
export function Sheet({ open, onClose, label, width = 420, from = "right", locked = false, children }: SheetProps) {
  useDismiss({ open: open && !locked, onDismiss: onClose });
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sheet"
          className="scrim"
          style={{ background: "rgba(44, 48, 42, 0.18)", zIndex: "var(--z-scrim)", display: "flex", justifyContent: from === "right" ? "flex-end" : "flex-start", padding: MARGIN, animation: "none" }}
          onPointerDown={(event) => {
            if (!locked && event.target === event.currentTarget) {
              onClose();
            }
          }}
          {...SCRIM}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            style={{ display: "flex", flexDirection: "column", width, maxWidth: "100%", height: "100%", overflow: "hidden", background: "var(--bone)", border: "1px solid var(--glass-border)", borderRadius: 24, boxShadow: "0 2px 6px rgba(44,48,42,.08), 0 28px 80px rgba(44,48,42,.22)" }}
            {...floatingSheetMotion(from)}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
