import { motion } from "motion/react";
import { IconPlus } from "../../shared/components/IconButton";
import { BREATH_S, EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatDayShort, formatTime, isSameDay, isSameMonth } from "./dates";
import { BreathRing, FreshGlow, LiveDot } from "./markers";
import {
  occurrenceOf,
  planStartsOn,
  spanOf,
  statusClass,
  weekSlots,
  type PlanNode,
  type PlanOccurrence,
} from "./plans";

/** Delay per diagonal step as the grid washes in from the top-left. */
const WAVE_STEP_S = 0.018;
/** Lines a day holds before its last one becomes "+N more" into its week. */
const SLOTS_SHOWN = 4;
/** Height of the date strip atop each day, matching its `h-8`. */
const HEADER_PX = 32;
/** Height of one bar or plan line, matching their `h-[18px]`. */
const SLOT_PX = 18;

export type MonthViewProps = {
  /** Every day of the grid, Monday before the month through Sunday after. */
  days: Date[];
  /** Any day in the shown month. */
  anchor: Date;
  labels: string[];
  today: Date;
  /** Ticking clock: fades what already happened and pulses what is happening. */
  now: Date;
  plans: PlanNode[];
  /** Plans have not loaded yet: days shimmer instead of reading as empty. */
  loading: boolean;
  /** Node ids just created by a quick-add, which glow once. */
  fresh: Set<string>;
  /** A plan was clicked: open its popover beside `el`. */
  onOpen: (nodeId: string, el: Element, occurrence?: PlanOccurrence) => void;
  /** Open this day in the week view. */
  onSelectDay: (day: Date) => void;
  onAdd: (day: Date, el: Element) => void;
};

/**
 * Month grid laid out as week rows, each one grid of slot lines under the dates (see
 * `weekSlots`). All-day and multi-day plans are single bars spanning their days; each
 * day's timed plans fill the slots its bars leave free as time-and-title lines that open
 * their popover, and a full day ends on "+N more" into its week. Rows share the height
 * and grow with a busy week, scrolling the grid. Clicking a day opens its week, its +
 * quick-adds to it, and today breathes.
 */
