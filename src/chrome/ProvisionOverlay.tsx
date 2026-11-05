import { ProvisionDevice } from "../features/system/ProvisionDevice";
import { Dialog } from "../shared/overlay/Dialog";

export interface ProvisionOverlayProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Dismiss the dialog (the scrim, Escape). */
  onClose: () => void;
}

/** The provision dialog, opened from the tray or the app menu rather than a page button: mints a setup code for another device. */
export function ProvisionOverlay({ open, onClose }: ProvisionOverlayProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Provision client" width={384}>
      <div className="scroll" style={{ minHeight: 0, maxHeight: "min(70vh, 32rem)" }}>
        <ProvisionDevice />
      </div>
    </Dialog>
  );
}
