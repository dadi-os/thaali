import type { Lane } from "../../api/types";

/**
 * What the UI calls each lane, everywhere a lane is named: the conversation lane is the
 * agent thinking with you, the reasoning lane is it working in the background.
 */
export const LANE_LABEL = {
  conversation: "thinking",
  reasoning: "working",
} as const satisfies Record<Lane, string>;
