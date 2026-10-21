import type { PlannerKind } from "../../../types/planner";

const tint = (color: string, pct: number) => `bg-[color-mix(in_srgb,var(--${color})_${pct}%,transparent)]`;
const edge = (color: string, pct: number) => `border-[color-mix(in_srgb,var(--${color})_${pct}%,transparent)]`;

/** A block's fill and edge by kind, so what a block is reads without a legend. */
export const KIND_BLOCK: Record<PlannerKind, string> = {
  class: "bg-sage-active border-sage-line",
  exam: "bg-sage-active border-sage",
  study: "bg-sage-fill border-sage-line",
  gym: `${tint("clay", 16)} ${edge("clay", 55)}`,
  meal: "bg-bone-raised border-rule",
  shower: "bg-bone-raised border-rule",
  wake: `${tint("tide", 16)} ${edge("tide", 50)}`,
  lights_out: `${tint("tide", 16)} ${edge("tide", 50)}`,
  recruiting: `${tint("daylight", 70)} ${edge("clay", 40)}`,
  free: "border-dashed border-sage-line",
  fixed: "bg-sage-active border-sage-line",
};

/** The icon badge's tone by kind. */
export const KIND_BADGE: Record<PlannerKind, string> = {
  class: "text-sage-deep border-sage-line",
  exam: "text-sage-deep border-sage-line",
  study: "text-sage-deep border-sage-line",
  gym: `text-[var(--clay)] ${edge("clay", 55)}`,
  meal: "text-sage-deep border-sage-line",
  shower: "text-sage-deep border-sage-line",
  wake: `text-[var(--tide)] ${edge("tide", 50)}`,
  lights_out: `text-[var(--tide)] ${edge("tide", 50)}`,
  recruiting: "text-sage-deep border-sage-line",
  free: "text-sage-deep border-sage-line",
  fixed: "text-sage-deep border-sage-line",
};

/** Free time is hatched, since it is the only time that can give way. */
export const FREE_HATCH = "repeating-linear-gradient(135deg, transparent 0 7px, var(--sage-faint) 7px 8px)";

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
