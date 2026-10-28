import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { isSameDay } from "./dates";
import type { TimelineItem } from "../../types/timeline";
import { planOverlapsDay, planStartsOn, planTone, spanOf, statusClass } from "./plans";

export type SpanLaneCellProps = {
  /** Multi-day plans sharing this lane; at most one touches `day`. */
  lane: TimelineItem[];
  /** Column this cell sits in. */
  day: Date;
  /** First column of the shown week, where a bar that began earlier repeats its title. */
  first: boolean;
  /** Ticking clock: fades a bar once its plan has ended. */
  now: Date;
  /** Entrance delay so bars settle with their column. */
  delay: number;
  /** A bar was clicked: open its plan's popover anchored to the bar element. */
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * One day's slice of a multi-day lane, a pill tinted by the plan's tone. Slices of the same
 * plan reach across the column padding so neighboring days read as one bar, rounded only where the plan
 * starts and ends; an empty slice keeps the lane's height so bars line up across columns.
 */
export function SpanLaneCell({ lane, day, first, now, delay, onOpen }: SpanLaneCellProps) {
  const plan = lane.find((p) => planOverlapsDay(p, day));
  if (!plan) {
    return <div aria-hidden className="h-6" />;
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
        onOpen(plan, e.currentTarget);
      }}
      style={{ "--tone": planTone(plan) } as CSSProperties}
      className={`flex h-6 min-w-0 shrink-0 items-center px-2 text-left text-[12px] leading-none font-semibold ${statusClass(plan.status)} ${
        starts ? "rounded-l-[8px]" : "-ml-1 rounded-l-none border-l-0"
      } ${ends ? "rounded-r-[8px]" : "-mr-1 rounded-r-none border-r-0"}`}
    >
      {starts || first ? <span className="truncate">{plan.title}</span> : null}
    </motion.button>
  );
}
