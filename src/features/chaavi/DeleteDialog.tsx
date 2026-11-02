import { Button, ButtonGroup } from "../../shared/components/Button";
import { Icon } from "../../shared/components/Icon";

/** How the dialog and its scrim ease in, and out when it leaves. */
const EASE_IN = "320ms cubic-bezier(.22,.61,.36,1)";
const EASE_OUT = "200ms cubic-bezier(.22,.61,.36,1)";

export type DeleteDialogProps = {
  /** The name of the item that would go. */
  name: string;
  /** The delete is in flight. */
  pending: boolean;
  /** Leaves with its exit animation. */
  leaving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** The question before an item goes to the vault's trash: a dim scrim over the page and a panel in its middle, with Cancel and Delete. */
export function DeleteDialog({ name, pending, leaving = false, onCancel, onConfirm }: DeleteDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${name}?`}
      onClick={pending ? undefined : onCancel}
      style={{ position: "absolute", inset: 0, background: "rgba(44,48,42,.22)", display: "flex", alignItems: "center", justifyContent: "center", animation: leaving ? `fade-out ${EASE_OUT} both` : `fade ${EASE_IN} both`, zIndex: 30 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", width: 380, padding: 22, gap: 14, borderRadius: 20, background: "var(--bone)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-deep)", animation: leaving ? `slide-down ${EASE_OUT} both` : `slide-up ${EASE_IN} both` }}
      >
        <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--error-fill)", color: "var(--error)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="trash" size={20} />
        </span>
        <span style={{ fontSize: 18, fontWeight: 600, overflowWrap: "anywhere" }}>{`Delete ${name}?`}</span>
        <span style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: "20px" }}>It moves to the vault’s trash on every device.</span>
        <ButtonGroup justify="flex-end">
          <Button tone="quiet" size="xl" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button tone="danger" size="xl" disabled={pending} onClick={onConfirm}>
            Delete
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
