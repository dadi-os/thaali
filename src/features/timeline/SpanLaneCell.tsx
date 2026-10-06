import { motion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { isSameDay } from "./dates";
import { occurrenceOf, planOverlapsDay, planStartsOn, spanOf, statusClass, type PlanNode, type PlanOccurrence } from "./plans";

export type SpanLaneCellProps = {
  /** Multi-day plans sharing this lane; at most one touches `day`. */
  lane: PlanNode[];
  /** Column this cell sits in. */
  day: Date;
  /** First column of the shown week, where a bar that began earlier repeats its title. */
  first: boolean;
  /** Ticking clock: fades a bar once its plan has ended. */
  now: Date;
  /** Entrance delay so bars settle with their column. */
  delay: number;
  /** A bar was clicked: open its plan's popover anchored to the bar element. */
  onOpen: (nodeId: string, el: Element, occurrence?: PlanOccurrence) => void;
};

/**
 * One day's slice of a multi-day lane. Slices of the same plan reach across the column
 * padding and border so neighboring days read as one bar, rounded only where the plan
 * starts and ends; an empty slice keeps the lane's height so bars line up across columns.
 */
export function SpanLaneCell({ lane, day, first, now, delay, onOpen }: SpanLaneCellProps) {
  const plan = lane.find((p) => planOverlapsDay(p, day));
  if (!plan) {
    return <div aria-hidden className="h-5" />;
  }
  const span = spanOf(plan)!;
  const starts = planStartsOn(plan, day);
  const ends = isSameDay(span.end, day);
  return (
    <motion.button
      type="button"
      title={plan.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: span.end < now ? 0.55 : 1 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(plan.id, e.currentTarget, occurrenceOf(plan));
      }}
      className={`flex h-5 min-w-0 items-center px-1.5 text-left text-[10px] leading-none ${statusClass(plan.detail.status)} ${
        starts ? "rounded-l-[6px]" : "-ml-[7px] rounded-l-none border-l-0"
      } ${ends ? "rounded-r-[6px]" : "-mr-1.5 rounded-r-none border-r-0"}`}
    >
      {starts || first ? <span className="truncate">{plan.title}</span> : null}
    </motion.button>
  );
}
