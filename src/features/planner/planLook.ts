import type { Plan } from "../../types/planner";
import type { TimeState } from "./timeState";

/** How a plan reads at a glance: which of the six looks its answer and its place in time give it. */
export type PlanLookKind = "attended" | "missed" | "declined" | "past" | "now" | "upcoming";

/** The look {@link planLook} picks: CSS color values for a block's fill and border, and the words that go with them. */
export type PlanLook = {
  kind: PlanLookKind;
  /** The fill, a CSS color. */
  fill: string;
  /** The border, a CSS color. */
  border: string;
  /** Whether the border is dashed. */
  dashed: boolean;
  /** Whether the title is struck through. */
  struck: boolean;
  /** Whether the block is raised on a shadow. */
  raised: boolean;
  /** The caption a block with room carries, or null. */
  caption: "Attended" | "Didn’t attend" | "Declined" | null;
};

const LOOKS: Record<PlanLookKind, Omit<PlanLook, "kind" | "caption">> = {
  attended: { fill: "var(--slab-attended)", border: "var(--slab-attended-border)", dashed: false, struck: false, raised: false },
  missed: { fill: "var(--slab-declined)", border: "var(--ink-faint)", dashed: true, struck: true, raised: false },
  declined: { fill: "var(--slab-declined)", border: "var(--slab-declined-border)", dashed: true, struck: false, raised: false },
  past: { fill: "var(--slab-past)", border: "var(--slab-border)", dashed: false, struck: false, raised: false },
  now: { fill: "var(--slab)", border: "var(--slab-now-border)", dashed: false, struck: false, raised: true },
  upcoming: { fill: "var(--slab)", border: "var(--slab-border)", dashed: false, struck: false, raised: true },
};

/**
 * The look of a plan's block from what is said of it and where it stands in time. Declined beats everything; an attended plan is a
 * solid sage-tinted block with a firm border and the caption "Attended"; one marked not attended is dashed and struck; a past plan
 * nobody answered is a quiet block; the rest follow the clock.
 */
export function planLook(plan: Pick<Plan, "rsvp" | "attended">, state: TimeState): PlanLook {
  const kind: PlanLookKind =
    plan.rsvp === "no" ? "declined" : plan.attended === true ? "attended" : plan.attended === false ? "missed" : state === "now" ? "now" : state === "past" ? "past" : "upcoming";
  const caption = kind === "attended" ? "Attended" : kind === "missed" ? "Didn’t attend" : kind === "declined" ? "Declined" : null;
  return { kind, ...LOOKS[kind], caption };
}
