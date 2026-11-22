import type { ReactNode } from "react";
import { Modal } from "./Modal";

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
 * A side sheet over the surface it is placed in (the nearest positioned ancestor): the shared {@link Modal} placed at
 * an edge, a rounded panel that floats a margin in from the window's edges, lifting off the side it enters from and
 * back. Escape and the scrim close it through the shared dismiss stack.
 */
export function Sheet({ open, onClose, label, width = 420, from = "right", locked = false, children }: SheetProps) {
  return (
    <Modal
      scoped
      open={open}
      onClose={onClose}
      label={label}
      locked={locked}
      placement={from}
      panelStyle={{ width, maxWidth: "100%", height: "100%", maxHeight: "100%", minHeight: 0, borderRadius: 24 }}
    >
      {children}
    </Modal>
  );
}
