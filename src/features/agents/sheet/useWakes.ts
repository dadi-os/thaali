import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { hath } from "../../../shared/api";
import { wakeKey, wakesKey } from "../../../shared/hooks/useEvents";
import type { WakeCursor } from "../../../types/hath";

/** How many wakes one page of the timeline reads. */
const WAKES_PAGE = 20;

/**
 * An agent's wakes, newest first, a page at a time; `fetchNextPage` reads the page before the last one held. Hath's wake events
 * refetch it (see `useEvents`), so it needs no polling.
 */
export function useWakeList(agentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: wakesKey(agentId),
    queryFn: ({ pageParam }) => hath.listWakes(agentId, { limit: WAKES_PAGE, ...(pageParam === null ? {} : { before: pageParam }) }),
    initialPageParam: null as WakeCursor | null,
    getNextPageParam: (page) => page.next_before,
    enabled,
  });
}

/** One wake with its entries; read while `wakeId` is given, and refetched by Hath's wake events. */
export function useWake(agentId: string, wakeId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: wakeKey(agentId, wakeId ?? ""),
    queryFn: () => hath.getWake(agentId, wakeId!),
    enabled: enabled && wakeId !== null,
  });
}
