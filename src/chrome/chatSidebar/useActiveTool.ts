import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";
import { formatToolSignature } from "../../shared/lib/content/toolSignature";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { findActiveTool } from "./toolStatus";

/** Tool in flight for the lane chip, or the log poll's failure. */
export type ActiveToolState = {
  /** `name(args)` of the tool running now; null when none is. */
  signature: string | null;
  /** Server message from a failed log poll. */
  error: string | null;
};

/**
 * Poll an agent's logs while one of its lanes runs and report the tool it is in the
 * middle of. Idle (no polling) when `agentId` is null or `active` is false.
 */
export function useActiveTool(agentId: string | null, active: boolean): ActiveToolState {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const logsQuery = useQuery({
    queryKey: ["agent-logs", agentId, "tool-preview"],
    queryFn: async () => {
      const { logs } = await hath.getAgentLogs(agentId!, { limit: 48 });
      return logs;
    },
    enabled: connected && active && agentId !== null,
    refetchInterval: active ? POLL_MS : false,
  });

  const signature = useMemo(() => {
    if (!active || !logsQuery.data) {
      return null;
    }
    const tool = findActiveTool(logsQuery.data);
    return tool ? formatToolSignature(tool.name, tool.input) : null;
  }, [active, logsQuery.data]);

  return {
    signature,
    error: active && logsQuery.isError ? logsQuery.error.message : null,
  };
}
