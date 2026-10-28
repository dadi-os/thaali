import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BREATH_S, EASE, SLOW_S } from "../../shared/lib/ux/motion";
import type { TimelineItem } from "../../types/timeline";
import { formatDayShort, isSameDay, isSameMonth, shortTime } from "./dates";
import { BreathRing, LiveDot } from "./markers";
import { itemKey, planStartsOn, planTone, spanOf, statusClass, weekSlots } from "./plans";

/** Delay per diagonal step as the grid washes in from the top-left. */
const WAVE_STEP_S = 0.018;
/** Height of the date strip atop each day, matching its `h-9`. */
const HEADER_PX = 36;
/** Height of one bar or plan line, matching their `h-[22px]`. */
const SLOT_PX = 22;
/** Gap between a week's slot lines and its bottom padding, in pixels, that a row keeps clear. */
const ROW_PAD_PX = 8;

export type MonthViewProps = {
  /** Every day of the grid, Monday before the month through Sunday after. */
  days: Date[];
  /** Any day in the shown month. */
  anchor: Date;
  labels: string[];
  today: Date;
  /** Ticking clock: fades what already happened and pulses what is happening. */
  now: Date;
  /** The month view's sessions: dues, all-day and multi-day sessions, one-off commitments. */
  plans: TimelineItem[];
  /** Plans have not loaded yet: days shimmer instead of reading as empty. */
  loading: boolean;
  /** A session was clicked: open its popover beside `el`. */
  onOpen: (item: TimelineItem, el: Element) => void;
  /** Open this day in the week view. */
  onSelectDay: (day: Date) => void;
};

/**
 * Month grid laid out as week rows, each one grid of slot lines under the dates (see
 * `weekSlots`). All-day and multi-day plans are single bars spanning their days; each
 * day's timed plans fill the slots its bars leave free as time-and-title lines that open
 * their popover, and a full day ends on "+N more" into its week. Week rows share the grid's
 * height and the lines each can hold follow from it, so a busy week folds into "+N more"
 * and the grid never scrolls. Days are rounded cards (none outside the month), clicking one
 * opens its week, and today is ringed in sage with its date in a breathing disc.
 */
