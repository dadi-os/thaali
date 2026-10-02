import { motion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { isSameDay } from "./dates";
import { BreathRing, LiveDot } from "./markers";
import { isMultiDay, plansOn, planStartsOn, spanLanes, spanOf, startLabel, type PlanNode } from "./plans";
import { SpanLaneCell } from "./SpanLaneCell";

export type RibbonViewProps = {
  /** Mon–Sun of the shown week. */
  days: Date[];
  labels: string[];
  today: Date;
  /** Ticking clock: fades what already happened and pulses what is happening. */
  now: Date;
  plans: PlanNode[];
  /** A plan was clicked: open it beside `el` without leaving the tile. */
  onOpen: (nodeId: string, el: Element) => void;
  className?: string;
};

/**
 * Compact current-week ribbon for the home tile: day columns cascade in, today
 * breathes, multi-day plans run as bars under the dates, and each day lists all of its
 * plans with their start time, scrolling when they overflow. A plan opens in place;
 * the rest of the tile opens the full timeline.
 */
export function RibbonView({ days, labels, today, now, plans, onOpen, className = "" }: RibbonViewProps) {
  const lanes = spanLanes(plans, days);
  return (
    <div className={`flex h-full min-h-0 flex-col px-2 pb-2 pt-1 ${className}`}>
      <div className="flex min-h-0 flex-1">
        {days.map((day, i) => {
          const dayPlans = plansOn(plans, day).filter((p) => !isMultiDay(p));
          const isToday = isSameDay(day, today);
          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 }}
              className={`flex min-h-0 min-w-0 flex-1 flex-col px-1.5 pt-1 ${i > 0 ? "border-l border-rule/80" : ""}`}
            >
              <span className="mb-1.5 text-center text-[11px] tracking-wide text-ink-ghost">{labels[i]}</span>
              <div className="mb-2 flex justify-center">
                <span
                  className={`relative flex size-9 items-center justify-center rounded-full text-[13px] ${
                    isToday ? "bg-ink text-bone" : "text-ink"
                  }`}
                >
                  {day.getDate()}
                  {isToday ? <BreathRing /> : null}
                </span>
              </div>
              {lanes.length > 0 ? (
                <div className="mb-1.5 flex flex-col gap-0.5">
                  {lanes.map((lane, r) => (
                    <SpanLaneCell
                      key={r}
                      lane={lane}
                      day={day}
                      first={i === 0}
                      now={now}
                      delay={i * 0.04 + 0.06}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
                {dayPlans.map((p, j) => {
                  const span = spanOf(p)!;
                  const live = !p.detail.all_day && span.start <= now && now < span.end;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: span.end < now ? 0.55 : 1, y: 0 }}
                      transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 + 0.08 + j * 0.03 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(p.id, e.currentTarget);
                      }}
                      className="-mx-1 min-w-0 shrink-0 rounded-[4px] px-1 text-left transition-colors duration-slow ease-dadi hover:bg-sage-fill"
                    >
                      {planStartsOn(p, day) ? (
                        <p className="flex items-center gap-1 text-[10px] text-ink-ghost">
                          {live ? <LiveDot /> : null}
                          {startLabel(p)}
                        </p>
                      ) : null}
                      <p className="truncate text-[11px] leading-snug text-ink">{p.title}</p>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
