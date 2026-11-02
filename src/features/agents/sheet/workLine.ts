import type { AgentRecord } from "../../../types/hath";
import { formatClock, formatRelative } from "../../../shared/lib/ux/time";

/** ` since 10:20 AM`, or nothing when Hath gave no time. */
function since(iso: string | null): string {
  return iso === null ? "" : ` since ${formatClock(iso)}`;
}

/**
 * What the agent is doing now, in one sentence, for the sheet's "Right now" card: from Hath's status block while a lane runs or
 * the work lane waits, from the wait itself when it is only waiting, and as idle with its last activity otherwise.
 */
export function workLine(agent: Pick<AgentRecord, "running" | "updated_at">, now: number): string {
  const { status, waiting_on: waiting } = agent.running;
  if (status === null) {
    return waiting === null ? `Idle · last active ${formatRelative(agent.updated_at, now)}` : `Waiting on ${waiting.targets.join(", ")}${since(waiting.since)}`;
  }
  const { work } = status;
  if (work.state === "waiting") {
    return `Waiting on ${work.waiting_on.join(", ")}${since(work.since)}`;
  }
  if (work.state === "running") {
    return `Working${work.since === null ? "" : `, last step ${formatClock(work.since)}`}`;
  }
  return "Idle";
}
