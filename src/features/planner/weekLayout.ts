/** Pure Week geometry: the spacing scale every gap comes from, lane boxes, bar rows, the opening hour, bubble state and block fit. */

import type { Plan } from "../../types/planner";
import { startOfDay } from "./dates";
import type { Segment } from "./layout";
import type { DayBadge } from "./tasks";

/**
 * The Week's spacing, in px, all on a 4 pt base. Gaps come from the scale 4 / 8 / 12 / 16 / 24 / 32; the rest are sizes
 * (multiples of 4): the axis and bubble and bar heights, the hour height and the least block height.
 */
export const WEEK = {
  /** Space between the card edge and the axis, and between the last column and the card edge. */
  edge: 12,
  /** Width of the hour-label column; the now pill fills it. */
  axis: 56,
  /** Space between the axis and the first column. */
  gutter: 12,
  /** Space above the day bubbles. */
  top: 12,
  bubble: 28,
  /** Space between the bubbles and the first bar row. */
  bubbleToBars: 8,
  bar: 24,
  barGap: 4,
  /** Bar rows shown before "+N". */
  barRows: 2,
  /** Space between the last header row and the first hour line. */
  headToGrid: 12,
  /** Space between a block and the column edge it sits against. */
  inset: 8,
  /** Side-by-side blocks an overlap shows before the rest fold into "+N". */
  lanes: 2,
  /** Space between side-by-side blocks of one overlap. */
  laneGap: 4,
  /** Space taken from a block's height so stacked blocks have air between them. */
  blockGap: 4,
  padX: 12,
  /** Horizontal padding of a block that shares its column. */
  padXShared: 4,
  /** Space a block carrying "+N" reserves for it: under its text, or at its right when too short for two lines. */
  more: 24,
  padXMore: 32,
  padY: 8,
  /** Vertical padding of a block too short for two lines. */
  padYShort: 4,
  minBlock: 28,
  hour: 64,
  /** Space under the last hour line. */
  bottom: 24,
  /** Space between a block's dot and its title. */
  dotGap: 8,
  /** Space between the title line and the time line. */
  lineGap: 4,
  /** Distance from the now line within which an hour label hides, so the pill never meets one. */
  nowClear: 28,
  /** Radius of the today tint. */
  tint: 16,
} as const;

/** The pixel width the axis and its gutter take before the first column. */
export const WEEK_LEFT = WEEK.edge + WEEK.axis + WEEK.gutter;

/** The grid template shared by the header and the hours: the left margin, one column per day, the right margin. */
export function weekColumns(count: number): string {
  return `${WEEK_LEFT}px repeat(${count}, minmax(0, 1fr)) ${WEEK.edge}px`;
}

/** The height of everything pinned above the first hour line, for `rows` bar rows and, when bars were folded, one more row for "+N more". */
export function weekHeadHeight(rows: number, overflow = false): number {
  const lines = rows + (overflow ? 1 : 0);
  const bars = lines === 0 ? 0 : WEEK.bubbleToBars + lines * WEEK.bar + (lines - 1) * WEEK.barGap;
  return WEEK.top + WEEK.bubble + bars + WEEK.headToGrid;
}

/**
 * The left and width, as CSS lengths inside a column, of lane `lane` of `lanes` overlapping blocks (at most {@link WEEK}.lanes):
 * the column's free width shared evenly with the lane gap between them.
 */
export function laneBox(lane: number, lanes: number): { left: string; width: string } {
  const free = `(100% - ${WEEK.inset * 2}px - ${(lanes - 1) * WEEK.laneGap}px)`;
  return { left: `calc(${WEEK.inset}px + ${lane} * (${free} / ${lanes} + ${WEEK.laneGap}px))`, width: `calc(${free} / ${lanes})` };
}

/** The segments a Week column draws, and the plans folded behind "+N" on the block that stands for each overlap that was too crowded. */
export type CappedColumn = {
  /** The segments in the first lanes, each with its lane count capped. */
  shown: Segment[];
  /** Hidden plans by the id of the visible block that carries their "+N". */
  more: Map<string, Plan[]>;
};

/**
 * Keeps at most {@link WEEK}.lanes side-by-side lanes in every overlap cluster of `segments` (sorted as {@link segmentsOn} gives
 * them). The plans in further lanes are folded into one "+N" on the cluster's last visible block, the one that starts latest.
 */
