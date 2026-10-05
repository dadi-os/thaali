import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";

/** How often the pane is re-captured while it is on screen. */
const CAPTURE_MS = 1_000;
/** Lines captured for the sidebar pin and for the expanded view. */
const LINES = { rail: 14, full: 400 } as const;

export type TerminalScreenProps = {
  /** Nas terminal (tmux session) id. */
  terminalId: string;
  /** Agent's most recent command in it, shown as the prompt line; null when unknown. */
  command: string | null;
  /** `rail` is the compact sidebar pin; `full` fills its parent and scrolls (the expanded view). */
  variant: "rail" | "full";
  /** Extra classes on the screen, e.g. its radius or height. */
  className?: string;
};

/** Subscribe to the webview hiding or showing. */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the webview is visible. */
function visibleSnapshot(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Live, view-only terminal: the tail of the pane from Nas `GET /terminals/:id/capture`,
 * re-captured every second while the mesh is connected and the webview is visible, pinned
 * to the newest line. A failed capture shows Nas's message in place of the output.
 */
export function TerminalScreen({ terminalId, command, variant, className = "" }: TerminalScreenProps) {
  const { state: connection } = useConnection();
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot);
  const live = isMeshOnline(connection) && visible;
  const scrollRef = useRef<HTMLPreElement>(null);

  const capture = useQuery({
    queryKey: ["nas", "terminal-capture", terminalId, variant],
    queryFn: async () => (await nas.captureTerminal(terminalId, LINES[variant])).output.replace(/\s+$/, ""),
    enabled: live,
    refetchInterval: live ? CAPTURE_MS : false,
  });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [capture.data]);

  const trimmed = command?.replace(/\s+/g, " ").trim();

  return (
    <div className={`terminal-screen flex min-h-0 flex-col font-mono ${className}`}>
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1 text-[10.5px]">
        <span className="terminal-screen__prompt shrink-0">$</span>
        <span className="min-w-0 truncate terminal-screen__command" title={trimmed || terminalId}>
          {trimmed || terminalId}
        </span>
      </div>
      <pre
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-hidden px-3 pb-2.5 leading-[1.45] break-all whitespace-pre-wrap ${
          variant === "full" ? "overflow-y-auto text-[12.5px]" : "max-h-[8.5rem] text-[10px]"
        }`}
      >
        {capture.isError ? (
          <span className="terminal-screen__error">{capture.error.message}</span>
        ) : capture.data === undefined ? (
          <span className="terminal-screen__dim">{live ? "Attaching…" : "Paused while hidden"}</span>
        ) : (
          capture.data
        )}
      </pre>
    </div>
  );
}
