import type { AgentStatus } from "../../types/hath";
import { formatClock } from "../../shared/lib/ux/time";

/** One tool call line of the status block. */
export type StatusCall = { text: string; mark: "ok" | "error" | "running" };

/** The status block as lines of text, ready to render. */
export type StatusView = {
  /** Who asked and when, with the clipped request; null when no job is open. */
  job: string | null;
  /** Whether work is running, waiting (on what, since when) or idle. */
  work: string;
  step: string | null;
  recent: StatusCall[];
  /** The helper tasks in flight, one line each. */
  tasks: string[];
  /** Plain words when Nas could not be read for the tasks; null otherwise. */
  tasksUnreadable: string | null;
  /** Messages work queued and process has not sent, one line each. */
  pending: string[];
};

/**
 * Maps hath's status to the lines the popover shows. Null in, null out: hath sends no status
 * when no lane runs and work is not waiting, and the popover then shows nothing.
 * `nameOf` turns an agent id into its name.
 */
export function statusView(status: AgentStatus | null, nameOf: (agentId: string) => string): StatusView | null {
  if (status === null) {
    return null;
  }
  const who = (id: string | null) => (id === null ? "Ankur" : nameOf(id));
  const { work } = status;
  return {
    job: status.job === null ? null : `${who(status.job.from)} asked at ${formatClock(status.job.at)}: ${status.job.content}`,
    work:
      work.state === "waiting"
        ? `Waiting on ${work.waiting_on.join(", ")}${work.since === null ? "" : ` since ${formatClock(work.since)}`}`
        : work.state === "running"
          ? `Working${work.since === null ? "" : `, last step ${formatClock(work.since)}`}`
          : "Idle",
    step: status.step,
    recent: status.recent.map((call) => ({
      text: call.arg === "" ? call.name : `${call.name} ${call.arg}`,
      mark: call.ok === null ? "running" : call.ok ? "ok" : "error",
    })),
    tasks: status.tasks.map((task) => `${task.id} · ${task.status} · ${task.current}`),
    tasksUnreadable: status.tasks_unreadable === null ? null : `Helper tasks could not be read: ${status.tasks_unreadable}`,
    pending: status.pending.map(
      (row) => `To ${who(row.to)}${row.expects_reply ? " (expects a reply)" : ""}: ${row.preview}`,
    ),
  };
}
