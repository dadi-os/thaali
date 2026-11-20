/** Plan helpers shared by the Planner's Day, Week, Month and widget. */
import type { AgentRecord } from "../../types/hath";
import type { Plan } from "../../types/planner";
import { endOfDay, startOfDay } from "./dates";

/** Owners that are a source, not an agent: nothing to message. */
const SOURCES = new Set(["manual", "ingest"]);

/** The agent id named by `owner`, or null when it is a source (`manual`, `ingest`) that no agent keeps. */
export function keptBy(owner: string): string | null {
  return SOURCES.has(owner) ? null : owner;
}

/**
 * The active agent that keeps something: its `owner` when that names an agent still running. Null for
 * a source (`manual`, `ingest`) and for an agent that has retired; `agents` is Hath's list, absent until it loads.
 */
export function ownerAgent(owner: string, agents: AgentRecord[] | undefined): AgentRecord | null {
  if (SOURCES.has(owner)) {
    return null;
  }
  return agents?.find((agent) => agent.active && (agent.id === owner || agent.name === owner)) ?? null;
}

/** A plan's start and end; a plan with no end is a moment. An all-day plan covers its first day through its last. */
export function spanOf(plan: Plan): { start: Date; end: Date } {
  const start = new Date(plan.start_at);
  const end = plan.end_at === null ? start : new Date(plan.end_at);
  return plan.all_day ? { start: startOfDay(start), end: endOfDay(end) } : { start, end };
}

/** True when any part of the plan falls on `day`, so a multi-day plan shows on each of its days. */
export function planOverlapsDay(plan: Plan, day: Date): boolean {
  const { start, end } = spanOf(plan);
  return start.getTime() <= endOfDay(day).getTime() && end.getTime() >= startOfDay(day).getTime();
}

/** True when the plan runs past the end of the day it starts on. */
export function isMultiDay(plan: Plan): boolean {
  const { start, end } = spanOf(plan);
  return end.getTime() > endOfDay(start).getTime();
}

/** True when the plan draws in the span row along the top of its days rather than on the time axis. */
export function runsAsBar(plan: Plan): boolean {
  return plan.all_day || isMultiDay(plan);
}

/** Plans on `day`, earliest first. */
export function plansOn(plans: Plan[], day: Date): Plan[] {
  return plans.filter((plan) => planOverlapsDay(plan, day)).sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/** The first and last of `days` (indexes) a bar plan covers, or null when it touches none of them. */
export function barColumns(plan: Plan, days: Date[]): { from: number; to: number } | null {
  const columns = days.flatMap((day, index) => (planOverlapsDay(plan, day) ? [index] : []));
  return columns.length === 0 ? null : { from: columns[0]!, to: columns[columns.length - 1]! };
}

/**
 * Bar plans touching `days`, stacked into lanes, earliest first: plans in one lane share no shown day,
 * so each lane draws as one row of bars.
 */
export function spanLanes(plans: Plan[], days: Date[]): Plan[][] {
  const lanes: Plan[][] = [];
  const bars = plans.filter((plan) => runsAsBar(plan) && barColumns(plan, days) !== null).sort((a, b) => a.start_at.localeCompare(b.start_at));
  for (const plan of bars) {
    const mine = barColumns(plan, days)!;
    const lane = lanes.find((l) =>
      l.every((other) => {
        const theirs = barColumns(other, days)!;
        return theirs.to < mine.from || theirs.from > mine.to;
      }),
    );
    if (lane) {
      lane.push(plan);
    } else {
      lanes.push([plan]);
    }
  }
  return lanes;
}

/** One month tile's plans: the first `limit` and how many more there are. */
export function monthTile(plans: Plan[], day: Date, limit: number): { shown: Plan[]; more: number } {
  const own = plansOn(plans, day).sort((a, b) => Number(runsAsBar(b)) - Number(runsAsBar(a)));
  return { shown: own.slice(0, limit), more: Math.max(0, own.length - limit) };
}

/** True when `plan` is the one on at `now`. */
export function isCurrent(plan: Plan, now: Date): boolean {
  const { start, end } = spanOf(plan);
  return !plan.all_day && plan.end_at !== null && start.getTime() <= now.getTime() && now.getTime() < end.getTime();
}

/** The dot colour of a plan: muted when declined, the course tone when it belongs to a course, sage otherwise. */
export function planTone(plan: Plan): string {
  if (plan.rsvp === "no") {
    return "var(--ink-faint)";
  }
  return plan.hub === null ? "var(--sage)" : "var(--tide)";
}

/** What Ankur said about a plan that has ended: "Attended", "Didn't attend", or null while he has not said. */
export function attendedLabel(plan: Plan): string | null {
  return plan.attended === null ? null : plan.attended ? "Attended" : "Didn't attend";
}

/** Whether a bar plan continues before `day` and after it, so its bar draws open ended on those sides. */
export function barEdges(plan: Plan, day: Date): { before: boolean; after: boolean } {
  const { start, end } = spanOf(plan);
  return { before: start.getTime() < startOfDay(day).getTime(), after: end.getTime() > endOfDay(day).getTime() };
}

/** A multi-day plan's span in words ("Sat, Nov 14 – Sun, Nov 15"), or null for a plan inside one day. */
export function spanRange(plan: Plan): string | null {
  const { start, end } = spanOf(plan);
  if (end.getTime() <= endOfDay(start).getTime()) return null;
  const month = new Intl.DateTimeFormat(undefined, { month: "short" });
  const sameMonth = start.getMonth() === end.getMonth();
  return `${month.format(start)} ${start.getDate()} – ${sameMonth ? "" : `${month.format(end)} `}${end.getDate()}`;
}

/** The fill, border and ink of an all-day bar: course tide, otherwise sage, muted and dashed when declined. */
export function barLook(plan: Plan): { background: string; border: string; color: string } {
  if (plan.rsvp === "no") return { background: "var(--bone)", border: "1px dashed var(--ink-ghost)", color: "var(--ink-muted)" };
  return plan.hub === null
    ? { background: "var(--sage-active)", border: "1px solid var(--sage-line)", color: "var(--sage-text)" }
    : { background: "var(--tide-fill)", border: "1px solid var(--tide-line)", color: "var(--tide-ink)" };
}

/** The plans the time grid draws: timed, with a start and an end (a plan that runs past midnight is clipped to each day by the grid). */
export function gridPlans(plans: Plan[]): Plan[] {
  return plans.filter((plan) => !plan.all_day && plan.end_at !== null);
}

/** The plans the all-day band draws: all-day plans and plans that run past a day. */
export function bandPlans(plans: Plan[]): Plan[] {
  return plans.filter((plan) => runsAsBar(plan));
}

/** The plans Month lists: everything, each tile showing its first few and "+N more". */
export function monthPlans(plans: Plan[]): Plan[] {
  return plans;
}

/** The plans with a day and nothing to draw on an axis: no end, and not all day. They wait in the Someday sheet. */
export function loosePlans(plans: Plan[]): Plan[] {
  return plans.filter((plan) => plan.end_at === null && !plan.all_day).sort((a, b) => a.start_at.localeCompare(b.start_at));
}
