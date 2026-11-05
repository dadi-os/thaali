import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ChatSidebar } from "./chatSidebar";
import { TakeoverModal } from "../features/agents/takeover";
import { ForgetDeviceDialog } from "./ForgetDevice";
import { OfflinePill } from "./OfflinePill";
import { Onboarding, type BootState } from "./onboarding";
import { ProvisionOverlay } from "./ProvisionOverlay";
import { TitleBar } from "./TitleBar";
import { Toaster } from "./Toaster";
import { bootstrapMesh, prepareMesh } from "../store/connection";
import { useConnection } from "../shared/hooks/useConnection";
import { useActivityToasts } from "./useActivityToasts";
import { useDesktopTray } from "./useDesktopTray";
import { useEvents } from "../shared/hooks/useEvents";
import { useLiveQueries } from "../shared/hooks/useLiveQueries";
import { useDeviceRemote } from "./useDeviceRemote";
import { useNeedsProvisioning } from "./useNeedsProvisioning";
import { requestDock } from "../store/dock";
import { usingMesh } from "../shared/api";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import { logLine } from "../shared/lib/log";

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        requestDock();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "var(--field-bloom)" }}>
      <TitleBar wordmark={!showOnboarding} notice={<OfflinePill />} onHome={() => navigate("/")} />

      <div className="relative flex min-h-0 flex-1">
        <ChatSidebar />

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary key={location.pathname} label={location.pathname === "/" ? "Home" : location.pathname.slice(1)}>
            <Outlet />
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
      <ProvisionOverlay
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
      />
      <ForgetDeviceDialog open={forgetOpen} onClose={() => setForgetOpen(false)} />
    </div>
  );
}
