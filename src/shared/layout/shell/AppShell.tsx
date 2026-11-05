import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { RISE } from "../../motion";
import { ChatSidebar } from "../../../features/chat";
import { TakeoverModal } from "../../../features/agents/takeover";
import { ForgetDeviceDialog } from "../../../features/onboarding/ForgetDevice";
import { OfflinePill } from "./OfflinePill";
import { Onboarding, type BootState } from "../../../features/onboarding";
import { ProvisionOverlay } from "../../../features/onboarding/ProvisionOverlay";
import { TitleBar } from "./TitleBar";
import { useShortcut } from "../../interaction/shortcuts";
import { ContextMenuHost } from "../../overlay/ContextMenuHost";
import { Toaster } from "./Toaster";
import { bootstrapMesh, prepareMesh } from "../../../contexts/connection";
import { useConnection } from "../../hooks/useConnection";
import { useActivityToasts } from "../../../features/chat/useActivityToasts";
import { useDesktopTray } from "../../desktop/useDesktopTray";
import { useEvents } from "../../hooks/useEvents";
import { useLiveQueries } from "../../hooks/useLiveQueries";
import { useDeviceRemote } from "../../desktop/useDeviceRemote";
import { useNeedsProvisioning } from "../../../features/onboarding/useNeedsProvisioning";
import { requestDock } from "../../../contexts/dock";
import { usingMesh } from "../../api";
import { ErrorBoundary } from "../../states/ErrorBoundary";
import { logLine } from "../../lib/log";

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
  const navigate = useNavigate();
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

  useShortcut("mod+k", requestDock);

  useEffect(() => {
    if (needsProvisioning) {
      setBoot((current) => (current.status === "failed" ? { status: "ready" } : current));
    }
  }, [needsProvisioning]);

  const showOnboarding =
    usingMesh &&
    (boot.status !== "ready" || needsProvisioning || state === "disconnected" || state === "connecting");

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "var(--field-bloom)" }}>
      <TitleBar wordmark={!showOnboarding} notice={<OfflinePill />} onHome={() => navigate("/")} />

      <div className="relative flex min-h-0 flex-1">
        <ChatSidebar />

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary key={location.pathname} label={location.pathname === "/" ? "Home" : location.pathname.slice(1)}>
            <motion.div key={location.pathname} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }} {...RISE}>
              <Outlet />
            </motion.div>
          </ErrorBoundary>
        </div>

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
      </div>
      <TakeoverModal />
      <Toaster />
      <ContextMenuHost />
      <ProvisionOverlay
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
      />
      <ForgetDeviceDialog open={forgetOpen} onClose={() => setForgetOpen(false)} />
    </div>
  );
}
