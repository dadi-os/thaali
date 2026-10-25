import type { Transport } from "../transport";
import type { OutcomeRequest, OutcomeResponse, TimelineRequest, TimelineResponse } from "../../../types/timeline";

/**
 * Yaad timeline client: views over plans, and the Completed toggle. Agents write the
 * timeline through memory ingest; this is the only thing the app writes to it.
 */
export function createTimelineClient(transport: Transport, baseUrl: string) {
  return {
    /** POST /timeline — sessions in `[from, to)` through one view, earliest first. */
    query(body: TimelineRequest): Promise<TimelineResponse> {
      return transport.request({ baseUrl, path: "/timeline", method: "POST", body });
    },

    /** PUT /timeline/outcome — mark one session completed, or take the mark back. */
    setOutcome(body: OutcomeRequest): Promise<OutcomeResponse> {
      return transport.request({ baseUrl, path: "/timeline/outcome", method: "PUT", body });
    },
  };
}

export type TimelineClient = ReturnType<typeof createTimelineClient>;
