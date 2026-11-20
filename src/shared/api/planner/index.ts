import type { Transport } from "../transport";
import type {
  AttendedRequest,
  AttendedResponse,
  PlansRequest,
  PlansResponse,
  TaskDoneRequest,
  TaskDoneResponse,
  TasksRequest,
  TasksResponse,
} from "../../../types/planner";

/**
 * Yaad planner client: the plans a view shows, the checklist for a day, and Ankur's two hand writes
 * (a task done, a plan attended). Agents write plans and tasks through memory ingest.
 */
export function createPlannerClient(transport: Transport, baseUrl: string) {
  return {
    /** POST /planner/plans — every plan touching `[from, to)`, earliest first; the views filter them in the app. */
    plans(body: PlansRequest): Promise<PlansResponse> {
      return transport.request({ baseUrl, path: "/planner/plans", method: "POST", body });
    },

    /** POST /planner/tasks — a local day's open, past due and done tasks, or the tasks with no window. */
    tasks(body: TasksRequest): Promise<TasksResponse> {
      return transport.request({ baseUrl, path: "/planner/tasks", method: "POST", body });
    },

    /** PUT /planner/tasks/done — tick a task, or take the tick back. */
    setDone(body: TaskDoneRequest): Promise<TaskDoneResponse> {
      return transport.request({ baseUrl, path: "/planner/tasks/done", method: "PUT", body });
    },

    /** PUT /planner/plans/attended — say whether Ankur was at a plan, or clear the answer. */
    setAttended(body: AttendedRequest): Promise<AttendedResponse> {
      return transport.request({ baseUrl, path: "/planner/plans/attended", method: "PUT", body });
    },
  };
}

export type PlannerClient = ReturnType<typeof createPlannerClient>;
