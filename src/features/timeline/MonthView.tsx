import { motion } from "motion/react";
import type { NodeRecord } from "../../shared/api/types";
import { IconPlus } from "../../shared/components/IconButton";
import { BREATH_S, EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatDayShort, isSameDay, isSameMonth } from "./dates";
import { BreathRing, FreshGlow } from "./markers";
import { memoriesOn, plansOn, statusClass, statusOf, type PlanNode } from "./plans";

/** Delay per diagonal step as the grid washes in from the top-left. */
const WAVE_STEP_S = 0.018;
/** Plan pills shown per square before "+N". */
const PILLS_SHOWN = 3;
/** Memory dots drawn per square. */
const DOTS_SHOWN = 4;

export type MonthViewProps = {
  /** Every day of the grid, Monday before the month through Sunday after. */
  days: Date[];
  /** Any day in the shown month. */
  anchor: Date;
  labels: string[];
  today: Date;
  plans: PlanNode[];
  /** Memories of things that happened, drawn as dots on their day. */
  memories: NodeRecord[];
  /** Plans have not loaded yet: squares shimmer instead of reading as empty. */
  loading: boolean;
  /** Node ids just created by a quick-add, which glow once. */
  fresh: Set<string>;
  /** Open this day in the week view. */
  onSelectDay: (day: Date) => void;
  onAdd: (day: Date, el: Element) => void;
};

/**
 * Month grid of day squares that wash in diagonally. Busier days are tinted deeper,
 * memories show as dots, today breathes, and a square opens its week or, from its +,
 * a quick-add for that day.
 */
export function MonthView({
  days,
  anchor,
  labels,
  today,
  plans,
  memories,
  loading,
  fresh,
  onSelectDay,
  onAdd,
}: MonthViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {labels.map((label) => (
          <span key={label} className="text-center text-[10px] tracking-wide text-ink-ghost">
            {label}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, today);
          const isPast = day < today;
          const dayPlans = plansOn(plans, day);
          const dayMemories = memoriesOn(memories, day);
          const delay = (Math.floor(i / 7) + (i % 7)) * WAVE_STEP_S;
          const tint = Math.min(4 + dayPlans.length * 5, 22);
          return (
            <motion.div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              aria-label={`Open the week of ${formatDayShort(day)}`}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(day);
                }
              }}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: inMonth ? 1 : 0.4, y: 0, scale: 1 }}
              transition={{ duration: SLOW_S, ease: EASE, delay }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.98 }}
              style={
                dayPlans.length > 0 && !isToday
                  ? { background: `color-mix(in srgb, var(--sage) ${tint}%, transparent)` }
                  : undefined
              }
              className={`group relative flex min-h-[72px] cursor-pointer flex-col rounded-[6px] border border-dashed px-1 py-1 text-left transition-[border-color,box-shadow] duration-slow ease-hath hover:border-sage hover:shadow-[var(--shadow)] ${
                isToday
                  ? "border-sage bg-sage-faint/70"
                  : inMonth
                    ? "border-rule bg-bone/50"
                    : "border-transparent bg-transparent"
              }`}
            >
              <div className="mb-1 flex items-center gap-1">
                <span
                  className={`relative flex size-5 items-center justify-center rounded-full text-[11px] ${
                    isToday ? "bg-ink font-medium text-bone" : isPast ? "text-ink-faint" : "text-ink-muted"
                  }`}
                >
                  {day.getDate()}
                  {isToday ? <BreathRing /> : null}
                </span>
                {dayMemories.length > 0 ? (
                  <span
                    className="flex items-center gap-0.5"
                    title={`${dayMemories.length} ${dayMemories.length === 1 ? "memory" : "memories"}`}
                  >
                    {dayMemories.slice(0, DOTS_SHOWN).map((m, j) => (
                      <motion.span
                        key={m.id}
                        aria-hidden
                        className="size-1 rounded-full bg-ink-faint"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: SLOW_S, ease: EASE, delay: delay + 0.12 + j * 0.04 }}
                      />
                    ))}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Add to ${formatDayShort(day)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(day, e.currentTarget);
                  }}
                  className="ml-auto flex size-5 items-center justify-center rounded-full text-sage-deep opacity-0 transition-opacity duration-slow ease-hath group-hover:opacity-100 hover:bg-sage-active focus-visible:opacity-100 [&>svg]:size-3"
                >
                  <IconPlus />
                </button>
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {loading && inMonth ? (
                  <motion.span
                    className="h-2.5 w-3/4 rounded-[3px] bg-sage-fill"
                    animate={{ opacity: [0.35, 0.8, 0.35] }}
                    transition={{ duration: BREATH_S / 2, repeat: Infinity, delay }}
                  />
                ) : (
                  dayPlans.slice(0, PILLS_SHOWN).map((p, j) => (
                    <motion.span
                      key={p.id}
                      initial={{ opacity: 0, x: -3 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: SLOW_S, ease: EASE, delay: delay + 0.08 + j * 0.03 }}
                      className={`relative truncate rounded-[3px] px-1 py-0.5 text-[9px] leading-tight ${statusClass(statusOf(p))}`}
                    >
                      {p.title}
                      {fresh.has(p.id) ? <FreshGlow radius="rounded-[3px]" /> : null}
                    </motion.span>
                  ))
                )}
                {dayPlans.length > PILLS_SHOWN ? (
                  <span className="text-[9px] text-ink-ghost">+{dayPlans.length - PILLS_SHOWN}</span>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
