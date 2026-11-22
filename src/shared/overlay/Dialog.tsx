import type { ReactNode } from "react";
import { Truncate } from "../ui/Truncate";
import { Modal } from "./Modal";

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
 * A small dialog over the surface it is placed in (the nearest positioned ancestor): the shared {@link Modal} with a
 * titled column inside it. Escape and the scrim close it through the shared dismiss stack, so a menu opened over it
 * closes first.
 */
export function Dialog({ open, onClose, title, subtitle, mark, children, footer, width = 380, locked = false }: DialogProps) {
  return (
    <Modal scoped open={open} onClose={onClose} label={title} locked={locked} panelClassName="dialog-panel" panelStyle={{ width }}>
      {mark}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
        {subtitle ? <Truncate text={subtitle} style={{ minWidth: 0, fontSize: 13, color: "var(--ink-muted)" }} /> : null}
      </div>
      {children}
      {footer ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{footer}</div> : null}
    </Modal>
  );
}
