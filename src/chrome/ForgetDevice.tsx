import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { forgetDevice } from "../store/connection";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

export interface ForgetDeviceDialogProps {
  /** Whether the confirmation is showing. */
  open: boolean;
  /** Dismiss without forgetting (Cancel, Escape, the backdrop). */
  onClose: () => void;
}

/**
 * Confirmation before Forget this device: a glass card over the frosted window. Forgetting
 * takes this computer off dadi and deletes its setup code, and onboarding then asks for a
 * new one; a failure stays on the card with its reason.
 */
export function ForgetDeviceDialog({ open, onClose }: ForgetDeviceDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) {
      return;
    }
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
    <AnimatePresence>
      {open ? (
        <motion.div
          className="frost-scrim absolute inset-0 z-[80] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: SLOW_S, ease: EASE }}
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              close();
            }
          }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="forget-device-title"
            className="glass-card flex w-full max-w-[26rem] flex-col items-center gap-4 px-8 py-7 text-center"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", duration: 0.32, bounce: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="forget-device-title" className="m-0 text-[19px] font-semibold text-ink">
              Forget this device?
            </h2>
            <p className="m-0 text-[14px] leading-relaxed text-ink-muted">
              This computer leaves dadi and its setup code is deleted. To bring it back, add it
              again in Preferences → Devices on your box and paste the new code.
            </p>
            {error ? (
              <p role="alert" className="m-0 select-text text-[13px] leading-relaxed text-error">
                {error}
              </p>
            ) : null}
            <div className="mt-1 flex items-center gap-3">
              <button type="button" autoFocus className="glass-button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="glass-button glass-button--danger"
                disabled={busy}
                onClick={() => {
                  void onForget();
                }}
              >
                {busy ? "Forgetting…" : "Forget this device"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
