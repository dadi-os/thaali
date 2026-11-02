import type { UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "../../api/errors";

/** Statuses a gateway answers when the module behind it is down. */
const MODULE_DOWN = new Set([502, 503, 504]);

/**
 * What a module shows. `loading`: the first answer is on its way. `offline`: the mesh is down and nothing was
 * ever answered. `module-offline`: the module's own service is down. `error`: the request failed. `empty`: a real
 * answer with nothing in it. `ready`: content, with `stale` set when a later request failed and the content is
 * the last answer kept.
 */
export type ModuleState<Data> =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "module-offline"; error: ApiError }
  | { kind: "error"; error: unknown }
  | { kind: "empty" }
  | { kind: "ready"; data: Data; stale: { since: number } | null };

export type ModuleStateOptions<Data> = {
  /** Whether the mesh to dadi is usable; while it is down the title-bar pill is the one notice. */
  connected: boolean;
  /** Whether an answer holds nothing to show. */
  isEmpty: (data: Data) => boolean;
};

/**
 * Maps a query to the one thing its module should show. A request that fails while an answer is kept shows that
 * answer with a stale marker; a mesh that drops never replaces an answer with a notice of its own.
 */
export function moduleState<Data>(query: UseQueryResult<Data>, { connected, isEmpty }: ModuleStateOptions<Data>): ModuleState<Data> {
  if (query.data !== undefined) {
    if (isEmpty(query.data)) {
      return { kind: "empty" };
    }
    return { kind: "ready", data: query.data, stale: query.isError ? { since: query.dataUpdatedAt } : null };
  }
  if (query.isError) {
    return query.error instanceof ApiError && MODULE_DOWN.has(query.error.status)
      ? { kind: "module-offline", error: query.error }
      : { kind: "error", error: query.error };
  }
  return connected ? { kind: "loading" } : { kind: "offline" };
}
