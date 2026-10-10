import { motion } from "motion/react";
import type { NodeRecord } from "../../types/yaad";
import { IconPlus } from "../../shared/components/IconButton";
import { BREATH_S, EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatDayShort, formatTime, isSameDay, isSameMonth } from "./dates";
import { BreathRing, FreshGlow, LiveDot } from "./markers";
import {
  memoriesOn,
  occurrenceOf,
  plansOn,
  runsAsBar,
  spanLanes,
  spanOf,
  type PlanNode,
  type PlanOccurrence,
} from "./plans";
import { SpanLaneCell } from "./SpanLaneCell";

/** Delay per diagonal step as the grid washes in from the top-left. */
const WAVE_STEP_S = 0.018;
/** Timed plans listed per day before "+N more" hands off to the week view. */
const ITEMS_SHOWN = 4;
/** Memory dots drawn beside a date. */
const DOTS_SHOWN = 4;

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
  /** Memories of things that happened, drawn as dots beside their date. */
  memories: NodeRecord[];
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
 * Month grid laid out as week rows. All-day and multi-day plans run as bars across each
 * row like the week view; timed plans list under them as time-and-title lines that open
 * their popover. Rows share the height and grow when a week is busy, scrolling the grid
 * rather than hiding plans; past `ITEMS_SHOWN` a day offers "+N more" into its week.
 * Clicking a day opens its week, its + quick-adds to it, and today breathes.
 */
export function MonthView({
  days,
  anchor,
  labels,
  today,
  now,
  plans,
  memories,
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
          const lanes = spanLanes(plans, week);
          return (
            <div key={week[0]!.toISOString()} className="grid grid-cols-7 border-t border-rule/80">
              {week.map((day, i) => {
                const inMonth = isSameMonth(day, anchor);
                const isToday = isSameDay(day, today);
                const isPast = day < today;
                const timed = plansOn(plans, day).filter((p) => !runsAsBar(p));
                const shown = timed.length > ITEMS_SHOWN ? timed.slice(0, ITEMS_SHOWN - 1) : timed;
                const dayMemories = memoriesOn(memories, day);
                const delay = (w + i) * WAVE_STEP_S;
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
                    transition={{ duration: SLOW_S, ease: EASE, delay }}
                    className={`group flex min-h-[88px] min-w-0 cursor-pointer flex-col px-1.5 pt-1 pb-1.5 transition-colors duration-slow ease-dadi ${
                      i > 0 ? "border-l border-rule/80" : ""
                    } ${isToday ? "bg-sage-faint/40" : "hover:bg-sage-fill/40"}`}
                  >
                    <div className="mb-1 flex items-center gap-1">
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
                      {dayMemories.length > 0 ? (
                        <span
                          className="flex items-center gap-0.5"
                          title={`${dayMemories.length} ${dayMemories.length === 1 ? "memory" : "memories"}`}
                        >
                          {dayMemories.slice(0, DOTS_SHOWN).map((m) => (
                            <span key={m.id} aria-hidden className="size-1 rounded-full bg-ink-faint" />
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
                        className="ml-auto flex size-5 items-center justify-center rounded-full text-sage-deep opacity-0 transition-opacity duration-slow ease-dadi group-hover:opacity-100 hover:bg-sage-active focus-visible:opacity-100 [&>svg]:size-3"
                      >
                        <IconPlus />
                      </button>
                    </div>

                    {lanes.length > 0 ? (
                      <div className={`mb-1 flex flex-col gap-0.5 ${inMonth ? "" : "opacity-60"}`}>
                        {lanes.map((lane, r) => (
                          <SpanLaneCell
                            key={r}
                            lane={lane}
                            day={day}
                            first={i === 0}
                            now={now}
                            delay={delay + 0.06}
                            onOpen={onOpen}
                          />
                        ))}
                      </div>
                    ) : null}

                    <div className={`flex min-w-0 flex-col gap-px ${inMonth ? "" : "opacity-60"}`}>
                      {loading && inMonth ? (
                        <motion.span
                          className="h-3 w-3/4 rounded-[3px] bg-sage-fill"
                          animate={{ opacity: [0.35, 0.8, 0.35] }}
                          transition={{ duration: BREATH_S / 2, repeat: Infinity, delay }}
                        />
                      ) : (
                        shown.map((p, j) => (
                          <MonthItem
                            key={p.id}
                            plan={p}
                            now={now}
                            fresh={fresh.has(p.id)}
                            delay={delay + 0.08 + j * 0.03}
                            onOpen={onOpen}
                          />
                        ))
                      )}
                      {!loading && timed.length > shown.length ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDay(day);
                          }}
                          className="self-start rounded-[4px] px-1 text-[10px] text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-ink"
                        >
                          +{timed.length - shown.length} more
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type MonthItemProps = {
  plan: PlanNode;
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
function MonthItem({ plan, now, fresh, delay, onOpen }: MonthItemProps) {
  const span = spanOf(plan)!;
  const ongoing = span.start <= now && now < span.end;
  return (
    <motion.button
      type="button"
      title={plan.title}
      initial={{ opacity: 0, x: -3 }}
      animate={{ opacity: span.end < now ? 0.55 : 1, x: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(plan.id, e.currentTarget, occurrenceOf(plan));
      }}
      className="relative flex h-[18px] min-w-0 items-center gap-1 rounded-[4px] px-1 text-left text-[10.5px] leading-none transition-colors duration-slow ease-dadi hover:bg-sage-fill"
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
