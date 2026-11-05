import { Button, ButtonGroup } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { Dialog } from "./Dialog";

/** Props of {@link ConfirmDialog}. */
export type ConfirmDialogProps = {
  /** Whether the question is showing. */
  open: boolean;
  /** The heading, as the question: "Delete Chase?". */
  title: string;
  /** What will happen, in one sentence. */
  detail: string;
  /** The confirming button's label. */
  confirmLabel: string;
  /** `danger` tints the mark and the button as destructive; `fill` is an ordinary confirmation. */
  tone?: "danger" | "fill";
  /** The mark above the title. */
  icon?: IconName;
  /** The action is in flight: both buttons rest and the dialog cannot be dismissed. */
  pending?: boolean;
  /** Why the last attempt failed, kept on the dialog until the next attempt. */
  error?: string | null;
  /** Cancel, Escape or the scrim. */
  onCancel: () => void;
  /** The confirming button. */
  onConfirm: () => void;
};

/** A yes or no before something that cannot be taken back or that costs: a mark, the question, what follows, Cancel and the confirming button. */
export function ConfirmDialog({ open, title, detail, confirmLabel, tone = "danger", icon = "trash", pending = false, error = null, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      locked={pending}
      mark={
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: tone === "danger" ? "var(--error-fill)" : "var(--sage-fill)",
            color: tone === "danger" ? "var(--error)" : "var(--sage-deep)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={20} />
        </span>
      }
    >
      <span style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: "20px" }}>{detail}</span>
      {error === null ? null : (
        <span role="alert" data-selectable style={{ fontSize: 13, color: "var(--error)", lineHeight: "18px", overflowWrap: "anywhere" }}>
          {error}
        </span>
      )}
      <ButtonGroup justify="flex-end">
        <Button tone="quiet" size="xl" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button tone={tone} size="xl" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}
