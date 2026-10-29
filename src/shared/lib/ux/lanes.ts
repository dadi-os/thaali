import type { Lane } from "../../../types/hath";

/**
 * What the UI calls each lane, everywhere a lane is named: the process lane is the
 * agent reading what arrived and answering it, the work lane is it doing the job.
 */
export const LANE_LABEL = {
  process: "processing",
  work: "working",
} as const satisfies Record<Lane, string>;
