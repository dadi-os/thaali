import type { UseQueryResult } from "@tanstack/react-query";
import { isMeshOnline } from "../api";
import { moduleState, type ModuleState } from "../lib/ux/moduleState";
import { useConnection } from "./useConnection";

/**
 * What a module should show for its query: loading until the first answer, the last answer kept (marked stale when a
 * later request failed), and a state view when there is nothing to show. See {@link moduleState}.
 * @param isEmpty whether an answer holds nothing to show
 */
export function useModuleState<Data>(query: UseQueryResult<Data>, isEmpty: (data: Data) => boolean): ModuleState<Data> {
  const { state } = useConnection();
  return moduleState(query, { connected: isMeshOnline(state), isEmpty });
}
