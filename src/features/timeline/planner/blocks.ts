/** Pure planner logic: a day's sessions as segments on a minute axis, their lanes, gaps, and what is now and next. */

import { addDays, endOfDay, startOfDay } from "../dates";
import type { TimelineItem } from "../../../types/timeline";

/** The least unclaimed time between two blocks that the planner draws as a gap (travel). */
export const GAP_MIN = 10;

/** Hours the axis shows on a day with no blocks. */
const EMPTY_FROM_HOUR = 7;
const EMPTY_TO_HOUR = 22;

/** One block's part of one day, in minutes after local midnight, with its side-by-side lane. */
export type Segment = {
  block: TimelineItem;
  startMin: number;
  endMin: number;
  /** Lane among the blocks it overlaps, and how many lanes that overlapping group has. */
  lane: number;
  lanes: number;
};

/** Unclaimed time between two blocks, in minutes after local midnight. */
export type Gap = { startMin: number; endMin: number };

const minutesOf = (at: Date, dayStart: number) => Math.round((at.getTime() - dayStart) / 60_000);

/**
 * `day`'s part of every timed session that touches it, earliest first, with overlapping
 * sessions in side-by-side lanes. The planner view only holds sessions with both times.
 */
export function segmentsOn(blocks: TimelineItem[], day: Date): Segment[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const segments = blocks
    .flatMap((block) => (block.start_at !== null && block.end_at !== null ? [{ block, start: new Date(block.start_at), end: new Date(block.end_at) }] : []))
    .filter(({ start, end }) => start.getTime() < dayEnd && end.getTime() > dayStart)
    .map(({ block, start, end }) => ({
      block,
      startMin: Math.max(0, minutesOf(start, dayStart)),
      endMin: Math.min(1440, minutesOf(end, dayStart)),
      lane: 0,
      lanes: 1,
    }))
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
    groupEnd = group.length === 0 ? segment.endMin : Math.max(groupEnd, segment.endMin);
    group.push(segment);
  }
  closeGroup();
  return segments;
}

/** The unclaimed stretches between consecutive segments that last at least {@link GAP_MIN}. */
export function gapsBetween(segments: Segment[]): Gap[] {
  const gaps: Gap[] = [];
  let reach = segments[0]?.endMin ?? 0;
  for (const segment of segments.slice(1)) {
    if (segment.startMin - reach >= GAP_MIN) {
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

/** The block happening at `nowMin` and the first one starting after it. */
export function nowAndNext(segments: Segment[], nowMin: number): { current: Segment | null; next: Segment | null } {
  return {
    current: segments.find((s) => s.startMin <= nowMin && nowMin < s.endMin) ?? null,
    next: segments.find((s) => s.startMin > nowMin) ?? null,
  };
}

/** True once a session was completed, cancelled, or its time has passed. */
export function isSettled(block: TimelineItem, now: Date): boolean {
  return (
    block.outcome === "done" ||
    block.state === "cancelled" ||
    (block.end_at !== null && new Date(block.end_at).getTime() <= now.getTime())
  );
}

/** Minutes as "1 h 20 min", "45 min", or "2 h". */
export function formatSpan(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h > 0 ? `${h} h` : "", m > 0 ? `${m} min` : ""].filter(Boolean).join(" ") || "0 min";
}

/** Local clock time for minutes after midnight, e.g. "2:30 PM". */
export function formatMinuteOfDay(minutes: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, 0, minutes));
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

/** ISO bounds of a local day, for a planner query. */
export function dayBounds(day: Date): { from: string; to: string } {
  return { from: startOfDay(day).toISOString(), to: endOfDay(day).toISOString() };
}
