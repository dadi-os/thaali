import type { ReactNode } from "react";
import { IconButton } from "../ui/Button";
import { Modal, MODAL_LARGE } from "./Modal";

/** Props of {@link PreviewModal}. */
export type PreviewModalProps = {
  /** Whether the modal is showing. Closing plays the exit animation. */
  open: boolean;
  /** Asked to close: Escape, a press outside the panel, or the close button. */
  onClose: () => void;
  /** The modal's accessible name. */
  label: string;
  /** Escape, presses outside and the close button do not close it, for a surface that is being driven. */
  locked?: boolean;
  /** Classes that size the panel; defaults to the large panel. */
  panelClassName?: string;
  /** Draw over the nearest positioned ancestor instead of the window (see {@link Modal}). */
  scoped?: boolean;
  /** A tile at the head's start: the icon of what is shown. */
  mark?: ReactNode;
  /** The first head line: what is shown, as a name or a row of parts. */
  title: ReactNode;
  /** The second head line, in muted text. */
  subtitle?: ReactNode;
  /** The head's controls before the close button, such as a split button or a copy and download pair. */
  actions?: ReactNode;
  /** A strip under the body, such as the keys that leave or where the thing runs. */
  footer?: ReactNode;
  /** The body: it fills the room between the head and the footer and manages its own scrolling. */
  children: ReactNode;
};

/**
 * The large {@link Modal} for looking at one thing: a head (a mark, a title over a subtitle, actions, close), a body that
 * fills the panel, and an optional footer. A helper task's browser and terminal (`BrowserModal`, `TerminalModal`), a file
 * (`FileModal`) and Someday are each this frame with their own body, so they open, close, layer and look alike.
 */
export function PreviewModal({ open, onClose, label, locked = false, panelClassName = MODAL_LARGE, scoped = false, mark, title, subtitle, actions, footer, children }: PreviewModalProps) {
  return (
    <Modal open={open} onClose={onClose} label={label} locked={locked} panelClassName={panelClassName} scoped={scoped}>
      <div className="flex min-h-[60px] flex-none items-center gap-3 border-b border-rule py-2 pr-3 pl-4">
        {mark === undefined ? null : <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-sage-fill text-sage-text">{mark}</span>}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2.5 text-[13px]">{title}</div>
          {subtitle === undefined ? null : <div className="min-w-0 text-[13px] text-ink-muted">{subtitle}</div>}
        </div>
        {actions}
        <IconButton icon="close" label="Close" size={36} disabled={locked} onClick={onClose} />
      </div>
      {children}
      {footer === undefined ? null : <div className="flex h-11 flex-none items-center gap-3.5 border-t border-rule px-4 text-[13px] text-ink-muted">{footer}</div>}
    </Modal>
  );
}
