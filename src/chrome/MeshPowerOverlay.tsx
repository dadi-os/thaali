import { useState } from "react";
import { motion } from "motion/react";
import { dispatchDesktopShell } from "../store/desktopShell";
import { useConnection } from "../shared/hooks/useConnection";
import { IconPower } from "../shared/components/IconButton";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/**
 * Frosted full-screen power control shown when provisioned but disconnected from dadi.
 * Tap joins the mesh; leave is handled from chrome while connected. Forget this device
 * is always offered, so a device whose code no longer works (a removed device, a moved
 * control URL) can take a fresh setup code without waiting for an error.
 */
export function MeshPowerOverlay() {
  const { state, connect } = useConnection();
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = localBusy || state === "connecting";

  const onPower = async () => {
    if (busy) {
      return;
    }
    setLocalBusy(true);
    setError(null);
    try {
      await connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <motion.div
      className="frost-scrim absolute inset-0 z-50 flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      role="dialog"
      aria-label="Connect to dadi"
    >
      <button
        type="button"
        onClick={() => {
          void onPower();
        }}
        disabled={busy}
        className="group relative flex h-28 w-28 items-center justify-center rounded-full border border-sage-line/80 bg-bone/40 shadow-[var(--shadow-deep)] backdrop-blur-md transition hover:border-sage hover:bg-sage-fill/30 disabled:opacity-70 dark:bg-[#2a2e28]/50"
        aria-label={busy ? "Connecting to dadi" : "Connect to dadi"}
      >
        {busy ? (
          <span
            className="h-10 w-10 animate-spin rounded-full border-2 border-sage/30 border-t-sage"
            aria-hidden
          />
        ) : (
          <span className="size-10 text-sage-deep transition group-hover:text-sage [&_svg]:size-full">
            <IconPower />
          </span>
        )}
      </button>
      <p className="mt-6 text-[12px] font-medium tracking-[2.5px] text-sage-deep">
        {busy ? "CONNECTING…" : "DADI"}
      </p>
      <p className="mt-2 max-w-xs text-center text-[13px] text-ink-muted">
        {busy
          ? "Joining the mesh (TUN + MagicDNS)…"
          : "Tap to connect to dadi system-wide."}
      </p>
      {error ? (
        <p className="mt-3 max-w-sm text-center text-[13px] text-[#b56b5c]">{error}</p>
      ) : null}
      <button
        type="button"
        disabled={localBusy}
        onClick={() => {
          dispatchDesktopShell({ type: "forget_device" });
        }}
        className="mt-5 text-[12px] font-medium tracking-[2px] text-sage-deep disabled:opacity-50"
      >
        FORGET THIS DEVICE
      </button>
    </motion.div>
  );
}
