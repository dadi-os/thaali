/** Planner widget logic: which of today's plans fit the tile, and the window it follows when they do not. */
import type { Plan } from "../../types/planner";
import { endOfDay, startOfDay } from "./dates";
import { isCurrent, spanOf } from "./plans";

/** Row heights in px; the widget fits rows to the room it is given with these. */
export const ROW = { plan: 56, current: 64, free: 28, chip: 24, gap: 2 } as const;

/** The least gap between two plans the widget names as free time, in minutes. */
export const FREE_MIN = 15;

/** One line of the widget: a plan, or the free time between two plans. */
export type WidgetRow = { kind: "plan"; plan: Plan; current: boolean } | { kind: "free"; minutes: number };

/** What the widget draws, and how many plans fall outside the window it shows. */
export type Windowed = { rows: WidgetRow[]; earlier: number; later: number };

/** Today's plans the widget shows: timed, with a start and an end, overlapping `day`, earliest first. */
export function tilePlans(plans: Plan[], day: Date): Plan[] {
  const from = startOfDay(day).getTime();
  const to = endOfDay(day).getTime();
  return plans
    .filter((plan) => {
      if (plan.all_day || plan.end_at === null) return false;
      const { start, end } = spanOf(plan);
      return start.getTime() <= to && end.getTime() > from;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/** The plans and the free stretches between those not declined, in time order. */
export function sequence(plans: Plan[], now: Date): WidgetRow[] {
  const entries: Array<{ at: number; row: WidgetRow }> = plans.map((plan) => ({
    at: spanOf(plan).start.getTime(),
    row: { kind: "plan", plan, current: isCurrent(plan, now) },
  }));
  const kept = plans.filter((plan) => plan.rsvp !== "no");
  let reach = kept[0] === undefined ? 0 : spanOf(kept[0]).end.getTime();
  for (const plan of kept.slice(1)) {
    const { start, end } = spanOf(plan);
    const minutes = Math.round((start.getTime() - reach) / 60_000);
    if (minutes >= FREE_MIN) entries.push({ at: reach, row: { kind: "free", minutes } });
    reach = Math.max(reach, end.getTime());
  }
  return entries.sort((a, b) => a.at - b.at).map((entry) => entry.row);
}

function heightOf(row: WidgetRow): number {
  return row.kind === "free" ? ROW.free : row.current ? ROW.current : ROW.plan;
}

function stack(rows: WidgetRow[]): number {
  return rows.reduce((sum, row) => sum + heightOf(row), 0) + Math.max(0, rows.length - 1) * ROW.gap;
}

function planCount(rows: WidgetRow[]): number {
  return rows.filter((row) => row.kind === "plan").length;
}

/** The row the window grows from: the plan on now, else the next plan, else the last one. */
function anchorOf(rows: WidgetRow[], now: Date): number {
  const current = rows.findIndex((row) => row.kind === "plan" && row.current);
  if (current >= 0) return current;
  const next = rows.findIndex((row) => row.kind === "plan" && spanOf(row.plan).end.getTime() > now.getTime());
  if (next >= 0) return next;
  return rows.length - 1;
}

/**
 * The rows of today that fit `capacity` px. When they all fit, every row. Otherwise a window that grows from
 * the plan on now (or the next one, or the last once the day is over), taking the row after it, then the one
 * before, alternately while they fit with their "earlier" and "later" chips; free time at an edge is dropped.
 */
export function windowRows(plans: Plan[], now: Date, capacity: number): Windowed {
  const rows = sequence(plans, now);
  if (rows.length === 0 || stack(rows) <= capacity) return { rows, earlier: 0, later: 0 };
  const fits = (a: number, b: number) => {
    const chips = (planCount(rows.slice(0, a)) > 0 ? 1 : 0) + (planCount(rows.slice(b + 1)) > 0 ? 1 : 0);
    return stack(rows.slice(a, b + 1)) + chips * (ROW.chip + ROW.gap) <= capacity;
  };
  let a = anchorOf(rows, now);
  let b = a;
  let forward = true;
  for (let stuck = 0; stuck < 2; ) {
    const [na, nb] = forward ? [a, b + 1] : [a - 1, b];
    if (na >= 0 && nb < rows.length && fits(na, nb)) {
      a = na;
      b = nb;
      stuck = 0;
    } else {
      stuck += 1;
    }
    forward = !forward;
  }
  while (a < b && rows[a]!.kind === "free") a += 1;
  while (b > a && rows[b]!.kind === "free") b -= 1;
  return { rows: rows.slice(a, b + 1), earlier: planCount(rows.slice(0, a)), later: planCount(rows.slice(b + 1)) };
}

/** One line recapping a day that is over: "3 plans done · 2 attended"; plans that were declined do not count. */
export function dayRecap(plans: Plan[]): string {
  const kept = plans.filter((plan) => plan.rsvp !== "no");
  if (kept.length === 0) return "";
  const attended = kept.filter((plan) => plan.attended === true).length;
  return `${kept.length} ${kept.length === 1 ? "plan" : "plans"} done${attended === 0 ? "" : ` · ${attended} attended`}`;
}

/** Tomorrow as the widget previews it: its first plan and how many there are, or null when nothing is planned. */
export function tomorrowPreview(plans: Plan[]): { first: Plan; count: number } | null {
  const kept = plans.filter((plan) => plan.rsvp !== "no");
  return kept.length === 0 ? null : { first: kept[0]!, count: kept.length };
}
