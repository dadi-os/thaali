import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { isMeshOnline, nas } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";

/** How often the pane is read again while it is on screen and only watched, and while Ankur types into it. */
const CAPTURE_MS = { watch: 1_000, control: 250 } as const;

/** How a pane is read: `watch` for a preview or an unattended modal, `control` while Ankur types into it. */
export type CaptureCadence = keyof typeof CAPTURE_MS;

/** Subscribes to the webview hiding or showing. */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the webview is visible. */
function visibleSnapshot(): boolean {
  return document.visibilityState === "visible";
}

/**
 * The tail of a Nas terminal's pane, read again every second (every 250 ms under `control`) while the mesh is connected and
 * the webview is visible, so a hidden window or an unmounted view holds no capture on the box. The text has its trailing whitespace cut.
 */
export function useTerminalCapture(terminalId: string, lines: number, cadence: CaptureCadence = "watch") {
  const { state: connection } = useConnection();
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot);
  const live = isMeshOnline(connection) && visible;
  const capture = useQuery({
    queryKey: ["nas", "terminal-capture", terminalId, lines],
    queryFn: async () => (await nas.captureTerminal(terminalId, lines)).output.replace(/\s+$/, ""),
    enabled: live,
    refetchInterval: live ? CAPTURE_MS[cadence] : false,
  });
  return { capture, live };
}
