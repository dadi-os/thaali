import type { AgentRecord, AgentWaiting } from "../../types/hath";
import { LANE_LABEL } from "../../shared/lib/ux/lanes";

/** What an agent is doing: on both lanes, on one, waiting on a helper or another agent, or at rest. */
export type LaneState = "both" | "working" | "processing" | "waiting" | "idle";

/** What the lanes read when the agent has no live lane occupancy of its own. */
type Lanes = { work: boolean; process: boolean };

/** The words each state is shown as. */
export const LANE_STATE_LABEL: Record<LaneState, string> = {
  both: `${LANE_LABEL.work} · ${LANE_LABEL.process}`,
  working: LANE_LABEL.work,
  processing: LANE_LABEL.process,
  waiting: "waiting",
  idle: "idle",
};

/** The state of an agent from its live lanes (the agent's own when none are given) and whether it waits on something. */
export function laneState(agent: AgentRecord, live: Lanes | undefined): LaneState {
  const lanes = live ?? agent.running;
  if (lanes.work && lanes.process) {
    return "both";
  }
  if (lanes.work) {
    return "working";
  }
  if (lanes.process) {
    return "processing";
  }
  return agent.running.waiting_on !== null ? "waiting" : "idle";
}

/** True while a lane is running. */
export function isLive(state: LaneState): boolean {
  return state === "both" || state === "working" || state === "processing";
}

/** The chips that narrow the agents by what they are doing, and the states each one keeps. */
export const LANE_FILTERS = {
  All: ["both", "working", "processing", "waiting", "idle"],
  Working: ["working", "both"],
  Processing: ["processing", "both"],
  Waiting: ["waiting"],
  Idle: ["idle"],
} as const satisfies Record<string, readonly LaneState[]>;

/** The name of one filter chip. */
export type LaneFilter = keyof typeof LANE_FILTERS;

/** Whether a filter keeps an agent that is in `state`. */
export function keepsState(filter: LaneFilter, state: LaneState): boolean {
  return (LANE_FILTERS[filter] as readonly LaneState[]).includes(state);
}

/** What a wait is on in words: `a task`, `an agent` or both, from the addresses it names (`task/...` is a helper task). */
function waitTarget(waiting: AgentWaiting): string {
  const tasks = waiting.targets.some((target) => target.startsWith("task/"));
  const agents = waiting.targets.some((target) => !target.startsWith("task/"));
  return tasks && agents ? "a task and an agent" : agents ? "an agent" : "a task";
}

/** The sentence for an agent's state, as the popover's header and strip say it: `Working`, `Working + Processing`, `Waiting on a task` or `Idle`. */
export function stateSentence(state: LaneState, waiting: AgentWaiting | null): string {
  switch (state) {
    case "both":
      return "Working + Processing";
    case "working":
      return "Working";
    case "processing":
      return "Processing";
    case "waiting":
      return waiting === null ? "Waiting" : `Waiting on ${waitTarget(waiting)}`;
    case "idle":
      return "Idle";
  }
}

/** The ISO time an agent has been in `state` since, as far as Hath says: the start of its wait, the work lane's last step, or its last update. */
export function stateSince(agent: AgentRecord, state: LaneState): string {
  if (state === "waiting") {
    return agent.running.waiting_on?.since ?? agent.updated_at;
  }
  if (state === "idle") {
    return agent.updated_at;
  }
  return agent.running.status?.work.since ?? agent.updated_at;
}
