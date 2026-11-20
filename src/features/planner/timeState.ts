/** The one function that says where a plan stands in time: past, now, next or later. Day, Week, the widget and the popover all read it. */
import type { Plan, Task } from "../../types/planner";
import { startOfDay } from "./dates";
import { agoPhrase, coarse, dayWord, duration, inPhrase, momentPhrase } from "./phrases";
import { formatClock } from "../../shared/lib/ux/time";

/** Where a plan stands against the clock. */
export type TimeState = "past" | "now" | "next" | "later";

/** A plan's start and end as instants; a plan with no end is a moment at its start, and an all-day plan covers its days whole. */
function bounds(plan: Plan): { start: number; end: number } {
  const start = Date.parse(plan.start_at);
  const end = plan.end_at === null ? start : Date.parse(plan.end_at);
  return { start, end };
}

/** The id of the plan that is "next": the earliest timed plan, not declined, that starts later today. Null when none does. */
export function nextPlanId(plans: Plan[], now: Date): string | null {
  const today = startOfDay(now).getTime();
  const upcoming = plans
    .filter((plan) => !plan.all_day && plan.end_at !== null && plan.rsvp !== "no")
    .filter((plan) => {
      const { start } = bounds(plan);
      return start > now.getTime() && startOfDay(new Date(start)).getTime() === today;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  return upcoming[0]?.id ?? null;
}

/**
 * Where `plan` stands: `now` while it is on, `past` once it has ended, `next` when it is `nextId` (see {@link nextPlanId}),
 * otherwise `later`. A declined plan is never now or next, only past or later.
 */
export function timeState(plan: Plan, now: Date, nextId: string | null): TimeState {
  const { start, end } = bounds(plan);
  const at = now.getTime();
  if (end <= at && (plan.end_at !== null || start <= at)) return "past";
  if (start <= at && at < end) return plan.rsvp === "no" ? "later" : "now";
  return plan.id === nextId && plan.rsvp !== "no" ? "next" : "later";
}

/**
 * The status a plan states about itself, as a short labelled phrase: "Now · 12 min left", "Starts in 25 min",
 * "Starts tomorrow 9:00 AM", "Ended 2 h ago", "Ended yesterday". A plan with no end only says when it starts or started.
 */
export function planStatus(plan: Plan, now: Date, state: TimeState): string {
  const { start, end } = bounds(plan);
  const at = now.getTime();
  if (plan.all_day) return "All day";
  if (state === "now") return `Now · ${duration(end - at)} left`;
  if (state === "past") {
    if (plan.end_at === null) return `Started ${agoPhrase(at - start)}`;
    const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(end)).getTime()) / 86_400_000);
    return days >= 1 ? `Ended ${dayWord(new Date(end), now)}` : `Ended ${agoPhrase(at - end)}`;
  }
  const sameDay = startOfDay(new Date(start)).getTime() === startOfDay(now).getTime();
  return sameDay ? `Starts ${inPhrase(start - at)}` : `Starts ${momentPhrase(plan.start_at, now)}`;
}

/** The free minutes between consecutive timed plans of a day that are at least `minMinutes` long, in total; declined plans do not occupy time. */
export function freeBetween(plans: Plan[], minMinutes: number): number {
  const kept = plans.filter((plan) => !plan.all_day && plan.end_at !== null && plan.rsvp !== "no").sort((a, b) => a.start_at.localeCompare(b.start_at));
  let reach = kept[0] === undefined ? 0 : Date.parse(kept[0].end_at!);
  let free = 0;
  for (const plan of kept.slice(1)) {
    const gap = (Date.parse(plan.start_at) - reach) / 60_000;
    if (gap >= minMinutes) free += gap;
    reach = Math.max(reach, Date.parse(plan.end_at!));
  }
  return free * 60_000;
}

/**
 * One true line about a day: how many plans it holds, the free time between them, and the tasks left (with how many are
 * past due). Parts that are zero are left out; an empty day says so.
 */
export function daySummary(plans: Plan[], tasks: { open: number; pastDue: number } | null): string {
  const counted = plans.filter((plan) => plan.rsvp !== "no");
  const parts: string[] = [];
  if (counted.length > 0) parts.push(`${counted.length} ${counted.length === 1 ? "plan" : "plans"}`);
  const free = freeBetween(plans, 30);
  if (free > 0) parts.push(`${duration(free)} free between plans`);
  if (tasks !== null) {
    const left = tasks.open + tasks.pastDue;
    if (left > 0) parts.push(`${left} ${left === 1 ? "task" : "tasks"} to do${tasks.pastDue > 0 ? `, ${tasks.pastDue} past due` : ""}`);
  }
  return parts.length === 0 ? "Nothing planned" : parts.join(" · ");
}

/** The status chip of a task: its tone and a phrase that states the situation. */
export type TaskStatus = { label: string; tone: "done" | "late" | "soon" | "open" | "none" };

/**
 * A task's situation in words: "Done", "Past due by 5 days", "Closes today 11:59 PM · in 3 h", "Closes Fri 11:59 PM · in 2 days",
 * or "No close date".
 */
export function taskStatus(task: Task, now: Date): TaskStatus {
  if (task.done) return { label: "Done", tone: "done" };
  if (task.closes_at === null) return { label: "No close date", tone: "none" };
  const left = Date.parse(task.closes_at) - now.getTime();
  if (left <= 0) return { label: `Past due by ${coarse(left)}`, tone: "late" };
  return { label: `Closes ${momentPhrase(task.closes_at, now)} · ${inPhrase(left)}`, tone: left < 6 * 3_600_000 ? "soon" : "open" };
}

/** The clock time a plan ends at, for a label such as "until 3:30 PM". */
export function untilClock(plan: Plan): string | null {
  return plan.end_at === null ? null : formatClock(plan.end_at);
}

/**
 * One true line about a stretch of days (a week or a month): how many plans it holds and which day is the busiest, with that
 * day's count. An empty stretch says so.
 */
export function periodSummary(plans: Plan[], days: Date[], noun: "week" | "month"): string {
  const counted = plans.filter((plan) => plan.rsvp !== "no" && !plan.all_day);
  if (counted.length === 0) return `Nothing planned this ${noun}`;
  const perDay = days.map((day) => ({ day, n: counted.filter((plan) => startOfDay(new Date(plan.start_at)).getTime() === startOfDay(day).getTime()).length }));
  const busiest = perDay.reduce((best, entry) => (entry.n > best.n ? entry : best), perDay[0]!);
  const name = new Intl.DateTimeFormat(undefined, { weekday: "long", month: noun === "month" ? "short" : undefined, day: noun === "month" ? "numeric" : undefined }).format(busiest.day);
  return `${counted.length} ${counted.length === 1 ? "plan" : "plans"} this ${noun} · busiest ${name} with ${busiest.n}`;
}
