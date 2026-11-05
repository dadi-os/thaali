import { useState } from "react";
import { forgetDevice } from "../../contexts/connection";
import { ConfirmDialog } from "../../shared/overlay/ConfirmDialog";

export interface ForgetDeviceDialogProps {
  /** Whether the confirmation is showing. */
  open: boolean;
  /** Dismiss without forgetting (Cancel, Escape, the backdrop). */
  onClose: () => void;
}

/**
 * Confirmation before Forget this device. Forgetting takes this computer off dadi and deletes its setup code,
 * and onboarding then asks for a new one; a failure stays on the dialog with its reason.
 */
export function ForgetDeviceDialog({ open, onClose }: ForgetDeviceDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const onForget = async () => {
    setBusy(true);
    setError(null);
    try {
      await forgetDevice();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Forget this device?"
      detail="This computer leaves dadi and its setup code is deleted. To bring it back, add it again in Preferences → Devices on your box and paste the new code."
      confirmLabel={busy ? "Forgetting…" : "Forget this device"}
      icon="power"
      pending={busy}
      error={error}
      onCancel={close}
      onConfirm={() => {
        void onForget();
      }}
    />
  );
}
