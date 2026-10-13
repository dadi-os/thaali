/** Plan and dated-node helpers shared by the timeline views and popovers. */

import type { NodeRecord, PlanDetail, PlanStatus } from "../../types/yaad";
import type { PopoverAnchor } from "../../shared/components/Popover";
import { endOfDay, formatTime, isSameDay, startOfDay } from "./dates";

/** Yaad plan node with its plan detail. */
export type PlanNode = NodeRecord & { detail: PlanDetail };

/** When one occurrence of a recurring plan happens; Yaad stores only the series' first. */
export type PlanOccurrence = { occurred_at: string; end_at: string | null };

/** The occurrence a queried plan stands for, or undefined for a plan stored on its own. */
export function occurrenceOf(plan: PlanNode): PlanOccurrence | undefined {
  return plan.detail.series_id && plan.occurred_at
    ? { occurred_at: plan.occurred_at, end_at: plan.detail.end_at }
    : undefined;
}

/**
 * Narrow a queried node to a plan; null for other kinds.
 * @throws When a plan comes back without its plan detail, which Yaad always stores.
 */
export function asPlan(node: NodeRecord & { detail: unknown }): PlanNode | null {
  if (node.kind !== "plan") {
    return null;
  }
  if (node.detail === null) {
    throw new Error(`plan ${node.id} came back without plan detail`);
  }
  return { ...node, detail: node.detail as PlanDetail };
}

/**
 * Plan start and end; a plan without `end_at` is a moment at its start. An all-day plan
 * covers its whole first day through the end of its last.
 */
export function spanOf(plan: PlanNode): { start: Date; end: Date } | null {
  if (!plan.occurred_at) {
    return null;
  }
  const start = new Date(plan.occurred_at);
  const end = plan.detail.end_at ? new Date(plan.detail.end_at) : start;
  if (plan.detail.all_day) {
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  return { start, end };
}

/** What a chip shows on the plan's first day: its start time, or "All day". */
export function startLabel(plan: PlanNode): string {
  return plan.detail.all_day ? "All day" : formatTime(plan.occurred_at!);
}

/** True when the plan starts on `day`, where its chip shows the start time. */
export function planStartsOn(plan: PlanNode, day: Date): boolean {
  if (!plan.occurred_at) {
    return false;
  }
  return isSameDay(new Date(plan.occurred_at), day);
}

/** True when any part of the plan falls on `day`, so multi-day plans show on each day. */
export function planOverlapsDay(plan: PlanNode, day: Date): boolean {
  const span = spanOf(plan);
  if (!span) {
    return false;
  }
  return span.start.getTime() <= endOfDay(day).getTime() && span.end.getTime() >= startOfDay(day).getTime();
}

/** True when the plan runs past the end of the day it starts on. */
export function isMultiDay(plan: PlanNode): boolean {
  const span = spanOf(plan);
  return span !== null && span.end.getTime() > endOfDay(span.start).getTime();
}

/**
 * True when the plan draws as a bar along the top of its days rather than as a chip:
 * it is all-day or runs past a day.
 */
export function runsAsBar(plan: PlanNode): boolean {
  return plan.detail.all_day || isMultiDay(plan);
}

/**
 * Bar plans (all-day or multi-day) touching `days`, stacked into lanes, earliest first:
 * plans in one lane share no shown day, so each lane draws as one row of bars.
 */
export function spanLanes(plans: PlanNode[], days: Date[]): PlanNode[][] {
  const shownDays = (plan: PlanNode) => days.filter((day) => planOverlapsDay(plan, day));
  const lanes: PlanNode[][] = [];
  const multi = plans
    .filter((p) => runsAsBar(p) && shownDays(p).length > 0)
    .sort((a, b) => a.occurred_at!.localeCompare(b.occurred_at!));
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
export function lanesThrough(lanes: PlanNode[][], day: Date): PlanNode[][] {
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
  bars: Array<{ plan: PlanNode; lane: number; from: number; to: number }>;
  /** Per column, the timed plans shown and the slot each takes. */
  items: Array<Array<{ plan: PlanNode; slot: number }>>;
  /** Per column, the slot and count of a "+N more" line, or null when every plan fits. */
  more: Array<{ slot: number; count: number } | null>;
  /** Slot rows the week needs. */
  slots: number;
};

/**
 * Lays out one week of the month: bar plans keep their `spanLanes` lanes, and each day's
 * timed plans fill the slots no bar covers that day, top first, so a day without bars
 * lists from the top. A day holds `max(limit, lanes)` slots; when its plans do not fit,
 * its last free slot becomes "+N more".
 */
export function weekSlots(plans: PlanNode[], week: Date[], limit: number): WeekSlots {
  const lanes = spanLanes(plans, week);
  const bars = lanes.flatMap((lane, l) =>
    lane.map((plan) => {
      const cols = week.flatMap((day, c) => (planOverlapsDay(plan, day) ? [c] : []));
      return { plan, lane: l, from: cols[0]!, to: cols[cols.length - 1]! };
    }),
  );
  const cap = Math.max(limit, lanes.length);
  const items: WeekSlots["items"] = [];
  const more: WeekSlots["more"] = [];
  let slots = lanes.length;
  week.forEach((day, c) => {
    const taken = new Set(bars.filter((b) => b.from <= c && c <= b.to).map((b) => b.lane));
    const free = Array.from({ length: cap }, (_, s) => s).filter((s) => !taken.has(s));
    const timed = plansOn(plans, day).filter((p) => !runsAsBar(p));
    const fits = timed.length <= free.length;
    const shown = fits ? timed : timed.slice(0, Math.max(free.length - 1, 0));
    items.push(shown.map((plan, j) => ({ plan, slot: free[j]! })));
    if (fits) {
      more.push(null);
      if (shown.length > 0) {
        slots = Math.max(slots, free[shown.length - 1]! + 1);
      }
    } else {
      const slot = free.length > 0 ? free[free.length - 1]! : cap;
      more.push({ slot, count: timed.length - shown.length });
      slots = Math.max(slots, slot + 1);
    }
  });
  return { bars, items, more, slots };
}

/** Plans on `day`, earliest first. */
export function plansOn(plans: PlanNode[], day: Date): PlanNode[] {
  return plans
    .filter((p) => planOverlapsDay(p, day))
    .sort((a, b) => a.occurred_at!.localeCompare(b.occurred_at!));
}

/** Chip classes per status: solid confirmed, dashed tentative, ghosted idea. */
export function statusClass(status: PlanStatus): string {
  if (status === "tentative") {
    return "border border-dashed border-sage-line bg-sage-faint/80 text-sage-text";
  }
  if (status === "idea") {
    return "border border-rule bg-bone text-ink-ghost";
  }
  return "border border-transparent bg-sage-active text-ink";
}

/** Popover anchor hugging `el`: the panel opens beside it, clear of its width. */
export function anchorOf(el: Element): PopoverAnchor {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + 12, radius: r.width / 2 };
}

/** A quick-add Yaad is still filing, drawn as a ghost chip until it lands. */
export type PendingAdd = {
  key: string;
  /** Day it was added to; null means the header composer (drawn on today). */
  day: Date | null;
  text: string;
};
