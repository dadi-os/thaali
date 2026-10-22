import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CHAAVI_URL, GHAR_URL, NAS_URL, YAAD_URL, isMeshOnline, transport } from "../api";
import { logLine } from "../lib/platform/log";
import { pushToast } from "../../store/toasts";
import { useConnection } from "./useConnection";

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
/** Changes that land within this window refetch once, so a burst of writes costs one round trip. */
const COALESCE_MS = 300;

/** A service whose event stream at `path` says "changed", and the React Query keys that hold its data. */
export type LiveSource = {
  name: string;
  baseUrl: string;
  path: string;
  keys: ReadonlyArray<readonly string[]>;
};

const LIVE_SOURCES: readonly LiveSource[] = [
  { name: "yaad", baseUrl: YAAD_URL, path: "/events", keys: [["yaad"], ["planner"]] },
  { name: "chaavi", baseUrl: CHAAVI_URL, path: "/v1/events", keys: [["chaavi"]] },
  { name: "ghar", baseUrl: GHAR_URL, path: "/changes", keys: [["ghar"]] },
  { name: "nas", baseUrl: NAS_URL, path: "/events", keys: [["nas", "browsers"], ["nas", "terminals"]] },
];

/**
 * Follow one service's event stream: every event refetches that service's active
 * queries. The stream has no replay and a suspended phone drops it silently, so each
 * (re)open and each return to a visible window refetches too. A drop toasts and reopens
 * with backoff (doubling up to MAX_BACKOFF_MS, reset once a stream has lived that long).
 */
export function follow(source: LiveSource, queryClient: QueryClient): () => void {
  let stopStream: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let disposed = false;

  const refetch = () => {
    for (const queryKey of source.keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const onChange = () => {
    if (coalesceTimer === null) {
      coalesceTimer = setTimeout(() => {
        coalesceTimer = null;
        refetch();
      }, COALESCE_MS);
    }
  };

  const open = () => {
    stopStream?.();
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    refetch();
    const openedAt = Date.now();
    stopStream = transport.stream({
      baseUrl: source.baseUrl,
      path: source.path,
      onEvent: onChange,
      onClose: () => {
        if (disposed) {
          return;
        }
        if (Date.now() - openedAt > MAX_BACKOFF_MS) {
          backoff = INITIAL_BACKOFF_MS;
        }
        const delay = backoff;
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        const reason = `${source.name} event stream closed; retrying in ${Math.round(delay / 1000)}s`;
        logLine("warn", reason, "live_stream_closed");
        pushToast({
          key: `live_stream:${source.name}`,
          tone: "error",
          title: "Live updates dropped",
          body: reason,
          target: { kind: "logs", service: source.name, q: "", at: new Date().toISOString() },
        });
        reconnectTimer = setTimeout(open, delay);
      },
    });
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      open();
    }
  };

  open();
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisibility);
    stopStream?.();
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
    }
    if (coalesceTimer !== null) {
      clearTimeout(coalesceTimer);
    }
  };
}

/**
 * Keep service data fresh from the services' event streams instead of polling: while the
 * mesh is online, each source in LIVE_SOURCES refetches its queries when its service reports
 * a change. Nas announces only its browser and terminal lists; its status, clients and logs
 * are live readings the System page polls while it is open.
 */
export function useLiveQueries(): void {
  const queryClient = useQueryClient();
  const { state } = useConnection();
  const online = isMeshOnline(state);

  useEffect(() => {
    if (!online) {
      return;
    }
    const stops = LIVE_SOURCES.map((source) => follow(source, queryClient));
    return () => {
      for (const stop of stops) {
        stop();
      }
    };
  }, [online, queryClient]);
}
