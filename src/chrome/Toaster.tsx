import { useSyncExternalStore } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { Toast } from "../shared/components/Toast";
import { openAgent } from "../store/chat";
import { requestDock } from "../store/dock";
import { dismissToast, getToasts, removeToast, subscribeToasts, type ToastTarget } from "../store/toasts";

/** How long a toast stays up after its last push; hovering or focusing it holds the clock. */
const VISIBLE_MS = 6_000;

/**
 * Go where a toast points: its chat in the sidebar, the router dock, or the page for a log line,
 * a device or the timeline. Page targets ride in the URL, so the page focuses them on arrival.
 */
export function openTarget(target: ToastTarget, navigate: NavigateFunction): void {
  switch (target.kind) {
    case "chat":
      openAgent(target.agentId);
      return;
    case "logs":
      navigate(`/system?${new URLSearchParams({ service: target.service, q: target.q, at: target.at })}`);
      return;
    case "ghar":
      navigate(`/ghar?${new URLSearchParams({ device: target.deviceId })}`);
      return;
    case "timeline":
      navigate("/timeline");
      return;
    case "router":
      requestDock();
      return;
  }
}

/** The stack of toasts from the toast store, bottom-right of the window above everything but dialogs, newest last. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  const navigate = useNavigate();
  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: "var(--z-toast)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, pointerEvents: "none" }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: "auto" }}>
          <Toast
            kind={toast.tone}
            title={toast.count > 1 ? `${toast.title} ×${toast.count}` : toast.title}
            body={toast.body}
            leaving={toast.leaving}
            visibleMs={VISIBLE_MS}
            restartKey={toast.at}
            onActivate={() => {
              if (toast.target) {
                openTarget(toast.target, navigate);
              }
              dismissToast(toast.id);
            }}
            onDismiss={() => dismissToast(toast.id)}
            onExpire={() => dismissToast(toast.id)}
            onLeft={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
