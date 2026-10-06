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
 * Multi-day plans touching `days`, stacked into lanes, earliest first: plans in one lane
 * share no shown day, so each lane draws as one row of bars.
 */
export function spanLanes(plans: PlanNode[], days: Date[]): PlanNode[][] {
  const shownDays = (plan: PlanNode) => days.filter((day) => planOverlapsDay(plan, day));
  const lanes: PlanNode[][] = [];
  const multi = plans
    .filter((p) => isMultiDay(p) && shownDays(p).length > 0)
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

/** Plans on `day`, earliest first. */
export function plansOn(plans: PlanNode[], day: Date): PlanNode[] {
  return plans
    .filter((p) => planOverlapsDay(p, day))
    .sort((a, b) => a.occurred_at!.localeCompare(b.occurred_at!));
}

/** Memories that happened on `day`, earliest first. */
export function memoriesOn(memories: NodeRecord[], day: Date): NodeRecord[] {
  return memories
    .filter((m) => m.occurred_at !== null && isSameDay(new Date(m.occurred_at), day))
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