export function MonthView({
  days,
  anchor,
  labels,
  today,
  now,
  plans,
  loading,
  fresh,
  onOpen,
  onSelectDay,
  onAdd,
}: MonthViewProps) {
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 pb-1">
        {labels.map((label) => (
          <span key={label} className="text-center text-[10px] tracking-wide text-ink-ghost">
            {label}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-[1fr] overflow-y-auto overflow-x-hidden border-b border-rule/80">
        {weeks.map((week, w) => {
          const layout = weekSlots(plans, week, SLOTS_SHOWN);
          return (
            <div
              key={week[0]!.toISOString()}
              className="grid min-h-[88px] grid-cols-7 gap-y-0.5 border-t border-rule/80 pb-1.5"
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
                    className={`group -mb-1.5 min-w-0 cursor-pointer transition-colors duration-slow ease-dadi ${
                      i > 0 ? "border-l border-rule/80" : ""
                    } ${isToday ? "bg-sage-faint/40" : "hover:bg-sage-fill/40"}`}
                  >
                    <div className="flex h-8 items-center gap-1 px-1">
                      <span
                        className={`relative flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums ${
                          isToday
                            ? "bg-ink font-medium text-bone"
                            : !inMonth
                              ? "text-ink-ghost"
                              : isPast
                                ? "text-ink-faint"
                                : "text-ink"
                        }`}
                      >
                        {day.getDate()}
                        {isToday ? <BreathRing /> : null}
                      </span>
                      <button
                        type="button"
                        aria-label={`Add to ${formatDayShort(day)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdd(day, e.currentTarget);
                        }}
                        className="ml-auto flex size-5 items-center justify-center rounded-full text-sage-deep opacity-0 transition-opacity duration-slow ease-dadi group-hover:opacity-100 hover:bg-sage-active focus-visible:opacity-100 [&>svg]:size-3"
                      >
                        <IconPlus />
                      </button>
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
                        className="mx-1 h-3 w-3/4 self-center rounded-[3px] bg-sage-fill"
                        animate={{ opacity: [0.35, 0.8, 0.35] }}
                        transition={{ duration: BREATH_S / 2, repeat: Infinity, delay: (w + i) * WAVE_STEP_S }}
                      />
                    ) : null,
                  )
                : null}

              {layout.bars.map((bar) => (
                <MonthBar
                  key={`${bar.plan.id}:${bar.from}`}
                  {...bar}
                  week={week}
                  now={now}
                  fresh={fresh.has(bar.plan.id)}
                  delay={(w + bar.from) * WAVE_STEP_S + 0.06}
                  onOpen={onOpen}
                />
              ))}

              {layout.items.flatMap((col, i) =>
                col.map(({ plan, slot }, j) => (
                  <MonthItem
                    key={`${plan.id}:${i}`}
                    plan={plan}
                    col={i}
                    slot={slot}
                    dim={!isSameMonth(week[i]!, anchor)}
                    now={now}
                    fresh={fresh.has(plan.id)}
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
                    className="mx-1 self-center justify-self-start rounded-[4px] px-1 text-[10px] text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-ink"
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
  plan: PlanNode;
  /** Slot row the bar takes, shared with every day it covers. */
  lane: number;
  /** First column (0–6) of `week` the bar covers. */
  from: number;
  /** Last column (0–6) of `week` the bar covers. */
  to: number;
  week: Date[];
  /** Ticking clock: fades the bar once its plan has ended. */
  now: Date;
  fresh: boolean;
  /** Entrance delay so the bar settles with its first day. */
  delay: number;
  onOpen: (nodeId: string, el: Element, occurrence?: PlanOccurrence) => void;
};

/**
 * One all-day or multi-day plan as a single bar across its days in the week, so its
 * title has the whole span. Ends where the plan carries into another week run square to
 * the grid edge; ends where it starts or stops are rounded and inset like the lines.
 */
function MonthBar({ plan, lane, from, to, week, now, fresh, delay, onOpen }: MonthBarProps) {
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
      onClick={(e) => onOpen(plan.id, e.currentTarget, occurrenceOf(plan))}
      style={{ gridColumn: `${from + 1} / ${to + 2}`, gridRow: lane + 2 }}
      className={`relative flex h-[18px] min-w-0 items-center px-1 text-left text-[10.5px] leading-none ${statusClass(plan.detail.status)} ${
        starts ? "ml-1 rounded-l-[6px]" : "rounded-l-none border-l-0 pl-2"
      } ${ends ? "mr-1 rounded-r-[6px]" : "rounded-r-none border-r-0"}`}
    >
      <span className="truncate">{plan.title}</span>
      {fresh ? <FreshGlow /> : null}
    </motion.button>
  );
}

type MonthItemProps = {
  plan: PlanNode;
  /** Column (0–6) the line sits in. */
  col: number;
  /** Slot row the line takes, below any bars covering its day. */
  slot: number;
  /** The day sits outside the shown month, so its line fades back. */
  dim: boolean;
  /** Ticking clock: pulses the line while its plan is happening and fades it once past. */
  now: Date;
  fresh: boolean;
  /** Entrance delay so lines settle after their day. */
  delay: number;
  onOpen: (nodeId: string, el: Element, occurrence?: PlanOccurrence) => void;
};

/**
 * One timed plan as a line: a status dot (solid confirmed, hollow tentative, live pulse
 * while it is happening), its start time and title. Fades once it has passed.
 */
function MonthItem({ plan, col, slot, dim, now, fresh, delay, onOpen }: MonthItemProps) {
  const span = spanOf(plan)!;
  const ongoing = span.start <= now && now < span.end;
  return (
    <motion.button
      type="button"
      title={plan.title}
      initial={{ opacity: 0, x: -3 }}
      animate={{ opacity: span.end < now || dim ? 0.55 : 1, x: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      onClick={(e) => onOpen(plan.id, e.currentTarget, occurrenceOf(plan))}
      style={{ gridColumn: col + 1, gridRow: slot + 2 }}
      className="relative mx-1 flex h-[18px] min-w-0 items-center gap-1 rounded-[4px] px-1 text-left text-[10.5px] leading-none transition-colors duration-slow ease-dadi hover:bg-sage-fill"
    >
      {ongoing ? (
        <LiveDot />
      ) : (
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${
            plan.detail.status === "tentative" ? "border border-sage-deep" : "bg-sage-deep"
          }`}
        />
      )}
      <span className="shrink-0 tabular-nums text-ink-muted">{formatTime(plan.occurred_at!)}</span>
      <span className="min-w-0 truncate text-ink">{plan.title}</span>
      {fresh ? <FreshGlow radius="rounded-[4px]" /> : null}
    </motion.button>
  );
}
