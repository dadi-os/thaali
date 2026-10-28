import { motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import type { TimelineItem } from "../../../types/timeline";
import { addDays, formatTime, isSameDay, startOfDay } from "../dates";
import {
  axisRange,
  formatClockCompact,
  formatMinuteOfDay,
  formatRange,
  formatSpan,
  gapsBetween,
  isSettled,
  nowAndNext,
  segmentsOn,
  type Segment,
} from "./blocks";
import { KIND_TONE, TONE_CLASS } from "./kinds";
import { SessionMark } from "../markers";
import { itemKey } from "../plans";

/** Pixels per minute on the axis. */
const PPM = 0.9;
/** Gutter holding the hour labels, in pixels. */
const GUTTER_PX = 52;
/** Block heights (px) below which a block is one row, and from which it shows its note. */
const ONE_ROW_PX = 52;
const NOTE_ROOM_PX = 80;
/** Gap length (minutes) from which the open time is named. */
const GAP_NAMED_MIN = 30;
/** Tasks of the next day the side column previews. */
const AFTER_SHOWN = 4;

export type PlannerDayProps = {
  /** The shown day. */
  day: Date;
  today: Date;
  /** Ticking clock: places the now pill and fades what already happened. */
  now: Date;
  /** Planner sessions of the shown day and the day after it. */
  blocks: TimelineItem[];
  /** Deadlines with no time set aside (Yaad's due view); each one due on this day is a clay line at its time. */
  dues: TimelineItem[];
  /** Sessions have not loaded yet. */
  loading: boolean;
  /** A session was picked; `el` anchors its card. */
  onOpen: (block: TimelineItem, el: Element) => void;
};

/**
 * The planner: one day drawn straight on the page. On the left the day is named and its
 * sessions sit on an hour axis as tall as their time, each one row of title and time with its
 * body under it, commitments solid and routines quiet, cancelled ones struck through, the
 * time between them left open.
 * On a wide window a column on the right keeps what matters in view: what is happening now
 * and what is next, the day's tasks with their lengths, and the start of the next day.
 */
export function PlannerDay({ day, today, now, blocks, dues, loading, onOpen }: PlannerDayProps) {
  const isToday = isSameDay(day, today);
  const segments = segmentsOn(blocks, day);
  const after = segmentsOn(blocks, addDays(day, 1));
  const { from, to } = axisRange([segments]);
  const dueMarks = dues
    .filter((due) => due.due_at !== null && due.start_at === null && isSameDay(new Date(due.due_at), day))
    .map((due) => ({ due, min: (new Date(due.due_at!).getTime() - startOfDay(day).getTime()) / 60_000 }))
    .filter(({ min }) => min >= from * 60 && min <= to * 60);
  const nowMin = (now.getTime() - startOfDay(now).getTime()) / 60_000;
  const { current, next } = isToday ? nowAndNext(segments, nowMin) : { current: null, next: null };
  const top = (min: number) => (min - from * 60) * PPM;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focus = isToday ? nowMin : (segments[0]?.startMin ?? from * 60);
    scroller.current?.scrollTo({ top: Math.max(0, top(focus) - 140) });
  }, []);

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-[78rem] flex-1 grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,44rem)_minmax(17rem,22rem)]">
        <div ref={scroller} className="min-h-0 overflow-y-auto px-2 pt-4 pb-20 [scrollbar-width:thin]">
          <header className="mb-8 flex items-baseline gap-3.5">
            <h2 className="text-[40px] leading-[1] font-semibold tracking-[-0.025em] text-ink">
              {new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(day)}
            </h2>
            <p className="text-[12px] font-semibold tracking-[2px] text-ink-ghost uppercase">
              {new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(day)}
            </p>
          </header>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((k) => (
                <motion.div
                  key={k}
                  className="h-14 rounded-[14px] bg-sage-fill"
                  animate={{ opacity: [0.35, 0.8, 0.35] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: k * 0.12 }}
                />
              ))}
            </div>
          ) : segments.length === 0 ? (
            <div className="flex min-h-[12rem] flex-col gap-1.5 pt-2">
              <p className="text-[15px] font-medium text-ink">Nothing planned</p>
              <p className="max-w-sm text-[13px] leading-relaxed text-ink-ghost">What needs to happen on this day shows here once it is planned.</p>
            </div>
          ) : (
            <div className="relative" style={{ height: (to - from) * 60 * PPM }}>
              {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((hour) => (
                <span
                  key={hour}
                  aria-hidden
                  className="absolute left-0 -translate-y-1/2 text-[11px] tabular-nums text-ink-ghost"
                  style={{ top: top(hour * 60) }}
                >
                  {hour % 12 || 12} {hour >= 12 && hour < 24 ? "PM" : "AM"}
                </span>
              ))}
              <div className="absolute inset-y-0 right-0" style={{ left: GUTTER_PX }}>
                {gapsBetween(segments)
                  .filter((gap) => gap.endMin - gap.startMin >= GAP_NAMED_MIN)
                  .filter((gap) => !dueMarks.some(({ min }) => Math.abs(min - (gap.startMin + gap.endMin) / 2) < 25))
                  .map((gap) => (
                    <span
                      key={gap.startMin}
                      aria-hidden
                      className="absolute left-4 -translate-y-1/2 text-[11px] tabular-nums text-ink-ghost"
                      style={{ top: top((gap.startMin + gap.endMin) / 2) }}
                    >
                      {formatSpan(gap.endMin - gap.startMin)} open
                    </span>
                  ))}
                {segments.map((segment, k) => (
                  <BlockRow
                    key={itemKey(segment.block)}
                    segment={segment}
                    top={top(segment.startMin)}
                    settled={isSettled(segment.block, now)}
                    now={now}
                    current={current !== null && itemKey(current.block) === itemKey(segment.block)}
                    delay={k * 0.02}
                    onOpen={onOpen}
                  />
                ))}
                {dueMarks.map(({ due, min }) => (
                  <button
                    key={itemKey(due)}
                    type="button"
                    onClick={(e) => onOpen(due, e.currentTarget)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onOpen(due, e.currentTarget);
                    }}
                    className="absolute right-0 z-[5] flex -translate-y-1/2 items-center gap-2 text-left"
                    style={{ top: top(min), left: 0 }}
                  >
                    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--clay)_18%,transparent)] px-2 py-[2px] text-[10.5px] font-semibold tabular-nums text-[color-mix(in_srgb,var(--clay)_70%,var(--ink))]">
                      due {formatTime(due.due_at!)}
                    </span>
                    <span className="truncate text-[12px] text-ink-muted">{due.title}</span>
                    <span className="h-px min-w-6 flex-1 border-t border-dashed border-[color-mix(in_srgb,var(--clay)_55%,transparent)]" />
                  </button>
                ))}
                {isToday && nowMin >= from * 60 && nowMin <= to * 60 ? (
                  <div aria-hidden className="pointer-events-none absolute right-0 z-10 flex -translate-y-1/2 items-center" style={{ top: top(nowMin), left: -GUTTER_PX }}>
                    <span className="w-[46px] shrink-0 rounded-full bg-[var(--clay)] py-[3px] text-center text-[10.5px] font-semibold tabular-nums text-bone shadow-[var(--shadow)]">
                      {formatClockCompact(Math.round(nowMin))}
                    </span>
                    <span className="ml-1.5 h-[2px] flex-1 rounded-full bg-gradient-to-r from-[var(--clay)] via-[var(--clay)]/40 to-transparent" />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {!loading ? (
          <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto pt-5 pb-6 [scrollbar-width:none] lg:flex" aria-label="The day at a glance">
            {isToday ? <Focus current={current} next={next} nowMin={nowMin} onOpen={onOpen} /> : null}
            {segments.length > 0 ? <DayList segments={segments} current={current} now={now} onOpen={onOpen} /> : null}
            {after.length > 0 ? <After day={addDays(day, 1)} segments={after} onOpen={onOpen} /> : null}
          </aside>
        ) : null}
    </div>
  );
}

