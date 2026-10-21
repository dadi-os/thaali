import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import type { PlannerBlock } from "../../../types/planner";
import { isSameDay, startOfDay } from "../dates";
import { axisRange, formatMinuteOfDay, formatSpan, gapsBetween, isSettled, nowAndNext, segmentsOn, type Segment } from "./blocks";
import { PlannerGlyph } from "./glyphs";
import { KIND_TONE, TONE_CLASS } from "./kinds";

/** Pixels per minute on the axis. */
const PPM = 0.9;
/** Gutter holding the hour labels, in pixels. */
const GUTTER_PX = 52;
/** Block heights (px) below which a block shows one line, and from which it shows its note. */
const ONE_LINE_PX = 60;
const NOTE_ROOM_PX = 92;
/** Gap length (minutes) from which the open time is named. */
const GAP_NAMED_MIN = 30;

export type PlannerDayProps = {
  /** The shown day. */
  day: Date;
  today: Date;
  /** Ticking clock: places the now line and fades what already happened. */
  now: Date;
  blocks: PlannerBlock[];
  /** Blocks have not loaded yet. */
  loading: boolean;
  /** A block was picked; `el` anchors its card. */
  onOpen: (block: PlannerBlock, el: Element) => void;
};

/**
 * The planner: one day drawn straight on the page, with no panel around it. The day is named
 * large, with what is happening now and what comes next beneath it; below, the blocks sit on
 * an hour axis as tall as their time, fixed commitments solid and the rest quiet, with the
 * time between them left as open space. On a wide window the day's tasks also run down the
 * right as a plain list that stays in view. The region scrolls as the page does.
 */
export function PlannerDay({ day, today, now, blocks, loading, onOpen }: PlannerDayProps) {
  const isToday = isSameDay(day, today);
  const segments = segmentsOn(blocks, day);
  const { from, to } = axisRange([segments]);
  const nowMin = (now.getTime() - startOfDay(now).getTime()) / 60_000;
  const { current, next } = isToday ? nowAndNext(segments, nowMin) : { current: null, next: null };
  const top = (min: number) => (min - from * 60) * PPM;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focus = isToday ? nowMin : (segments[0]?.startMin ?? from * 60);
    scroller.current?.scrollTo({ top: Math.max(0, top(focus) - 140) });
  }, []);

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
      <div className="mx-auto grid w-full max-w-[76rem] grid-cols-1 gap-x-20 px-2 pt-4 pb-20 lg:grid-cols-[minmax(0,46rem)_minmax(14rem,1fr)]">
        <div>
        <header className="mb-9">
          <p className="text-[11px] font-medium tracking-[0.16em] text-ink-ghost uppercase">
            {new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(day)}
          </p>
          <h2 className="mt-2 text-[36px] leading-none font-light tracking-tight text-ink">
            {new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(day)}
          </h2>
          {isToday && !loading ? (
            <div className="mt-4 flex flex-col gap-1 text-[13px]">
              {current !== null ? (
                <p className="flex items-center gap-2 text-ink">
                  <span className="relative size-[7px] shrink-0 rounded-full bg-sage-deep">
                    <span className="animate-pulse-out absolute inset-0 rounded-full bg-sage-deep" />
                  </span>
                  <span className="font-medium">{current.block.title}</span>
                  <span className="font-numeric text-ink-muted">{formatSpan(current.endMin - nowMin)} left</span>
                </p>
              ) : null}
              {next !== null ? (
                <p className="text-ink-muted">
                  Next · {next.block.title} · <span className="font-numeric">{formatMinuteOfDay(next.startMin)}</span> · in {formatSpan(next.startMin - nowMin)}
                </p>
              ) : current === null ? (
                <p className="text-ink-muted">Nothing left today</p>
              ) : null}
            </div>
          ) : null}
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
          <div className="flex min-h-[12rem] flex-col gap-1.5 pt-6">
            <p className="text-[15px] text-ink">Nothing planned</p>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-ghost">What needs to happen on this day shows here once it is planned.</p>
          </div>
        ) : (
          <div className="relative" style={{ height: (to - from) * 60 * PPM }}>
            {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((hour) => (
              <span
                key={hour}
                aria-hidden
                className="font-numeric absolute left-0 -translate-y-1/2 text-[10.5px] text-ink-ghost"
                style={{ top: top(hour * 60) }}
              >
                {hour % 12 || 12} {hour >= 12 && hour < 24 ? "PM" : "AM"}
              </span>
            ))}
            <div className="absolute inset-y-0 right-0" style={{ left: GUTTER_PX }}>
              {gapsBetween(segments)
                .filter((gap) => gap.endMin - gap.startMin >= GAP_NAMED_MIN)
                .map((gap) => (
                  <span
                    key={gap.startMin}
                    aria-hidden
                    className="font-numeric absolute left-4 -translate-y-1/2 text-[10.5px] text-ink-ghost"
                    style={{ top: top((gap.startMin + gap.endMin) / 2) }}
                  >
                    {formatSpan(gap.endMin - gap.startMin)} open
                  </span>
                ))}
              {segments.map((segment, k) => (
                <BlockRow
                  key={segment.block.id}
                  segment={segment}
                  top={top(segment.startMin)}
                  settled={isSettled(segment.block, now)}
                  current={current?.block.id === segment.block.id}
                  delay={k * 0.02}
                  onOpen={onOpen}
                />
              ))}
              {isToday && nowMin >= from * 60 && nowMin <= to * 60 ? (
                <div aria-hidden className="pointer-events-none absolute right-0 z-10 flex -translate-y-1/2 items-center" style={{ top: top(nowMin), left: -GUTTER_PX }}>
                  <span className="font-numeric w-[46px] shrink-0 rounded-full bg-ink py-[3px] text-center text-[10.5px] font-medium text-bone shadow-[var(--shadow)]">
                    {formatMinuteOfDay(Math.round(nowMin)).replace(" ", "")}
                  </span>
                  <span className="ml-1.5 h-[2px] flex-1 rounded-full bg-gradient-to-r from-ink/80 via-ink/25 to-transparent" />
                </div>
              ) : null}
            </div>
          </div>
        )}
        </div>

        {!loading && segments.length > 0 ? <DayList segments={segments} current={current} now={now} onOpen={onOpen} /> : null}
      </div>
    </div>
  );
}

