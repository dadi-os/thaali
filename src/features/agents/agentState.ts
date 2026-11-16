import type { AgentRecord, AgentRunning } from "../../types/hath";

/** What an agent is doing: its one loop runs, it waits on a helper or another agent, or it rests. */
export type AgentState = "working" | "waiting" | "idle";

/** What the ledger adds to the state, as a fact about the job and never a count: an unanswered ask past its time, or a stopped job. */
export type AgentMark = "overdue" | "stopped";

/** The words each state is shown as. */
export const STATE_LABEL: Record<AgentState, string> = {
  working: "working",
  waiting: "waiting",
  idle: "idle",
};

/** The state of an agent from its `running` block (the live one when given, else the agent's own). */
export function agentState(agent: Pick<AgentRecord, "running">, live?: AgentRunning): AgentState {
  const running = live ?? agent.running;
  if (running.working) {
    return "working";
  }
  return running.waiting_on !== null ? "waiting" : "idle";
}

/** True while the agent's loop runs. */
export function isLive(state: AgentState): boolean {
  return state === "working";
}

/**
 * What the job ledger flags: `stopped` once Ankur stopped the job, `overdue` when the answer-by
 * time passed and nothing has been sent to the requester. Null when there is no job or nothing to flag.
 */
export function agentMark(running: AgentRunning, now: number): AgentMark | null {
  const job = running.job;
  if (job === null) {
    return null;
  }
  if (job.stopped !== null) {
    return "stopped";
  }
  if (job.answer_by !== null && job.told.length === 0 && Date.parse(job.answer_by) < now) {
    return "overdue";
  }
  return null;
}

/** The chips that narrow the agents by what they are doing, and the states each one keeps. */
export const STATE_FILTERS = {
  All: ["working", "waiting", "idle"],
  Working: ["working"],
  Waiting: ["waiting"],
  Idle: ["idle"],
} as const satisfies Record<string, readonly AgentState[]>;

/** The name of one filter chip. */
export type StateFilter = keyof typeof STATE_FILTERS;

/** Whether a filter keeps an agent that is in `state`. */
export function keepsState(filter: StateFilter, state: AgentState): boolean {
  return (STATE_FILTERS[filter] as readonly AgentState[]).includes(state);
}
