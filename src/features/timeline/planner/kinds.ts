import type { PlanKind } from "../../../types/timeline";

/** How strongly a session stands out: commitments solid, the gym warm, everything else quiet. */
export type BlockTone = "solid" | "warm" | "quiet";

/** Tone per kind; a session of no kind draws as a commitment. */
export const KIND_TONE: Record<PlanKind, BlockTone> = {
  class: "solid",
  lab: "solid",
  exam: "solid",
  task: "solid",
  meeting: "solid",
  appointment: "solid",
  reservation: "solid",
  social: "solid",
  trip: "solid",
  bill: "solid",
  gym: "warm",
  study: "quiet",
  focus: "quiet",
  meal: "quiet",
  shower: "quiet",
};

/** A session's soft fill by tone; sessions carry no outline. */
export const TONE_CLASS: Record<BlockTone, string> = {
  solid: "bg-sage-active",
  warm: "bg-[color-mix(in_srgb,var(--clay)_15%,transparent)]",
  quiet: "bg-[color-mix(in_srgb,var(--sage)_7%,transparent)]",
};

/** Words for a kind in the session card. */
export const KIND_LABEL: Record<PlanKind, string> = {
  class: "Class",
  lab: "Lab",
  exam: "Exam",
  task: "Task",
  meeting: "Meeting",
  appointment: "Appointment",
  reservation: "Reservation",
  social: "Social",
  trip: "Trip",
  bill: "Bill",
  gym: "Gym",
  study: "Study",
  focus: "Focus",
  meal: "Meal",
  shower: "Shower",
};
