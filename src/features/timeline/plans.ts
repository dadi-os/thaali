/** Session helpers shared by the timeline views and popovers. */

import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import type { PopoverAnchor } from "../../shared/components/Popover";
import { endOfDay, formatTime, isSameDay, startOfDay } from "./dates";

/**
 * The active agent that keeps `item`: its owner when that names an agent still running. Null
 * when the plan was made by hand or ingest, or its agent (often a one-shot worker) has retired;
 * a message about it then goes to Dadi. `agents` is Hath's list, absent until it has loaded.
 */
export function keeperOf(item: TimelineItem, agents: AgentRecord[] | undefined): AgentRecord | null {
  return agents?.find((agent) => agent.active && (agent.id === item.owner || agent.name === item.owner)) ?? null;
}

/** A key naming one session: its plan and the date it was first scheduled for. */
export function itemKey(item: TimelineItem): string {
  return `${item.id}:${item.occurrence_date ?? "undated"}`;
}

/** When a session is: its start, or its due for a deadline with no time set aside; null for an undated idea. */
function whenOf(item: TimelineItem): string | null {
  return item.start_at ?? item.due_at;
}

/**
 * Session start and end; a session without `end_at` (a deadline) is a moment at its start
 * or due. An all-day session covers its whole first day through the end of its last.
 */