type SectionProps = {
  label: string;
  children: ReactNode;
};

/** One card of the side column, as on the canvas: a glass card with a small spaced label over its content. */
function Section({ label, children }: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      className="shrink-0 rounded-[16px] border border-(--glass-border) bg-(--glass-veil) px-[18px] py-4 shadow-[0_1px_2px_rgba(92,107,82,0.05),0_10px_30px_rgba(44,48,42,0.05)]"
    >
      <h3 className="mb-3 text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost uppercase">{label}</h3>
      {children}
    </motion.section>
  );
}

type FocusProps = {
  current: Segment | null;
  next: Segment | null;
  nowMin: number;
  onOpen: (block: TimelineItem, el: Element) => void;
};

/** What is happening now, with its time left and a thin progress line, and what is next. */
function Focus({ current, next, nowMin, onOpen }: FocusProps) {
  if (current === null && next === null) {
    return (
      <Section label="Now">
        <p className="text-[15px] text-ink-muted">Nothing left today.</p>
      </Section>
    );
  }
  return (
    <Section label={current !== null ? "Now" : "Next"}>
      {current !== null ? (
        <button type="button" onClick={(e) => onOpen(current.block, e.currentTarget)} onContextMenu={(e) => { e.preventDefault(); onOpen(current.block, e.currentTarget); }} className="block w-full text-left">
          <p className="text-[22px] leading-[1.2] font-medium tracking-[-0.01em] text-ink">{current.block.title}</p>
          <p className="mt-1.5 text-[13px] tabular-nums text-ink-muted">{formatRange(current.startMin, current.endMin)}</p>
          <span className="mt-4 block h-[3px] overflow-hidden rounded-full bg-rule">
            <span
              className="block h-full rounded-full bg-sage-deep transition-[width] duration-slow ease-dadi"
              style={{ width: `${((nowMin - current.startMin) / (current.endMin - current.startMin)) * 100}%` }}
            />
          </span>
          <p className="mt-2 text-[12px] tabular-nums text-ink-muted">{formatSpan(current.endMin - nowMin)} left</p>
          {current.block.body ? <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-ink-muted">{current.block.body}</p> : null}
        </button>
      ) : null}
      {next !== null ? (
        <button type="button" onClick={(e) => onOpen(next.block, e.currentTarget)} onContextMenu={(e) => { e.preventDefault(); onOpen(next.block, e.currentTarget); }} className={`block w-full text-left ${current !== null ? "mt-7" : ""}`}>
          {current !== null ? <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-ink-ghost uppercase">Next</p> : null}
          <p className={current !== null ? "text-[15px] font-medium text-ink" : "text-[22px] leading-[1.2] font-medium tracking-[-0.01em] text-ink"}>
            {next.block.title}
          </p>
          <p className="mt-1 text-[13px] tabular-nums text-ink-muted">
            {formatMinuteOfDay(next.startMin)} · in {formatSpan(next.startMin - nowMin)}
          </p>
        </button>
      ) : null}
    </Section>
  );
}

type DayListProps = {
  segments: Segment[];
  /** The block happening now, if the day is today. */
  current: Segment | null;
  now: Date;
  onOpen: (block: TimelineItem, el: Element) => void;
};

/** The day's tasks in order with their lengths and Completed circles; completed ones are struck through, past ones fade. */
function DayList({ segments, current, now, onOpen }: DayListProps) {
  const planned = segments.reduce((sum, s) => sum + s.endMin - s.startMin, 0);
  return (
    <Section label={`The day · ${segments.length} ${segments.length === 1 ? "task" : "tasks"} · ${formatSpan(planned)}`}>
      <div className="mb-2.5 flex gap-[3px]" aria-hidden>
        {segments.map((segment) => (
          <span
            key={itemKey(segment.block)}
            className={`h-[5px] rounded-[3px] ${
              segment.block.outcome === "done"
                ? "bg-[var(--clay)]"
                : isSettled(segment.block, now)
                  ? "bg-[repeating-linear-gradient(90deg,var(--ink-faint)_0_3px,transparent_3px_5px)] opacity-60"
                  : current !== null && itemKey(current.block) === itemKey(segment.block)
                    ? "bg-sage"
                    : "bg-rule"
            }`}
            style={{ flex: segment.endMin - segment.startMin }}
          />
        ))}
      </div>
      <ul className="flex flex-col">
        {segments.map((segment) => {
          const settled = isSettled(segment.block, now);
          const live = current !== null && itemKey(current.block) === itemKey(segment.block);
          return (
            <li key={itemKey(segment.block)}>
              <button
                type="button"
                onClick={(e) => onOpen(segment.block, e.currentTarget)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpen(segment.block, e.currentTarget);
                }}
                className="-mx-2.5 grid w-[calc(100%+1.25rem)] grid-cols-[4.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-[9px] px-2.5 py-[7px] text-left transition-colors duration-slow ease-dadi hover:bg-sage-fill"
              >
                <span className="text-[12px] tabular-nums text-ink-ghost">{formatMinuteOfDay(segment.startMin)}</span>
                <span
                  className={`truncate text-[13.5px] ${segment.block.outcome === "done" ? "text-ink-ghost line-through decoration-ink-ghost/50" : settled ? "text-ink-muted" : live ? "font-medium text-ink" : "text-ink"}`}
                >
                  {segment.block.title}
                </span>
                <span className="text-[11.5px] tabular-nums text-ink-ghost">{formatSpan(segment.endMin - segment.startMin)}</span>
                <SessionMark item={segment.block} now={now} className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

type AfterProps = {
  /** The day after the shown one. */
  day: Date;
  segments: Segment[];
  onOpen: (block: TimelineItem, el: Element) => void;
};

/** The first tasks of the next day, so the evening can end knowing how tomorrow starts. */
function After({ day, segments, onOpen }: AfterProps) {
  const shown = segments.slice(0, AFTER_SHOWN);
  return (
    <Section label={new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(day)}>
      <ul className="flex flex-col">
        {shown.map((segment) => (
          <li key={itemKey(segment.block)}>
            <button
              type="button"
              onClick={(e) => onOpen(segment.block, e.currentTarget)}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpen(segment.block, e.currentTarget);
              }}
              className="-mx-2.5 grid w-[calc(100%+1.25rem)] grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-x-3 rounded-[9px] px-2.5 py-[7px] text-left transition-colors duration-slow ease-dadi hover:bg-sage-fill"
            >
              <span className="text-[12px] tabular-nums text-ink-ghost">{formatMinuteOfDay(segment.startMin)}</span>
              <span className="truncate text-[13.5px] text-ink">{segment.block.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {segments.length > shown.length ? <p className="mt-1 text-[12px] text-ink-ghost">+{segments.length - shown.length} more</p> : null}
    </Section>
  );
}

type BlockRowProps = {
  segment: Segment;
  /** Pixel offset of the block's start from the top of the axis. */
  top: number;
  /** Marked done or already over. */
  settled: boolean;
  /** Ticking clock for its Completed circle. */
  now: Date;
  /** It is the block happening now. */
  current: boolean;
  /** Entrance delay so blocks settle in order. */
  delay: number;
  onOpen: (block: TimelineItem, el: Element) => void;
};

/** One session: title and time on one row, with its body under them when the height allows. */
function BlockRow({ segment, top, settled, now, current, delay, onOpen }: BlockRowProps) {
  const { block, startMin, endMin, lane, lanes } = segment;
  const height = Math.max((endMin - startMin) * PPM - 4, 26);
  const oneRow = height < ONE_ROW_PX;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: settled && !current ? 0.45 : 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.995 }}
      onClick={(e) => onOpen(block, e.currentTarget)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpen(block, e.currentTarget);
      }}
      aria-label={`${block.title}, ${formatRange(startMin, endMin)}`}
      className={`absolute flex overflow-hidden rounded-[14px] px-4 text-left transition-shadow duration-slow ease-dadi hover:z-10 hover:shadow-[var(--shadow)] ${
        TONE_CLASS[block.kind === null ? "solid" : KIND_TONE[block.kind]]
      } ${current ? "ring-1 ring-sage-deep/60" : ""} ${block.state === "cancelled" ? "line-through" : ""} ${oneRow ? "items-center" : "items-start pt-3.5"}`}
      style={{ top: top + 2, height, left: `calc(${(lane / lanes) * 100}% + 0px)`, width: `calc(${100 / lanes}% - 6px)` }}
    >
      <span className="flex w-full min-w-0 gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-4">
            <span className="truncate text-[14px] leading-5 font-medium tracking-[-0.005em] text-ink">{block.title}</span>
            <span className="ml-auto shrink-0 text-[12px] leading-5 tabular-nums text-ink-muted">{formatRange(startMin, endMin)}</span>
            <span className="flex h-5 shrink-0 items-center">
              <SessionMark item={block} now={now} />
            </span>
          </span>
          {!oneRow && block.body && height >= NOTE_ROOM_PX ? (
            <span className="mt-1.5 line-clamp-2 block text-[12.5px] leading-[1.5] text-ink-muted">{block.body}</span>
          ) : null}
        </span>
      </span>
    </motion.button>
  );
}
