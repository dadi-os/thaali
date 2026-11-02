import type { AgentRecord } from "../../types/hath";
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
