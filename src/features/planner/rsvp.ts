/** RSVP is Yaad's to record through the plan's agent: the app only says it, in Ankur's words, to that agent's chat. */
import type { Plan } from "../../types/planner";
import { formatDay } from "../../shared/lib/ux/time";
import { hasEnded } from "./layout";

/** What Ankur can tell an agent about a plan. */
export type RsvpAnswer = "yes" | "no";

/** The words put in the composer: "I'm going to CSE 300 lecture on Fri, Nov 20" or "I'm not going to … on …". */
export function rsvpMessage(plan: Plan, answer: RsvpAnswer): string {
  return `I’m ${answer === "yes" ? "going to" : "not going to"} ${plan.title} on ${formatDay(plan.start_at)}`;
}

/** Whether the app offers Going / Not going for a plan: an agent keeps it, and it has not ended. */
export function canTell(plan: Plan, hasAgent: boolean, now: Date): boolean {
  return hasAgent && !hasEnded(plan, now);
}

/** The choice that matches the plan's RSVP as Yaad holds it; "" while it holds none, so neither is selected. */
export function rsvpChoice(plan: Plan): RsvpAnswer | "" {
  return plan.rsvp ?? "";
}
