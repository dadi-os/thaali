import { useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "../interaction/dismiss";
import { DIALOG, SCRIM } from "../motion";

/** The default panel: near the window's size, for work that needs room. */
export const MODAL_LARGE = "h-[min(780px,calc(100%-96px))] w-[min(1120px,calc(100%-96px))]";

/** Props of {@link Modal}. */
export type ModalProps = {
  /** Whether the modal is showing. Closing plays the exit animation. */
  open: boolean;
  /** Asked to close: Escape, or a press outside the panel. */
  onClose: () => void;
  /** The modal's accessible name. */
  label: string;
  /** Escape and presses outside do not close it, for a surface that is being driven or work in flight. */
  locked?: boolean;
  /** Classes that size the panel; defaults to {@link MODAL_LARGE}. */
  panelClassName?: string;
  /** Inline styles for the panel, such as a dialog's width. */
  panelStyle?: CSSProperties;
  /** Draw over the nearest positioned ancestor instead of the whole window: a dialog over a modal's panel, or the design gallery framing a modal in a window of a set size. */
  scoped?: boolean;
  /** The panel's content, laid out as a column that fills it. */
  children: ReactNode;
};

/**
 * The one modal every dialog and panel in the app is drawn with, always centred: a scrim that frosts what is
 * behind it (a tinted dim and a strong blur) and a panel that grows in. Unless `scoped`, it is portaled to the
 * body above the app. Escape and presses outside the panel close it through the shared dismiss stack, so only the
 * topmost overlay answers; menus, popovers and dialogs opened from inside it stack above it (see the layers in
 * `theme/tokens.css`), so a right-click menu or a popover over a modal draws over it and closes first.
 */
export function Modal({ open, onClose, label, locked = false, panelClassName = MODAL_LARGE, panelStyle, scoped = false, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss({ open: open && !locked, onDismiss: onClose, surface: panel, outside: true });
  const scrimStyle = scoped ? ({ position: "absolute" } as const) : undefined;
  const layer = (
    <AnimatePresence>
      {open ? (
        <motion.div key="modal" className="modal-scrim" style={scrimStyle} {...SCRIM}>
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={label} className={`modal-panel ${panelClassName}`} style={{ animation: "none", ...panelStyle }} {...DIALOG}>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
  return scoped ? layer : createPortal(layer, document.body);
}