export function spanOf(plan: TimelineItem): { start: Date; end: Date } | null {
  const when = whenOf(plan);
  if (!when) {
    return null;
  }
  const start = new Date(when);
  const end = plan.end_at ? new Date(plan.end_at) : start;
  if (plan.all_day) {
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  return { start, end };
}

/** What a chip shows on the session's first day: its start time, "Due" and its time, or "All day". */
export function startLabel(plan: TimelineItem): string {
  if (plan.start_at === null) {
    return plan.all_day || plan.due_at === null ? "Due" : `Due ${formatTime(plan.due_at)}`;
  }
  return plan.all_day ? "All day" : formatTime(plan.start_at);
}

/** True when the plan starts on `day`, where its chip shows the start time. */
export function planStartsOn(plan: TimelineItem, day: Date): boolean {
  const when = whenOf(plan);
  return when !== null && isSameDay(new Date(when), day);
}

/** True when any part of the plan falls on `day`, so multi-day plans show on each day. */
export function planOverlapsDay(plan: TimelineItem, day: Date): boolean {
  const span = spanOf(plan);
  if (!span) {
    return false;
  }
  return span.start.getTime() <= endOfDay(day).getTime() && span.end.getTime() >= startOfDay(day).getTime();
}

/** True when the plan runs past the end of the day it starts on. */
export function isMultiDay(plan: TimelineItem): boolean {
  const span = spanOf(plan);
  return span !== null && span.end.getTime() > endOfDay(span.start).getTime();
}

/**
 * True when the plan draws as a bar along the top of its days rather than as a chip:
 * it is all-day or runs past a day.
 */
export function runsAsBar(plan: TimelineItem): boolean {
  return plan.all_day || isMultiDay(plan);
}

/**
 * Bar plans (all-day or multi-day) touching `days`, stacked into lanes, earliest first:
 * plans in one lane share no shown day, so each lane draws as one row of bars.
 */
export function spanLanes(plans: TimelineItem[], days: Date[]): TimelineItem[][] {
  const shownDays = (plan: TimelineItem) => days.filter((day) => planOverlapsDay(plan, day));
  const lanes: TimelineItem[][] = [];
  const multi = plans
    .filter((p) => runsAsBar(p) && shownDays(p).length > 0)
    .sort(byWhen);
  for (const plan of multi) {
    const mine = shownDays(plan);
    const lane = lanes.find((l) => l.every((other) => !mine.some((day) => planOverlapsDay(other, day))));
    if (lane) {
      lane.push(plan);
    } else {
      lanes.push([plan]);
    }
  }
  return lanes;
}

/**
 * The lanes one day column draws: down to its lowest lane with a bar on `day`, so a day
 * without bars starts its chips under the date while bars keep their row across days.
 */
export function lanesThrough(lanes: TimelineItem[][], day: Date): TimelineItem[][] {
  let last = -1;
  lanes.forEach((lane, r) => {
    if (lane.some((p) => planOverlapsDay(p, day))) {
      last = r;
    }
  });
  return lanes.slice(0, last + 1);
}

/** Where one week row of the month draws each plan. */
export type WeekSlots = {
  /** Bar plans with their lane and the first and last column (0–6) they cover. */
  bars: Array<{ plan: TimelineItem; lane: number; from: number; to: number }>;
  /** Per column, the timed plans shown and the slot each takes. */
  items: Array<Array<{ plan: TimelineItem; slot: number }>>;
  /** Per column, the slot and count of a "+N more" line, or null when every plan fits. */
  more: Array<{ slot: number; count: number } | null>;
  /** Slot rows the week needs. */
  slots: number;
};

/**
 * Lays out one week of the month: bar plans keep their `spanLanes` lanes, and each day's
 * timed plans fill the slots no bar covers that day, top first, so a day without bars
 * lists from the top. A day never holds more than `limit` slots: when there are `limit`
 * bar lanes or more, the last lanes are left out and a day holds one slot back, and when a
 * day's plans do not fit, its last free slot becomes "+N more", counting the plans and bars
 * it could not show.
 */
export function weekSlots(plans: TimelineItem[], week: Date[], limit: number): WeekSlots {
  const allLanes = spanLanes(plans, week);
  const lanes = allLanes.slice(0, Math.min(allLanes.length, Math.max(limit - 1, 0)));
  const leftOut = allLanes.slice(lanes.length).flat();
  const bars = lanes.flatMap((lane, l) =>
    lane.map((plan) => {
      const cols = week.flatMap((day, c) => (planOverlapsDay(plan, day) ? [c] : []));
      return { plan, lane: l, from: cols[0]!, to: cols[cols.length - 1]! };
    }),
  );
  const cap = limit;
  const items: WeekSlots["items"] = [];
  const more: WeekSlots["more"] = [];
  let slots = lanes.length;
  week.forEach((day, c) => {
    const taken = new Set(bars.filter((b) => b.from <= c && c <= b.to).map((b) => b.lane));
    const free = Array.from({ length: cap }, (_, s) => s).filter((s) => !taken.has(s));
    const timed = plansOn(plans, day).filter((p) => !runsAsBar(p));
    const hidden = leftOut.filter((p) => planOverlapsDay(p, day)).length;
    const fits = hidden === 0 && timed.length <= free.length;
    const shown = fits ? timed : timed.slice(0, Math.max(free.length - 1, 0));
    items.push(shown.map((plan, j) => ({ plan, slot: free[j]! })));
    if (fits) {
      more.push(null);
      if (shown.length > 0) {
        slots = Math.max(slots, free[shown.length - 1]! + 1);
      }
    } else {
      const slot = free.length > 0 ? free[free.length - 1]! : Math.max(cap - 1, 0);
      more.push({ slot, count: hidden + timed.length - shown.length });
      slots = Math.max(slots, slot + 1);
    }
  });
  return { bars, items, more, slots };
}

/** Plans on `day`, earliest first. */
export function plansOn(plans: TimelineItem[], day: Date): TimelineItem[] {
  return plans.filter((p) => planOverlapsDay(p, day)).sort(byWhen);
}

/** Earliest first, by start or due; only dated sessions reach a day or a lane. */
function byWhen(a: TimelineItem, b: TimelineItem): number {
  return whenOf(a)!.localeCompare(whenOf(b)!);
}

/** Kinds drawn in the course tone; deadlines take clay, everything else sage. */
const COURSE_KINDS = new Set(["class", "lab", "exam"]);

/** A plan's tone as a CSS color: clay for a deadline, tide for a class, lab or exam, sage for the rest. */
export function planTone(item: TimelineItem): string {
  if (item.start_at === null) {
    return "var(--clay)";
  }
  return item.kind !== null && COURSE_KINDS.has(item.kind) ? "var(--tide)" : "var(--sage)";
}

/**
 * Chip classes per status, tinted by the `--tone` the chip sets from `planTone`: confirmed
 * fills with its tone, tentative is a fainter fill with a dashed edge, an idea stays bare.
 */
export function statusClass(status: TimelineItem["status"]): string {
  if (status === "tentative") {
    return "border border-dashed border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_7%,transparent)] text-[color-mix(in_srgb,var(--tone)_35%,var(--ink))]";
  }
  if (status === "idea") {
    return "border border-rule bg-bone text-ink-ghost";
  }
  return "border border-transparent bg-[color-mix(in_srgb,var(--tone)_15%,transparent)] text-[color-mix(in_srgb,var(--tone)_35%,var(--ink))]";
}

/** Popover anchor hugging `el`: the panel opens beside it, clear of its width. */
export function anchorOf(el: Element): PopoverAnchor {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + 12, radius: r.width / 2 };
}