export function capLanes(segments: Segment[]): CappedColumn {
  const shown: Segment[] = [];
  const more = new Map<string, Plan[]>();
  let cluster: Segment[] = [];
  let reach = 0;
  const close = () => {
    const visible = cluster.filter((segment) => segment.lane < WEEK.lanes).map((segment) => ({ ...segment, lanes: Math.min(segment.lanes, WEEK.lanes) }));
    const folded = cluster.filter((segment) => segment.lane >= WEEK.lanes).map((segment) => segment.block);
    if (folded.length > 0) {
      const last = visible.reduce((best, segment) => (segment.startMin > best.startMin || (segment.startMin === best.startMin && segment.lane > best.lane) ? segment : best));
      more.set(last.block.id, folded);
    }
    shown.push(...visible);
    cluster = [];
  };
  for (const segment of segments) {
    if (cluster.length > 0 && segment.startMin >= reach) close();
    reach = cluster.length === 0 ? segment.endMin : Math.max(reach, segment.endMin);
    cluster.push(segment);
  }
  if (cluster.length > 0) close();
  return { shown, more };
}

/** The bar lanes that show, and how many plans sit in the lanes folded into "+N". */
export function barRows(lanes: Plan[][]): { shown: Plan[][]; hidden: number } {
  return { shown: lanes.slice(0, WEEK.barRows), hidden: lanes.slice(WEEK.barRows).reduce((count, lane) => count + lane.length, 0) };
}

const FOCUS_MORNING = 420;

/**
 * Where the week opens, in minutes: the hour line one hour before the week's earliest plan (a plan carried over from the night
 * before does not count), or before now when today is in the week and now is earlier; seven in the morning when nothing is planned.
 */
export function weekAnchor(columns: Segment[][], nowMinute: number | null): number {
  const starts = columns.flat().map((segment) => segment.startMin).filter((minute) => minute > 0);
  const first = starts.length === 0 ? null : Math.min(...starts);
  const focus = first === null ? (nowMinute ?? FOCUS_MORNING) : nowMinute === null ? first : Math.min(first, nowMinute);
  return Math.max(0, Math.floor((focus - 60) / 60) * 60);
}

/** What a day bubble shows: whether it is today or over, the tasks dot, and its spoken label's task part. */
export type BubbleState = {
  today: boolean;
  over: boolean;
  /** Open tasks to count beside the dot; 0 shows no count. */
  open: number;
  /** The dot is clay: some counted task is due. */
  urgent: boolean;
  /** Every task of the day is done: a check instead of a count. */
  done: boolean;
  /** The task part of the bubble's spoken label, with its leading comma, or "". */
  spoken: string;
};

/** The state of `day`'s bubble from the ticking clock and the day's task badge, which is undefined until the tasks load. */
export function bubbleState(day: Date, now: Date, badge: DayBadge | undefined): BubbleState {
  const today = startOfDay(day).getTime() === startOfDay(now).getTime();
  const over = !today && day.getTime() < startOfDay(now).getTime();
  const open = badge?.open ?? 0;
  const done = badge !== undefined && open === 0 && badge.allDone;
  const spoken = badge === undefined ? "" : open > 0 ? `, ${open} open ${open === 1 ? "task" : "tasks"}${badge.urgent ? ", some due" : ""}` : done ? ", all tasks done" : "";
  return { today, over, open, urgent: badge !== undefined && badge.urgent && open > 0, done, spoken };
}

/** How much of a day bubble fits a column: weekday, date and task count; weekday and date with the task dot; the weekday's letter, date and dot. */
export type BubbleFit = "full" | "short" | "letter";

/** The width in px of a column below which a bubble drops its count, and below which it also shortens the weekday to a letter. */
const BUBBLE_FULL = 136;
const BUBBLE_SHORT = 104;
/** The width in px of a column below which a block drops its dot and time and tightens its sides. */
const BLOCK_ROOMY = 120;

/** The bubble variant for a day column `column` px wide. */
export function bubbleFit(column: number): BubbleFit {
  return column >= BUBBLE_FULL ? "full" : column >= BUBBLE_SHORT ? "short" : "letter";
}

/** Whether a day column `column` px wide is too narrow for a block's dot and time. */
export function narrowColumn(column: number): boolean {
  return column < BLOCK_ROOMY;
}

/** What a block of `height` px has room for: its padding, the lines its title may take, and whether the time line shows under it. */
export type BlockFit = { padX: number; padY: number; titleLines: number; time: boolean; short: boolean };

/** The fit of a block `height` px tall in a column holding `lanes` side-by-side blocks; a shared or `narrow` column drops the time line. */
export function blockFit(height: number, lanes: number, narrow = false): BlockFit {
  const short = height < 52;
  const padY = short ? WEEK.padYShort : WEEK.padY;
  const room = height - padY * 2;
  const time = !short && lanes === 1 && !narrow;
  const titleLines = Math.max(1, Math.floor((time ? room - 16 - WEEK.lineGap : room) / 16));
  const padX = lanes === 1 && !narrow ? WEEK.padX : WEEK.padXShared;
  return { padX, padY, titleLines, time, short };
}
