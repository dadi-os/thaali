import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "../interaction/dismiss";
import { DIALOG, SCRIM } from "../motion";

/** Props of {@link LargeDialog}. */
export type LargeDialogProps = {
  /** Whether the dialog is showing. Closing plays the exit animation. */
  open: boolean;
  /** Asked to close: Escape, or a press on the scrim. */
  onClose: () => void;
  /** The dialog's accessible name. */
  label: string;
  /** A press on the scrim and Escape do not close it, for a surface that is being driven. */
  locked?: boolean;
  /** The header, body and footer, stacked in a column that fills the panel. */
  children: ReactNode;
};

/**
 * A near-window dialog over the surface it is placed in: a dim scrim and a large panel that grows in and
 * shrinks out, for work that needs room (a live browser or terminal). Escape and the scrim close it through
 * the shared dismiss stack, so a dialog opened over it closes first.
 */
export function LargeDialog({ open, onClose, label, locked = false, children }: LargeDialogProps) {
  useDismiss({ open: open && !locked, onDismiss: onClose });
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="large-dialog"
          className="scrim"
          style={{ background: "rgba(44, 48, 42, 0.34)", zIndex: "var(--z-modal)", animation: "none" }}
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
            className="modal-panel h-[min(780px,calc(100%-96px))] w-[min(1120px,calc(100%-96px))]"
            style={{ animation: "none" }}
            {...DIALOG}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
