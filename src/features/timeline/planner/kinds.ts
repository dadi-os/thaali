import type { PlannerKind } from "../../../types/planner";

/** How strongly a block stands out: fixed commitments solid, the gym warm, everything else quiet. */
export type BlockTone = "solid" | "warm" | "quiet";

export const KIND_TONE: Record<PlannerKind, BlockTone> = {
  class: "solid",
  exam: "solid",
  fixed: "solid",
  gym: "warm",
  study: "quiet",
  recruiting: "quiet",
  meal: "quiet",
  shower: "quiet",
  wake: "quiet",
  lights_out: "quiet",
  free: "quiet",
};

/** A block's soft fill by tone; blocks carry no outline. */
export const TONE_CLASS: Record<BlockTone, string> = {
  solid: "bg-sage-active",
  warm: "bg-[color-mix(in_srgb,var(--clay)_15%,transparent)]",
  quiet: "bg-[color-mix(in_srgb,var(--sage)_7%,transparent)]",
};

/** Words for a kind in the block card. */
export const KIND_LABEL: Record<PlannerKind, string> = {
  class: "Class",
  exam: "Exam",
  study: "Study",
  gym: "Gym",
  meal: "Meal",
  shower: "Shower",
  wake: "Wake up",
  lights_out: "Lights out",
  recruiting: "Recruiting",
  free: "Free time",
  fixed: "Fixed event",
};
