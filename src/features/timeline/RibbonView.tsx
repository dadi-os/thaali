import { motion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatTime, isSameDay } from "./dates";
import { BreathRing, LiveDot } from "./markers";
import { plansOn, planStartsOn, spanOf, type PlanNode } from "./plans";

/** Plans listed per day before the column clips. */
const PLANS_SHOWN = 5;

export type RibbonViewProps = {
  /** Mon–Sun of the shown week. */
  days: Date[];
  labels: string[];
  today: Date;
  /** Ticking clock: fades what already happened and pulses what is happening. */
  now: Date;
  plans: PlanNode[];
  className?: string;
};

/**
 * Compact current-week ribbon for the home tile: day columns cascade in, today
 * breathes, and each day lists its first plans with their start time. Read-only; the
 * tile opens the full timeline.
 */
export function RibbonView({ days, labels, today, now, plans, className = "" }: RibbonViewProps) {
  return (
    <div className={`flex h-full min-h-0 flex-col px-2 pb-2 pt-1 ${className}`}>
      <div className="flex min-h-0 flex-1">
        {days.map((day, i) => {
          const dayPlans = plansOn(plans, day);
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
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                {dayPlans.slice(0, PLANS_SHOWN).map((p, j) => {
                  const span = spanOf(p)!;
                  const live = span.start <= now && now < span.end;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: span.end < now ? 0.55 : 1, y: 0 }}
                      transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 + 0.08 + j * 0.03 }}
                      className="min-w-0"
                    >
                      {planStartsOn(p, day) ? (
                        <p className="flex items-center gap-1 text-[10px] text-ink-ghost">
                          {live ? <LiveDot /> : null}
                          {formatTime(p.occurred_at!)}
                        </p>
                      ) : null}
                      <p className="truncate text-[11px] leading-snug text-ink">{p.title}</p>
                    </motion.div>
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
