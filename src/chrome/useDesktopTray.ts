import { useEffect, useEffectEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { hath, isMeshOnline } from "../shared/api";
import { useConnection } from "../shared/hooks/useConnection";
import { useDesktopUpdate } from "./useDesktopUpdate";
import { AGENTS_QUERY_KEY } from "../shared/hooks/useEvents";
import {
  syncDesktopTray,
  type TrayListState,
  type TraySnapshot,
} from "./tray";
import { logLine } from "../shared/lib/platform/log";
import { openAgent } from "../store/chat";
import { subscribeDesktopShell } from "../store/desktopShell";
import {
  getRunning,
  seedRunningFromAgents,
  subscribeRunning,
  type RunningMap,
} from "../store/running";

/** Background agent roster cadence — patches the menu, never rebuilds it. */
const TRAY_AGENTS_MS = 5_000;

/**
 * Map a React Query result into an explicit tray list state (no silent empty arrays).
 */
function trayListState<T>(query: {
  isError: boolean;
  isSuccess: boolean;
  data: T[] | undefined;
}): TrayListState<T> {
  if (query.isError) {
    return { status: "error" };
  }
  if (query.isSuccess && query.data !== undefined) {
    return { status: "ready", items: query.data };
  }
  return { status: "pending" };
}

/**
 * Own the desktop tray + macOS app menu. No-op in the browser.
 * Routes tray actions into navigation, mesh, and updates.
 * Polls agents in the background; the menu tree stays installed and is patched
 * in place so an open Agents submenu is not dismissed.
 */
export function useDesktopTray(opts: {
  /** Open the provision client modal. */
  onProvision: () => void;
}): void {
  const navigate = useNavigate();
  const { state, disconnect } = useConnection();
  const update = useDesktopUpdate();
  const online = isMeshOnline(state);
  const [running, setRunning] = useState<RunningMap>(() => getRunning());

  const onProvision = useEffectEvent(opts.onProvision);
  const checkUpdate = useEffectEvent(() => {
    void update.check();
  });
  const leaveMesh = useEffectEvent(() => {
    void disconnect();
  });

  const agentsQuery = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const { agents } = await hath.listAgents();
      seedRunningFromAgents(agents);
      return agents;
    },
    enabled: online,
    refetchInterval: TRAY_AGENTS_MS,
  });

  useEffect(() => subscribeRunning(setRunning), []);

  useEffect(() => {
    return subscribeDesktopShell((action) => {
      switch (action.type) {
        case "show_window":
          break;
        case "provision":
          onProvision();
          break;
        case "check_update":
          checkUpdate();
          break;
        case "install_update":
          void update.install();
          break;
        case "leave_mesh":
          leaveMesh();
          break;
        case "navigate":
          navigate(action.path);
          break;
        case "open_agent":
          navigate("/");
          openAgent(action.agentId);
          break;
        case "quit":
          break;
        default: {
          const _exhaustive: never = action;
          void _exhaustive;
        }
      }
    });
  }, [navigate, onProvision, checkUpdate, leaveMesh, update]);

  useEffect(() => {
    const list = trayListState(agentsQuery);
    const agents: TraySnapshot["agents"] =
      list.status === "ready"
        ? {
            status: "ready",
            items: list.items.map((a) => ({
              id: a.id,
              name: a.name,
              active: a.active,
              running: running[a.id] ?? a.running,
            })),
          }
        : online
          ? list
          : { status: "pending" };

    void syncDesktopTray({
      meshConnected: online,
      updateInstalling: update.installing,
      agents,
    }).catch((err) => {
      logLine(
        "error",
        `desktop tray update rejected: ${err instanceof Error ? err.message : String(err)}`,
        "tray_update_rejected",
      );
    });
  }, [
    online,
    update.installing,
    agentsQuery.data,
    agentsQuery.isError,
    agentsQuery.isSuccess,
    running,
  ]);
}