export function MonthView({
  days,
  anchor,
  labels,
  today,
  now,
  plans,
  loading,
  onOpen,
  onSelectDay,
}: MonthViewProps) {
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const grid = useRef<HTMLDivElement>(null);
  const [gridPx, setGridPx] = useState(0);
  useLayoutEffect(() => {
    const el = grid.current;
    if (el === null) {
      return;
    }
    const observer = new ResizeObserver(() => setGridPx(el.clientHeight));
    observer.observe(el);
    setGridPx(el.clientHeight);
    return () => observer.disconnect();
  }, []);
  const rowPx = gridPx / weeks.length;
  const slotsFit = Math.max(Math.floor((rowPx - HEADER_PX - ROW_PAD_PX) / (SLOT_PX + 2)), 1);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 gap-x-1.5 pb-2">
        {labels.map((label) => (
          <span key={label} className="px-2.5 text-[11.5px] font-semibold tracking-[1.5px] text-ink-ghost uppercase">
            {label}
          </span>
        ))}
      </div>
      <div ref={grid} className="grid min-h-0 flex-1 auto-rows-[1fr] gap-y-1.5 overflow-hidden">
        {weeks.map((week, w) => {
          const layout = weekSlots(plans, week, slotsFit);
          return (
            <div
              key={week[0]!.toISOString()}
              className="grid min-h-0 grid-cols-7 gap-x-1.5 gap-y-0.5 overflow-hidden pb-1.5"
              style={{ gridTemplateRows: `${HEADER_PX}px ${`${SLOT_PX}px `.repeat(layout.slots)}1fr` }}
            >
              {week.map((day, i) => {
                const inMonth = isSameMonth(day, anchor);
                const isToday = isSameDay(day, today);
                const isPast = day < today;
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: SLOW_S, ease: EASE, delay: (w + i) * WAVE_STEP_S }}
                    style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                    className={`group -mb-1.5 min-w-0 cursor-pointer rounded-[14px] transition-colors duration-slow ease-dadi ${
                      isToday
                        ? "bg-sage-fill ring-1 ring-sage-line"
                        : inMonth
                          ? "bg-[color-mix(in_srgb,var(--sage-fill)_45%,transparent)] hover:bg-sage-fill"
                          : "hover:bg-[color-mix(in_srgb,var(--sage-fill)_45%,transparent)]"
                    }`}
                  >
                    <div className="flex h-9 items-center px-1.5">
                      <span
                        className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${
                          isToday ? "bg-sage-deep text-bone" : !inMonth ? "text-ink-ghost" : isPast ? "text-ink-muted" : "text-ink"
                        }`}
                      >
                        {day.getDate()}
                        {isToday ? <BreathRing /> : null}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              {loading
                ? week.map((day, i) =>
                    isSameMonth(day, anchor) ? (
                      <motion.span
                        key={day.toISOString()}
                        style={{ gridColumn: i + 1, gridRow: 2 }}
                        className="mx-2 h-3 w-3/4 self-center rounded-[4px] bg-sage-fill"
                        animate={{ opacity: [0.35, 0.8, 0.35] }}
                        transition={{ duration: BREATH_S / 2, repeat: Infinity, delay: (w + i) * WAVE_STEP_S }}
                      />
                    ) : null,
                  )
                : null}

              {layout.bars.map((bar) => (
                <MonthBar
                  key={`${itemKey(bar.plan)}:${bar.from}`}
                  {...bar}
                  week={week}
                  now={now}
                  delay={(w + bar.from) * WAVE_STEP_S + 0.06}
                  onOpen={onOpen}
                />
              ))}

              {layout.items.flatMap((col, i) =>
                col.map(({ plan, slot }, j) => (
                  <MonthItem
                    key={`${itemKey(plan)}:${i}`}
                    plan={plan}
                    col={i}
                    slot={slot}
                    dim={!isSameMonth(week[i]!, anchor)}
                    now={now}
                    delay={(w + i) * WAVE_STEP_S + 0.08 + j * 0.03}
                    onOpen={onOpen}
                  />
                )),
              )}

              {layout.more.map((more, i) =>
                more ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectDay(week[i]!)}
                    style={{ gridColumn: i + 1, gridRow: more.slot + 2 }}
                    className="mx-1.5 self-center justify-self-start rounded-[6px] px-1 text-[11.5px] font-medium text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-ink"
                  >
                    +{more.count} more
                  </button>
                ) : null,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type MonthBarProps = {
  plan: TimelineItem;
  /** Slot row the bar takes, shared with every day it covers. */
  lane: number;
  /** First column (0–6) of `week` the bar covers. */
  from: number;
  /** Last column (0–6) of `week` the bar covers. */
  to: number;
  week: Date[];
  /** Ticking clock: fades the bar once its plan has ended. */
  now: Date;
  /** Entrance delay so the bar settles with its first day. */
  delay: number;
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * One all-day or multi-day plan as a single bar across its days in the week, so its
 * title has the whole span. Ends where the plan carries into another week run square to
 * the grid edge; ends where it starts or stops are rounded and inset like the lines.
 */
function MonthBar({ plan, lane, from, to, week, now, delay, onOpen }: MonthBarProps) {
  const span = spanOf(plan)!;
  const starts = planStartsOn(plan, week[from]!);
  const ends = isSameDay(span.end, week[to]!);
  return (
    <motion.button
      type="button"
      title={plan.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: span.end < now ? 0.55 : 1 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      onClick={(e) => onOpen(plan, e.currentTarget)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpen(plan, e.currentTarget);
      }}
      style={{ gridColumn: `${from + 1} / ${to + 2}`, gridRow: lane + 2, "--tone": planTone(plan) } as CSSProperties}
      className={`relative flex h-[22px] min-w-0 items-center px-2 text-left text-[12px] leading-none font-semibold ${statusClass(plan.status)} ${
        starts ? "ml-1 rounded-l-[8px]" : "rounded-l-none border-l-0 pl-2.5"
      } ${ends ? "mr-1 rounded-r-[8px]" : "rounded-r-none border-r-0"}`}
    >
      <span className="truncate">{plan.title}</span>
    </motion.button>
  );
}

type MonthItemProps = {
  plan: TimelineItem;
  /** Column (0–6) the line sits in. */
  col: number;
  /** Slot row the line takes, below any bars covering its day. */
  slot: number;
  /** The day sits outside the shown month, so its line fades back. */
  dim: boolean;
  /** Ticking clock: pulses the line while its plan is happening and fades it once past. */
  now: Date;
  /** Entrance delay so lines settle after their day. */
  delay: number;
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * One timed plan as a line: a dot in its tone (solid confirmed, hollow tentative, live pulse
 * while it is happening), its short time ("due 11:59" in clay for a deadline) and title.
 * Fades once it has passed.
 */
function MonthItem({ plan, col, slot, dim, now, delay, onOpen }: MonthItemProps) {
  const span = spanOf(plan)!;
  const ongoing = span.start <= now && now < span.end;
  const due = plan.start_at === null;
  return (
    <motion.button
      type="button"
      title={plan.title}
      initial={{ opacity: 0, x: -3 }}
      animate={{ opacity: span.end < now || dim ? 0.55 : 1, x: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      onClick={(e) => onOpen(plan, e.currentTarget)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpen(plan, e.currentTarget);
      }}
      style={{ gridColumn: col + 1, gridRow: slot + 2, "--tone": planTone(plan) } as CSSProperties}
      className="relative mx-1 flex h-[22px] min-w-0 items-center gap-1.5 rounded-[6px] px-1.5 text-left text-[12px] leading-none transition-colors duration-slow ease-dadi hover:bg-sage-fill"
    >
      {ongoing ? (
        <LiveDot />
      ) : (
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${
            plan.status === "tentative" ? "border border-[var(--tone)]" : "bg-[var(--tone)]"
          }`}
        />
      )}
      <span
        className={`shrink-0 font-medium tabular-nums ${due ? "text-[color-mix(in_srgb,var(--clay)_75%,var(--ink))]" : "text-ink-ghost"}`}
      >
        {due ? `due ${shortTime(plan.due_at!)}` : shortTime(plan.start_at!)}
      </span>
      <span className="min-w-0 truncate font-semibold text-ink">{plan.title}</span>
    </motion.button>
  );
}
