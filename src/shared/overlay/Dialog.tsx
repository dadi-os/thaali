import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "../interaction/dismiss";
import { DIALOG, SCRIM } from "../motion";
import { Truncate } from "../components/Truncate";

/** Props of {@link Dialog}. */
export type DialogProps = {
  /** Whether the dialog is showing. Closing plays the exit animation. */
  open: boolean;
  /** Asked to close: Escape, or a press on the scrim. */
  onClose: () => void;
  /** The heading, and the dialog's accessible name. */
  title: string;
  /** One line under the title. */
  subtitle?: string;
  /** A mark above the title, such as a tinted icon tile. */
  mark?: ReactNode;
  /** The body: usually a few choices or a short form. */
  children: ReactNode;
  /** The last row, usually a note and the buttons. */
  footer?: ReactNode;
  /** Panel width in px. */
  width?: number;
  /** A press on the scrim and Escape do not close it, for a dialog whose work is in flight. */
  locked?: boolean;
};

/**
 * A dialog over the surface it is placed in (the nearest positioned ancestor): a dim scrim and a panel that
 * grows in and shrinks out. Escape and the scrim close it through the shared dismiss stack, so a menu opened
 * over it closes first.
 */
export function Dialog({ open, onClose, title, subtitle, mark, children, footer, width = 380, locked = false }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss({ open: open && !locked, onDismiss: onClose });
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dialog"
          className="scrim"
          style={{ background: "rgba(44, 48, 42, 0.22)", zIndex: "var(--z-scrim)", animation: "none" }}
          onPointerDown={(event) => {
            if (!locked && event.target === event.currentTarget) {
              onClose();
            }
          }}
          {...SCRIM}
        >
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="dialog-panel" style={{ width, animation: "none" }} {...DIALOG}>
            {mark}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
              {subtitle ? <Truncate text={subtitle} style={{ minWidth: 0, fontSize: 13, color: "var(--ink-muted)" }} /> : null}
            </div>
            {children}
            {footer ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
