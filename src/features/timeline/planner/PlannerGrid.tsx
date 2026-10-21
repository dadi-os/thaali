import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import type { PlannerBlock } from "../../../types/planner";
import { isSameDay, startOfDay } from "../dates";
import { BreathRing } from "../markers";
import { axisRange, formatMinuteOfDay, formatSpan, gapsBetween, isSettled, nowAndNext, segmentsOn, type Segment } from "./blocks";
import { PlannerGlyph } from "./glyphs";
import { FREE_HATCH, KIND_BADGE, KIND_BLOCK } from "./kinds";

/** Pixels per minute on the one-day axis and on the compressed week axis. */
const DAY_PPM = 0.86;
const WEEK_PPM = 0.62;
/** Hour-label gutter and the narrowest week column, in pixels. */
const DAY_GUTTER_PX = 64;
const WEEK_GUTTER_PX = 52;
const WEEK_COLUMN_MIN_PX = 112;
/** Block heights (px) below which a block drops its note, its time line, or its words. */
const NOTE_ROOM_PX = 66;
const TIME_ROOM_PX = 40;
const WORDS_ROOM_PX = 20;
/** Gap height (px) that has room for its minute count. */
const GAP_LABEL_PX = 20;

export type PlannerGridProps = {
  /** The shown days: seven for a week, one for a day. */
  days: Date[];
  /** Weekday label per day. */
  labels: string[];
  today: Date;
  /** Ticking clock: places the now line and marks what already happened. */
  now: Date;
  blocks: PlannerBlock[];
  /** Blocks have not loaded yet. */
  loading: boolean;
  /** A block was picked; `el` anchors its card. */
  onOpen: (block: PlannerBlock, el: Element) => void;
};

/**
 * The planner's hour axis. Blocks are as tall as their time, tinted by kind and carrying
 * their glyph; unclaimed time between blocks reads as travel; today shows a now line and
 * settled blocks are checked and faded. A one-day grid is wide and shows notes; a week is
 * seven compressed columns that scroll sideways when narrow.
 */
export function PlannerGrid({ days, labels, today, now, blocks, loading, onOpen }: PlannerGridProps) {
  const week = days.length > 1;
  const ppm = week ? WEEK_PPM : DAY_PPM;
  const columns = days.map((day) => segmentsOn(blocks, day));
  const { from, to } = axisRange(columns);
  const height = (to - from) * 60 * ppm;
  const template = `${week ? WEEK_GUTTER_PX : DAY_GUTTER_PX}px repeat(${days.length}, minmax(${week ? WEEK_COLUMN_MIN_PX : 0}px, 1fr))`;
  const nowMin = (now.getTime() - startOfDay(now).getTime()) / 60_000;
  const top = (min: number) => (min - from * 60) * ppm;
  const scroller = useRef<HTMLDivElement>(null);

  const todayIndex = days.findIndex((day) => isSameDay(day, today));
  const firstStart = Math.min(...columns.flat().map((s) => s.startMin), nowMin);
  useEffect(() => {
    const focus = todayIndex >= 0 ? nowMin : firstStart;
    scroller.current?.scrollTo({ top: Math.max(0, top(focus) - 90) });
  }, []);

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-window)] border border-[var(--glass-border)] bg-[var(--glass-veil)]">
      <div className={week ? "min-w-[56rem]" : ""}>
        <div className="sticky top-0 z-20 grid border-b border-rule bg-[var(--glass-solid)]" style={{ gridTemplateColumns: template }}>
          <span aria-hidden />
          {days.map((day, i) => {
            const isToday = isSameDay(day, today);
            const focus = columns[i]!.filter((s) => ["class", "study", "exam", "recruiting"].includes(s.block.kind)).reduce((sum, s) => sum + s.endMin - s.startMin, 0);
            return (
              <div key={day.toISOString()} className="flex flex-col items-center gap-1 border-l border-rule px-1.5 py-2.5">
                <span className={`text-[11px] tracking-wide ${isToday ? "text-sage-deep" : "text-ink-ghost"}`}>{labels[i]}</span>
                <span
                  className={`relative flex size-[34px] items-center justify-center rounded-full text-[13px] ${
                    isToday ? "bg-ink text-bone" : day < today ? "text-ink-faint" : "text-ink"
                  }`}
                >
                  {day.getDate()}
                  {isToday ? <BreathRing /> : null}
                </span>
                {week ? <span className="font-numeric text-[10px] text-ink-ghost">{formatSpan(focus)} focus</span> : null}
              </div>
            );
          })}
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: template, height }}>
          <div className="relative border-r border-rule" aria-hidden>
            {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((hour) => (
              <span key={hour} className="font-numeric absolute right-2 -translate-y-1/2 text-[10px] text-ink-ghost" style={{ top: top(hour * 60) }}>
                {hour % 12 || 12} {hour >= 12 && hour < 24 ? "PM" : "AM"}
              </span>
            ))}
            {todayIndex >= 0 && nowMin >= from * 60 && nowMin <= to * 60 ? (
              <span className="font-numeric absolute right-1 z-10 -translate-y-1/2 rounded-[4px] bg-[var(--clay)] px-1 text-[9.5px] text-bone" style={{ top: top(nowMin) }}>
                {formatMinuteOfDay(Math.round(nowMin)).replace(" ", "")}
              </span>
            ) : null}
          </div>

          {days.map((day, i) => {
            const isToday = i === todayIndex;
            const segments = columns[i]!;
            const current = isToday ? nowAndNext(segments, nowMin).current : null;
            return (
              <div key={day.toISOString()} className={`relative border-l border-rule ${isToday ? "bg-sage-faint/40" : ""}`}>
                {Array.from({ length: to - from - 1 }, (_, k) => from + k + 1).map((hour) => (
                  <span key={hour} aria-hidden className="absolute inset-x-0 border-t border-rule/70" style={{ top: top(hour * 60) }} />
                ))}
                {loading
                  ? null
                  : gapsBetween(segments).map((gap) => (
                      <div
                        key={gap.startMin}
                        aria-hidden
                        className="pointer-events-none absolute inset-x-1.5 flex items-center"
                        style={{ top: top(gap.startMin), height: (gap.endMin - gap.startMin) * ppm }}
                      >
                        <span className="absolute inset-y-0.5 left-[22px] border-l-[1.5px] border-dotted border-sage-line" />
                        {!week && (gap.endMin - gap.startMin) * ppm >= GAP_LABEL_PX ? (
                          <span className="font-numeric relative ml-[34px] rounded-full bg-bone px-1.5 text-[10px] text-ink-ghost">{gap.endMin - gap.startMin} min</span>
                        ) : null}
                      </div>
                    ))}
                {loading
                  ? null
                  : segments.map((segment, k) => (
                      <PlannerBlockButton
                        key={segment.block.id}
                        segment={segment}
                        top={top(segment.startMin)}
                        ppm={ppm}
                        week={week}
                        settled={isSettled(segment.block, now)}
                        current={current?.block.id === segment.block.id}
                        delay={k * 0.018}
                        onOpen={onOpen}
                      />
                    ))}
                {isToday && nowMin >= from * 60 && nowMin <= to * 60 ? (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowMin) }}>
                    <span className="-ml-1 size-2 shrink-0 rounded-full bg-[var(--clay)]" />
                    <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--clay)_60%,transparent)]" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type PlannerBlockButtonProps = {
  segment: Segment;
  /** Pixel offset of the block's start from the top of the axis. */
  top: number;
  ppm: number;
  week: boolean;
  /** Marked done or already over. */
  settled: boolean;
  /** It is the block happening now. */
  current: boolean;
  /** Entrance delay so a column's blocks settle in order. */
  delay: number;
  onOpen: (block: PlannerBlock, el: Element) => void;
};

