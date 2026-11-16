/** Pure planner logic: a day's plans as segments on a minute axis, their lanes, gaps, and what is now and next. */

import type { Plan } from "../../types/planner";
import { addDays, startOfDay, wallMinutes } from "./dates";
import { clockChange } from "./zones";


/** Hours the axis shows on a day with no blocks. */
const EMPTY_FROM_HOUR = 7;
const EMPTY_TO_HOUR = 22;

/** One block's part of one day, in minutes after local midnight, with its side-by-side lane. */
export type Segment = {
  block: Plan;
  startMin: number;
  endMin: number;
  /** Lane among the blocks it overlaps, and how many lanes that overlapping group has. */
  lane: number;
  lanes: number;
};

/** Unclaimed time between two blocks, in minutes after local midnight. */
export type Gap = { startMin: number; endMin: number };

/**
 * `day`'s part of every timed plan that touches it, earliest first, with overlapping
 * plans in side-by-side lanes. A plan with no end is left out: it has no extent to draw.
 */
export function segmentsOn(blocks: Plan[], day: Date): Segment[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const repeated =
    new Date(dayStart).getTimezoneOffset() <
    new Date(dayEnd).getTimezoneOffset()
      ? clockChange(
          new Date(dayStart),
          new Date(dayEnd),
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )
      : null;
  const segments = blocks
    .flatMap((block) =>
      block.start_at !== null && block.end_at !== null
        ? [
            {
              block,
              start: new Date(block.start_at),
              end: new Date(block.end_at),
            },
          ]
        : [],
    )
    .filter(
      ({ start, end }) => start.getTime() < dayEnd && end.getTime() > dayStart,
    )
    .map(({ block, start, end }) => {
      let startMin = start.getTime() <= dayStart ? 0 : wallMinutes(start);
      let endMin = end.getTime() >= dayEnd ? 1440 : wallMinutes(end);
      if (
        repeated !== null &&
        start.getTimezoneOffset() < end.getTimezoneOffset()
      ) {
        startMin = Math.min(startMin, repeated.minute);
        endMin = Math.max(endMin, repeated.minute + repeated.duration);
      }
      return { block, startMin, endMin, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let group: Segment[] = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;
  const closeGroup = () => {
    for (const segment of group) {
      segment.lanes = laneEnds.length;
    }
    group = [];
    laneEnds = [];
  };
  for (const segment of segments) {
    if (group.length > 0 && segment.startMin >= groupEnd) {
      closeGroup();
    }
    let lane = laneEnds.findIndex((end) => end <= segment.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = segment.endMin;
    segment.lane = lane;
    groupEnd =
      group.length === 0 ? segment.endMin : Math.max(groupEnd, segment.endMin);
    group.push(segment);
  }
  closeGroup();
  return segments;
}

/**
 * The free stretches between consecutive segments that last at least `minMinutes`. Declined plans
 * are not commitments, so they never end or interrupt free time.
 */
export function gapsBetween(segments: Segment[], minMinutes: number): Gap[] {
  const gaps: Gap[] = [];
  const kept = segments.filter((segment) => segment.block.rsvp !== "no");
  let reach = kept[0]?.endMin ?? 0;
  for (const segment of kept.slice(1)) {
    if (segment.startMin - reach >= minMinutes) {
      gaps.push({ startMin: reach, endMin: segment.startMin });
    }
    reach = Math.max(reach, segment.endMin);
  }
  return gaps;
}

/** The whole hours the axis spans: the blocks' extent, or a default window when there are none. */
export function axisRange(columns: Segment[][]): { from: number; to: number } {
  const all = columns.flat();
  if (all.length === 0) {
    return { from: EMPTY_FROM_HOUR, to: EMPTY_TO_HOUR };
  }
  return {
    from: Math.floor(Math.min(...all.map((s) => s.startMin)) / 60),
    to: Math.ceil(Math.max(...all.map((s) => s.endMin)) / 60),
  };
}

/** The segment happening at `nowMin` and the first one starting after it. */
export function nowAndNext(
  segments: Segment[],
  nowMin: number,
): { current: Segment | null; next: Segment | null } {
  return {
    current:
      segments.find((s) => s.startMin <= nowMin && nowMin < s.endMin) ?? null,
    next: segments.find((s) => s.startMin > nowMin) ?? null,
  };
}

/** True once a plan's end has passed. */
export function hasEnded(plan: Plan, now: Date): boolean {
  return plan.end_at !== null && new Date(plan.end_at).getTime() <= now.getTime();
}

/** Minutes as "1 h 20 min", "45 min", or "2 h". */
export function formatSpan(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return (
    [h > 0 ? `${h} h` : "", m > 0 ? `${m} min` : ""]
      .filter(Boolean)
      .join(" ") || "0 min"
  );
}

/** Local clock time for minutes after midnight, e.g. "2:30 PM". */
export function formatMinuteOfDay(minutes: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, 0, minutes));
}

const PERIOD = /[\s\u202f\u00a0]*(AM|PM)$/i;

/** A time range as "2:30 – 3:50 PM", the period written once when both ends share it. */
export function formatRange(startMin: number, endMin: number): string {
  const start = formatMinuteOfDay(startMin);
  const end = formatMinuteOfDay(endMin);
  const a = PERIOD.exec(start);
  const b = PERIOD.exec(end);
  return a !== null && b !== null && a[1]!.toUpperCase() === b[1]!.toUpperCase()
    ? `${start.replace(PERIOD, "")} – ${end}`
    : `${start} – ${end}`;
}

/** A clock time with no space before the period, e.g. "2:41PM". */
export function formatClockCompact(minutes: number): string {
  return formatMinuteOfDay(minutes).replace(/[\s\u202f\u00a0]+/g, "");
}

