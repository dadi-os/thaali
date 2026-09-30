/** Plan and dated-node helpers shared by the timeline views and popovers. */

import type { NodeDetail, NodeRecord, PlanDetail, PlanStatus } from "../../shared/api/types";
import type { PopoverAnchor } from "../../shared/components/Popover";
import { endOfDay, isSameDay, startOfDay } from "./dates";

/** Yaad plan node with its plan detail. */
export type PlanNode = NodeRecord & { detail: PlanDetail | null };

/** A dated Yaad node shown on the timeline: a plan, or a memory of something that happened. */
export type TimelineNode = NodeRecord & { detail: NodeDetail };

/** Narrow a queried node to a plan; null for other kinds. */
export function asPlan(node: NodeRecord & { detail: unknown }): PlanNode | null {
  if (node.kind !== "plan") {
    return null;
  }
  const detail = node.detail as PlanDetail | null;
  return { ...node, detail };
}

/** Plan lifecycle status; a plan stored without detail reads as confirmed. */
export function statusOf(plan: PlanNode): PlanStatus {
  return plan.detail?.status ?? "confirmed";
}

/** Plan start and end; a plan without `end_at` is a moment at its start. */
export function spanOf(plan: PlanNode): { start: Date; end: Date } | null {
  if (!plan.occurred_at) {
    return null;
  }
  const start = new Date(plan.occurred_at);
  const end = plan.detail?.end_at ? new Date(plan.detail.end_at) : start;
  return { start, end };
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

/** Plans on `day`, earliest first. */
export function plansOn(plans: PlanNode[], day: Date): PlanNode[] {
  return plans
    .filter((p) => planOverlapsDay(p, day))
    .sort((a, b) => (a.occurred_at ?? "").localeCompare(b.occurred_at ?? ""));
}

/** Memories that happened on `day`, earliest first. */
export function memoriesOn(memories: NodeRecord[], day: Date): NodeRecord[] {
  return memories
    .filter((m) => m.occurred_at !== null && isSameDay(new Date(m.occurred_at), day))
    .sort((a, b) => (a.occurred_at ?? "").localeCompare(b.occurred_at ?? ""));
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