/** One block on the axis: icon badge, title, time and note as the height allows. */
function PlannerBlockButton({ segment, top, ppm, week, settled, current, delay, onOpen }: PlannerBlockButtonProps) {
  const { block, startMin, endMin, lane, lanes } = segment;
  const height = Math.max((endMin - startMin) * ppm - 2, 16);
  const tight = !week && height < TIME_ROOM_PX;
  const mini = week && height < TIME_ROOM_PX - 6;
  const iconOnly = week && height < WORDS_ROOM_PX;
  const badge = iconOnly ? 18 : tight || mini ? 20 : 26;
  const hatch = block.kind === "free" ? { backgroundImage: FREE_HATCH } : undefined;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: settled ? 0.55 : 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.99 }}
      onClick={(e) => onOpen(block, e.currentTarget)}
      aria-label={`${block.title}, ${formatMinuteOfDay(startMin)} to ${formatMinuteOfDay(endMin)}`}
      className={`absolute flex overflow-hidden rounded-[9px] border text-left transition-shadow duration-slow ease-dadi hover:z-10 hover:shadow-[var(--shadow)] ${KIND_BLOCK[block.kind]} ${
        block.kind === "exam" ? "border-[3px] border-double" : ""
      } ${current ? "ring-2 ring-[color-mix(in_srgb,var(--clay)_30%,transparent)] !border-[var(--clay)]" : ""} ${
        iconOnly ? "items-center justify-center" : tight || mini ? "items-center gap-2 px-2" : "items-start gap-2.5 px-2.5 py-1.5"
      }`}
      style={{ top: top + 1, height, left: `calc(${(lane / lanes) * 100}% + 6px)`, width: `calc(${100 / lanes}% - 12px)`, ...hatch }}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border ${
          settled ? "border-sage bg-sage text-bone" : `bg-bone ${KIND_BADGE[block.kind]}`
        }`}
        style={{ width: badge, height: badge }}
      >
        <PlannerGlyph icon={block.icon} size={iconOnly ? 10 : tight || mini ? 11 : 14} />
      </span>
      {iconOnly ? null : (
        <span className={`flex min-w-0 flex-1 ${tight ? "items-baseline gap-2" : "flex-col gap-px"}`}>
          <span className={`truncate font-medium text-ink ${mini ? "text-[11px]" : "text-[13px]"}`}>{block.title}</span>
          {mini ? null : (
            <span className="font-numeric truncate text-[11px] text-ink-muted">
              {week ? formatMinuteOfDay(startMin).replace(" ", "") : `${formatMinuteOfDay(startMin)} to ${formatMinuteOfDay(endMin)}`}
            </span>
          )}
          {!week && block.note && height >= NOTE_ROOM_PX ? (
            <span className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-ink-muted">{block.note}</span>
          ) : null}
        </span>
      )}
    </motion.button>
  );
}
