import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChatSidebar } from "./chatSidebar";
import { ForgetDeviceDialog } from "./ForgetDevice";
import { Header } from "./Header";
import { OfflinePill } from "./OfflinePill";
import { Onboarding, type BootState } from "./onboarding";
import { ProvisionOverlay } from "./ProvisionOverlay";
import { Toaster } from "./Toaster";
import { bootstrapMesh, prepareMesh } from "../store/connection";
import { useConnection } from "../shared/hooks/useConnection";
import { useActivityToasts } from "./useActivityToasts";
import { useDesktopTray } from "./useDesktopTray";
import { useEvents } from "../shared/hooks/useEvents";
import { useLiveQueries } from "../shared/hooks/useLiveQueries";
import { useDeviceRemote } from "./useDeviceRemote";
import { useNeedsProvisioning } from "./useNeedsProvisioning";
import { usingMesh } from "../shared/api";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";
import { ErrorBoundary } from "../shared/components/states";
import { logLine } from "../shared/lib/platform/log";

/** Settles launch's read of the saved setup code into a boot state. */
function settleBoot(run: Promise<void>, set: (boot: BootState) => void): void {
  run.then(
    () => set({ status: "ready" }),
    (err: unknown) => {
      const error = err instanceof Error ? err.message : String(err);
      logLine("error", `mesh bootstrap failed: ${error}`, "mesh_bootstrap_failed");
      set({ status: "failed", error });
    },
  );
}

/**
 * Persistent chrome. Desktop: short title bar + chat rail + widget outlet.
 * Until this device is on dadi (launch, first run, off, joining, failed) onboarding covers
 * the rail and the outlet under the title bar.
 */
export function AppShell() {
  const { state } = useConnection();
  const location = useLocation();
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const needsProvisioning = useNeedsProvisioning();
  const [boot, setBoot] = useState<BootState>({ status: usingMesh ? "pending" : "ready" });

  useEvents();
  useLiveQueries();
  useActivityToasts();
  useDeviceRemote();
  useDesktopTray({
    onProvision: () => {
      setProvisionOpen(true);
    },
    onForget: () => {
      setForgetOpen(true);
    },
  });

  useEffect(() => {
    settleBoot(bootstrapMesh(), setBoot);
  }, []);

  useEffect(() => {
    if (needsProvisioning) {
      setBoot((current) => (current.status === "failed" ? { status: "ready" } : current));
    }
  }, [needsProvisioning]);

  const showOnboarding =
    usingMesh &&
    (boot.status !== "ready" || needsProvisioning || state === "disconnected" || state === "connecting");

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-transparent">
      <motion.div
        className="glass-veil relative z-[60] border-b-0 shadow-[var(--shadow)]"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: SLOW_S, ease: EASE }}
      >
        <Header wordmark={!showOnboarding} />
      </motion.div>

      <div className="relative flex min-h-0 flex-1">
        <motion.div
          className="w-[min(300px,32%)] shrink-0"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: SLOW_S, ease: EASE, delay: 0.12 }}
        >
          <ChatSidebar className="h-full" />
        </motion.div>

        <motion.main
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: SLOW_S, ease: EASE, delay: 0.2 }}
        >
          <OfflinePill />
          <div className="h-full min-h-0 overflow-hidden">
            <div
              key={location.pathname}
              className="h-full min-h-0 overflow-hidden"
            >
              <ErrorBoundary label={location.pathname === "/" ? "Home" : location.pathname.slice(1)}>
                <Outlet />
              </ErrorBoundary>
            </div>
          </div>
        </motion.main>

        <AnimatePresence>
          {showOnboarding ? (
            <Onboarding
              key="onboarding"
              boot={boot}
              onRetryBoot={() => {
                setBoot({ status: "pending" });
                settleBoot(prepareMesh(), setBoot);
              }}
            />
          ) : null}
        </AnimatePresence>
        <Toaster />
      </div>
      <ProvisionOverlay
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
      />
      <ForgetDeviceDialog open={forgetOpen} onClose={() => setForgetOpen(false)} />
    </div>
  );
}
