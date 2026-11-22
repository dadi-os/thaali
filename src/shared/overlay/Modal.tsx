import { useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "../interaction/dismiss";
import { DIALOG, floatingSheetMotion, SCRIM } from "../motion";

/** The default panel: near the window's size, for work that needs room. */
export const MODAL_LARGE = "h-[min(780px,calc(100%-96px))] w-[min(1120px,calc(100%-96px))]";

/** How far a side panel floats in from the edges of the surface, in px. */
const SIDE_MARGIN = 12;

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
  /** Where the panel sits: grown in at the centre, or floating in from the left or right edge. */
  placement?: "center" | "left" | "right";
  /** Classes that size the panel; defaults to {@link MODAL_LARGE} at the centre and to none at an edge. */
  panelClassName?: string;
  /** Inline styles for the panel, such as a side panel's width. */
  panelStyle?: CSSProperties;
  /** Draw over the nearest positioned ancestor instead of the whole window: a dialog over a modal's panel, a side panel over its page, or the design gallery framing a modal in a window of a set size. */
  scoped?: boolean;
  /** The panel's content, laid out as a column that fills it. */
  children: ReactNode;
};

/**
 * The one modal every dialog, sheet and large panel in the app is drawn with: a scrim that dims and softens what is
 * behind it and a panel that grows in at the centre or floats in from an edge. Unless `scoped`, it is portaled to the
 * body above the app. Escape and presses outside the panel close it through the shared dismiss stack, so only the
 * topmost overlay answers; menus, popovers and dialogs opened from inside it stack above it (see the layers in
 * `theme/tokens.css`), so a right-click menu or a popover over a modal draws over it and closes first.
 */
export function Modal({ open, onClose, label, locked = false, placement = "center", panelClassName, panelStyle, scoped = false, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss({ open: open && !locked, onDismiss: onClose, surface: panel, outside: true });
  const side = placement !== "center";
  const scrimStyle: CSSProperties = {
    ...(scoped ? { position: "absolute" } : null),
    ...(side ? { justifyContent: placement === "right" ? "flex-end" : "flex-start", padding: SIDE_MARGIN } : null),
  };
  const layer = (
    <AnimatePresence>
      {open ? (
        <motion.div key="modal" className="modal-scrim" style={scrimStyle} {...SCRIM}>
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`modal-panel ${panelClassName ?? (side ? "" : MODAL_LARGE)}`}
            style={{ animation: "none", ...panelStyle }}
            {...(side ? floatingSheetMotion(placement) : DIALOG)}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
  return scoped ? layer : createPortal(layer, document.body);
}