type DayListProps = {
  segments: Segment[];
  /** The block happening now, if the day is today. */
  current: Segment | null;
  now: Date;
  onOpen: (block: PlannerBlock, el: Element) => void;
};

/** The day's tasks in order as a plain list beside the timeline, shown on wide windows; done ones fade. */
function DayList({ segments, current, now, onOpen }: DayListProps) {
  const planned = segments.reduce((sum, s) => sum + s.endMin - s.startMin, 0);
  return (
    <aside className="sticky top-4 hidden self-start lg:block" aria-label="The day's tasks">
      <p className="text-[11px] font-medium tracking-[0.16em] text-ink-ghost uppercase">The day</p>
      <p className="font-numeric mt-2 text-[12.5px] text-ink-muted">
        {segments.length} {segments.length === 1 ? "task" : "tasks"} · {formatSpan(planned)} planned
      </p>
      <ul className="mt-6 flex flex-col gap-1">
        {segments.map((segment) => {
          const settled = isSettled(segment.block, now);
          const live = current?.block.id === segment.block.id;
          return (
            <li key={segment.block.id}>
              <button
                type="button"
                onClick={(e) => onOpen(segment.block, e.currentTarget)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-slow ease-dadi hover:bg-sage-fill"
              >
                <span className="font-numeric w-[4.25rem] shrink-0 text-[11.5px] text-ink-ghost">{formatMinuteOfDay(segment.startMin)}</span>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${settled ? "text-ink-ghost line-through decoration-ink-ghost/50" : live ? "font-medium text-ink" : "text-ink"}`}>
                  {segment.block.title}
                </span>
                {live ? <span className="size-1.5 shrink-0 self-center rounded-full bg-[var(--clay)]" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

type BlockRowProps = {
  segment: Segment;
  /** Pixel offset of the block's start from the top of the axis. */
  top: number;
  /** Marked done or already over. */
  settled: boolean;
  /** It is the block happening now. */
  current: boolean;
  /** Entrance delay so blocks settle in order. */
  delay: number;
  onOpen: (block: PlannerBlock, el: Element) => void;
};

/** One block: its glyph, title and time, with its note when the height allows. */
function BlockRow({ segment, top, settled, current, delay, onOpen }: BlockRowProps) {
  const { block, startMin, endMin, lane, lanes } = segment;
  const height = Math.max((endMin - startMin) * PPM - 4, 26);
  const oneLine = height < ONE_LINE_PX;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: settled && !current ? 0.45 : 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.995 }}
      onClick={(e) => onOpen(block, e.currentTarget)}
      aria-label={`${block.title}, ${formatMinuteOfDay(startMin)} to ${formatMinuteOfDay(endMin)}`}
      className={`absolute flex overflow-hidden rounded-[14px] px-4 text-left transition-shadow duration-slow ease-dadi hover:z-10 hover:shadow-[var(--shadow)] ${
        TONE_CLASS[KIND_TONE[block.kind]]
      } ${current ? "ring-1 ring-sage-deep/60" : ""} ${oneLine ? "items-center gap-3.5" : "items-start gap-3.5 pt-3 pb-2.5"}`}
      style={{ top: top + 2, height, left: `calc(${(lane / lanes) * 100}% + 0px)`, width: `calc(${100 / lanes}% - 6px)` }}
    >
      <span className={`shrink-0 text-sage-deep/70 ${oneLine ? "" : "mt-px"}`}>
        <PlannerGlyph icon={block.icon} size={16} />
      </span>
      <span className={`flex min-w-0 flex-1 ${oneLine ? "items-center justify-between gap-4" : "flex-col"}`}>
        <span className="truncate text-[14px] leading-[1.25] font-medium text-ink">{block.title}</span>
        <span className={`font-numeric shrink-0 text-[11.5px] leading-none text-ink-muted ${oneLine ? "" : "mt-1.5"}`}>
          {formatMinuteOfDay(startMin)} to {formatMinuteOfDay(endMin)}
        </span>
        {!oneLine && block.note && height >= NOTE_ROOM_PX ? (
          <span className="mt-2.5 line-clamp-2 text-[12.5px] leading-[1.45] text-ink-muted">{block.note}</span>
        ) : null}
      </span>
    </motion.button>
  );
}
