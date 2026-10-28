import { AnimatePresence, motion } from "motion/react";
import { BREATH_S, EASE, SLOW_S } from "../../shared/lib/ux/motion";
import type { TimelineItem } from "../../types/timeline";
import { formatTime, isSameDay } from "./dates";
import { BreathRing, LiveDot, SessionMark } from "./markers";
import { itemKey, lanesThrough, plansOn, planStartsOn, runsAsBar, spanLanes, spanOf, startLabel, statusClass } from "./plans";
import { SpanLaneCell } from "./SpanLaneCell";

/** Delay between neighboring columns as a week arrives. */
const COLUMN_STAGGER_S = 0.04;
/** Delay between chips within a column. */
const CHIP_STAGGER_S = 0.03;

export type WeekViewProps = {
  /** Mon–Sun of the shown week. */
  days: Date[];
  labels: string[];
  today: Date;
  /** Ticking clock: places the now marker and fades what already happened. */
  now: Date;
  /** The week's sessions and dues. */
  plans: TimelineItem[];
  /** Plans have not loaded yet: columns shimmer instead of reading as empty. */
  loading: boolean;
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * Seven day columns of session chips. All-day and multi-day sessions run as bars across
 * the columns under the dates. Columns cascade in, chips settle after them, and today
 * breathes and carries a now marker between what happened and what is next.
 */
export function WeekView({ days, labels, today, now, plans, loading, onOpen }: WeekViewProps) {
  const lanes = spanLanes(plans, days);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden">
      {days.map((day, i) => {
        const dayPlans = plansOn(plans, day).filter((p) => !runsAsBar(p));
        const dayLanes = lanesThrough(lanes, day);
        const isToday = isSameDay(day, today);
        const isPast = day < today;
        const nowAt = isToday ? dayPlans.filter((p) => spanOf(p)!.start.getTime() <= now.getTime()).length : -1;
        const base = i * COLUMN_STAGGER_S;
        return (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: SLOW_S, ease: EASE, delay: base }}
            className={`group flex min-h-0 flex-col px-1.5 py-2 ${i > 0 ? "border-l border-rule/80" : ""} ${
              isToday ? "rounded-[var(--radius)] bg-sage-faint/40" : ""
            }`}
          >
            <div className="mb-2 flex flex-col items-center gap-1">
              <span className={`text-[11px] tracking-wide ${isToday ? "text-sage-deep" : "text-ink-ghost"}`}>
                {labels[i]}
              </span>
              <span
                className={`relative flex size-9 items-center justify-center rounded-full text-[13px] ${
                  isToday ? "bg-ink text-bone" : isPast ? "text-ink-faint" : "text-ink"
                }`}
              >
                {day.getDate()}
                {isToday ? <BreathRing /> : null}
              </span>
            </div>

            {dayLanes.length > 0 ? (
              <div className="mb-1.5 flex flex-col gap-0.5">
                {dayLanes.map((lane, r) => (
                  <SpanLaneCell
                    key={r}
                    lane={lane}
                    day={day}
                    first={i === 0}
                    now={now}
                    delay={base + 0.06}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
              {loading ? (
                <Shimmer delay={base} />
              ) : (
                <AnimatePresence>
                  {dayPlans.flatMap((p, j) => {
                    const chip = (
                      <PlanChip
                        key={itemKey(p)}
                        plan={p}
                        day={day}
                        now={now}
                        delay={base + 0.08 + j * CHIP_STAGGER_S}
                        onOpen={onOpen}
                      />
                    );
                    return j === nowAt ? [<NowMarker key="now" now={now} />, chip] : [chip];
                  })}
                  {nowAt === dayPlans.length ? <NowMarker key="now" now={now} /> : null}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

type PlanChipProps = {
  plan: TimelineItem;
  /** Column the chip sits in; the start time shows only on the plan's first day. */
  day: Date;
  now: Date;
  /** Entrance delay so chips settle after their column. */
  delay: number;
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * One session: lifts on hover, fades once it has passed or is completed, pulses while it is
 * happening, carries Khisso's Completed circle when it has a time, and is struck through when
 * cancelled or completed.
 */
function PlanChip({ plan, day, now, delay, onOpen }: PlanChipProps) {
  const span = spanOf(plan)!;
  const t = now.getTime();
  const ongoing = !plan.all_day && span.start.getTime() <= t && t < span.end.getTime();
  const past = span.end.getTime() < t || plan.outcome === "done";
  return (
    <motion.button
      layout="position"
      type="button"
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: past ? 0.55 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      onClick={(e) => onOpen(plan, e.currentTarget)}
      className={`relative w-full rounded-[6px] px-1.5 py-1 text-left text-[11px] leading-snug transition-shadow duration-slow ease-dadi hover:shadow-[var(--shadow)] ${statusClass(plan.status)} ${
        plan.state === "cancelled" || plan.outcome === "done" ? "line-through" : ""
      }`}
    >
      {planStartsOn(plan, day) ? (
        <span className="mb-0.5 flex items-center gap-1 text-[10px] opacity-70">
          {ongoing ? <LiveDot /> : null}
          {startLabel(plan)}
          {plan.start_at !== null && !plan.all_day ? (
            <span className="ml-auto flex">
              <SessionMark item={plan} now={now} className="size-3" />
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="line-clamp-3">{plan.title}</span>
    </motion.button>
  );
}

/** Clay line in today's column between what already started and what is still ahead. */
function NowMarker({ now }: { now: Date }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      className="flex items-center gap-1.5 py-0.5 pl-1.5"
    >
      <LiveDot />
      <span className="h-px flex-1" style={{ background: "color-mix(in srgb, var(--clay) 55%, transparent)" }} />
      <span className="text-[9.5px] tabular-nums text-[var(--clay)]">{formatTime(now.toISOString())}</span>
    </motion.div>
  );
}

/** Placeholder bars while a week's plans load. */
function Shimmer({ delay }: { delay: number }) {
  return (
    <>
      {[0, 1].map((k) => (
        <motion.div
          key={k}
          className="h-7 rounded-[6px] bg-sage-fill"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: BREATH_S / 2, repeat: Infinity, delay: delay + k * 0.1 }}
        />
      ))}
    </>
  );
}
