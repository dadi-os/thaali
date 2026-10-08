import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { IconDismiss } from "../shared/components/IconButton";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";
import { openAgent } from "../store/chat";
import { dismissToast, getToasts, subscribeToasts, type Toast, type ToastTarget } from "../store/toasts";

/** How long a toast stays up after its last push, by tone; hovering holds it. */
const VISIBLE_MS: Record<Toast["tone"], number> = { info: 6_000, error: 12_000 };

/**
 * Go where a toast points: its chat in the sidebar, or the page for a log line, a device
 * or the timeline. Page targets ride in the URL, so the page focuses them on arrival.
 */
function openTarget(target: ToastTarget, navigate: NavigateFunction): void {
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
  }
}

/** Bottom-right stack of toasts from the toast store, newest at the bottom. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none absolute right-4 bottom-4 z-[55] flex w-[300px] max-w-[calc(100%-2rem)] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * One glass toast: title, a two-line body and a repeat count. It leaves on its own
 * VISIBLE_MS after its last push unless the pointer is on it; clicking it goes to its
 * target and puts it away.
 */
function ToastCard({ toast }: { toast: Toast }) {
  const [held, setHeld] = useState(false);
  const error = toast.tone === "error";
  const { target } = toast;
  const navigate = useNavigate();

  useEffect(() => {
    if (held) {
      return;
    }
    const timer = window.setTimeout(() => dismissToast(toast.id), VISIBLE_MS[toast.tone]);
    return () => window.clearTimeout(timer);
  }, [held, toast.id, toast.tone, toast.at]);

  const text = (
    <>
      <span className={`flex items-baseline gap-1.5 text-[12.5px] font-medium ${error ? "text-error" : "text-ink"}`}>
        <span className="min-w-0 truncate">{toast.title}</span>
        {toast.count > 1 ? (
          <span className="shrink-0 text-[11px] font-normal tabular-nums text-ink-ghost">×{toast.count}</span>
        ) : null}
      </span>
      {toast.body ? (
        <span className="line-clamp-2 text-[12px] leading-snug text-ink-muted [overflow-wrap:anywhere]">
          {toast.body}
        </span>
      ) : null}
    </>
  );
  const textClass = "flex min-w-0 flex-1 flex-col gap-0.5 py-2 pl-3 text-left";

  return (
    <motion.div
      layout
      role={error ? "alert" : "status"}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: SLOW_S, ease: EASE } }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      className={`pane-bubble pointer-events-auto flex items-start gap-1 rounded-[14px] pr-1 ${
        error ? "pane-bubble--error" : ""
      }`}
    >
      {target ? (
        <button
          type="button"
          onClick={() => {
            openTarget(target, navigate);
            dismissToast(toast.id);
          }}
          className={`${textClass} rounded-l-[13px]`}
        >
          {text}
        </button>
      ) : (
        <div className={textClass}>{text}</div>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(toast.id)}
        className="mt-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-ghost transition-colors duration-fast ease-dadi hover:bg-sage-fill hover:text-ink-muted [&_svg]:size-3"
      >
        <IconDismiss />
      </button>
    </motion.div>
  );
}
