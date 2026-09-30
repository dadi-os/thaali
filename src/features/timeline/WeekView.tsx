import { AnimatePresence, motion } from "motion/react";
import type { NodeRecord } from "../../shared/api/types";
import { IconPlus } from "../../shared/components/IconButton";
import { BREATH_S, EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatDayShort, formatTime, isSameDay } from "./dates";
import { BreathRing, FreshGlow, LiveDot } from "./markers";
import {
  memoriesOn,
  plansOn,
  planStartsOn,
  spanOf,
  statusClass,
  type PendingAdd,
  type PlanNode,
} from "./plans";

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
  plans: PlanNode[];
  /** Memories of things that happened this week, listed under each day's plans. */
  memories: NodeRecord[];
  /** Plans have not loaded yet: columns shimmer instead of reading as empty. */
  loading: boolean;
  /** Node ids just created by a quick-add, which glow once. */
  fresh: Set<string>;
  /** Quick-adds Yaad is still filing, drawn as ghost chips on their day. */
  pending: PendingAdd[];
  onOpen: (nodeId: string, el: Element) => void;
  onAdd: (day: Date, el: Element) => void;
};

/**
 * Seven day columns of plan chips. Columns cascade in, chips settle after them, today
 * breathes and carries a now marker between what happened and what is next, and each
 * column offers a + to add to that day.
 */
export function WeekView({
  days,
  labels,
  today,
  now,
  plans,
  memories,
  loading,
  fresh,
  pending,
  onOpen,
  onAdd,
}: WeekViewProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden">
      {days.map((day, i) => {
        const dayPlans = plansOn(plans, day);
        const dayMemories = memoriesOn(memories, day);
        const isToday = isSameDay(day, today);
        const isPast = day < today;
        const ghosts = pending.filter((p) => isSameDay(p.day ?? today, day));
        const nowAt = isToday
          ? dayPlans.filter((p) => new Date(p.occurred_at!).getTime() <= now.getTime()).length
          : -1;
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
            <div className="relative mb-2 flex flex-col items-center gap-1">
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
              <button
                type="button"
                aria-label={`Add to ${formatDayShort(day)}`}
                onClick={(e) => onAdd(day, e.currentTarget)}
                className="absolute top-0 right-0 flex size-6 items-center justify-center rounded-full text-sage-deep opacity-0 transition-opacity duration-slow ease-dadi group-hover:opacity-100 hover:bg-sage-active focus-visible:opacity-100 [&>svg]:size-3.5"
              >
                <IconPlus />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {loading ? (
                <Shimmer delay={base} />
              ) : (
                <AnimatePresence>
                  {dayPlans.flatMap((p, j) => {
                    const chip = (
                      <PlanChip
                        key={p.id}
                        plan={p}
                        day={day}
                        now={now}
                        fresh={fresh.has(p.id)}
                        delay={base + 0.08 + j * CHIP_STAGGER_S}
                        onOpen={onOpen}
                      />
                    );
                    return j === nowAt ? [<NowMarker key="now" now={now} />, chip] : [chip];
                  })}
                  {nowAt === dayPlans.length ? <NowMarker key="now" now={now} /> : null}
                  {ghosts.map((g) => (
                    <motion.div
                      key={g.key}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: SLOW_S, ease: EASE }}
                      className="rounded-[6px] border border-dashed border-sage-line px-1.5 py-1 text-[11px] leading-snug text-ink-muted"
                    >
                      <motion.span
                        className="mb-0.5 block text-[10px] text-sage-deep"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: BREATH_S, repeat: Infinity }}
                      >
                        Remembering…
                      </motion.span>
                      <span className="line-clamp-2">{g.text}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {dayMemories.length > 0 ? (
                <div className="mt-1.5 flex flex-col gap-0.5 border-t border-dashed border-rule pt-1.5">
                  {dayMemories.map((m, j) => (
                    <motion.button
                      key={m.id}
                      type="button"
                      initial={{ opacity: 0, x: -3 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: SLOW_S, ease: EASE, delay: base + 0.14 + j * CHIP_STAGGER_S }}
                      onClick={(e) => onOpen(m.id, e.currentTarget)}
                      className="relative flex items-start gap-1 rounded-[4px] px-1 py-0.5 text-left text-[10.5px] leading-snug text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-ink"
                    >
                      <span aria-hidden className="mt-[5px] size-1 shrink-0 rounded-full bg-ink-faint" />
                      <span className="line-clamp-2">{m.title}</span>
                      {fresh.has(m.id) ? <FreshGlow radius="rounded-[4px]" /> : null}
                    </motion.button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

type PlanChipProps = {
  plan: PlanNode;
  /** Column the chip sits in; the start time shows only on the plan's first day. */
  day: Date;
  now: Date;
  fresh: boolean;
  /** Entrance delay so chips settle after their column. */
  delay: number;
  onOpen: (nodeId: string, el: Element) => void;
};

/** One plan: lifts on hover, fades once it has passed, pulses while it is happening. */
function PlanChip({ plan, day, now, fresh, delay, onOpen }: PlanChipProps) {
  const span = spanOf(plan)!;
  const t = now.getTime();
  const ongoing = span.start.getTime() <= t && t < span.end.getTime();
  const past = span.end.getTime() < t;
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
      onClick={(e) => onOpen(plan.id, e.currentTarget)}
      className={`relative w-full rounded-[6px] px-1.5 py-1 text-left text-[11px] leading-snug transition-shadow duration-slow ease-dadi hover:shadow-[var(--shadow)] ${statusClass(plan.detail.status)}`}
    >
      {planStartsOn(plan, day) ? (
        <span className="mb-0.5 flex items-center gap-1 text-[10px] opacity-70">
          {ongoing ? <LiveDot /> : null}
          {formatTime(plan.occurred_at!)}
        </span>
      ) : null}
      <span className="line-clamp-3">{plan.title}</span>
      {fresh ? <FreshGlow /> : null}
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
      className="flex items-center gap-1.5 py-0.5"
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
