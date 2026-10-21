import type { Transport } from "../transport";
import type { PlannerBlock, PlannerQueryRequest, PlannerQueryResponse } from "../../../types/planner";

/**
 * Yaad planner client: the blocks of the day plan. The page reads blocks and marks one done;
 * agents write the plan through Hath's planner tools.
 */
export function createPlannerClient(transport: Transport, baseUrl: string) {
  return {
    /** POST /planner/query — blocks overlapping `[from, to)`, earliest first. */
    query(body: PlannerQueryRequest): Promise<PlannerQueryResponse> {
      return transport.request({ baseUrl, path: "/planner/query", method: "POST", body });
    },

    /** PATCH /planner/blocks/:id — mark a block done or open again. */
    setDone(id: string, done: boolean): Promise<PlannerBlock> {
      return transport.request({ baseUrl, path: `/planner/blocks/${id}`, method: "PATCH", body: { done } });
    },
  };
}

export type PlannerClient = ReturnType<typeof createPlannerClient>;
