import type { Lane } from "../../../types/hath";
import { LANE_LABEL } from "../../../shared/lib/ux/lanes";
import type { ActivityStep, ActivityWake } from "./activity";

/** Wakes shown at first, and added per "Show older". */
export const WAKE_PAGE = 5;
/** A long wake shows its first steps (what set it off) and its latest, with the middle folded. */
export const STEP_HEAD = 2;
export const STEP_TAIL = 8;

/** Which lanes' steps the feed shows. */
export type LaneFilter = Lane | "all";

/** The filter a lane filter control's word chooses. */
export function laneFilterOf(word: string): LaneFilter {
  switch (word) {
    case "Processing":
      return "process";
    case "Working":
      return "work";
    case "All":
      return "all";
    default:
      throw new Error(`no lane filter named ${word}`);
  }
}

/** What set a wake off: who messaged, or which lanes started on their own. */
export function wakeTitle(wake: ActivityWake): string {
  const first = wake.steps[0]!;
  if (first.kind === "message" && first.direction === "receive") {
    const from = `from ${first.peer ?? "you"}`;
    return first.scheduled ? `scheduled ${from}` : from;
  }
  return wake.lanes.map((lane) => LANE_LABEL[lane]).join(" + ");
}

/** How many steps a wake of `steps` steps folds away: none unless folding hides at least two. */
export function foldedCount(steps: number): number {
  return steps <= STEP_HEAD + STEP_TAIL + 1 ? 0 : steps - STEP_HEAD - STEP_TAIL;
}

/** The wakes with any step in `filter`'s lane, each with just those steps. */
export function shownWakes(wakes: ActivityWake[], filter: LaneFilter): Array<{ wake: ActivityWake; steps: ActivityStep[] }> {
  const shown: Array<{ wake: ActivityWake; steps: ActivityStep[] }> = [];
  for (const wake of wakes) {
    const steps = wake.steps.filter((step) => filter === "all" || step.lane === filter);
    if (steps.length > 0) {
      shown.push({ wake, steps });
    }
  }
  return shown;
}

/** How many of `shown` wakes lie beyond the first `limit`. */
export function hiddenWakes(shown: number, limit: number): number {
  return Math.max(0, shown - limit);
}

/** The key of every step of every wake. */
export function feedKeys(wakes: ActivityWake[]): Set<string> {
  return new Set(wakes.flatMap((wake) => wake.steps.map((step) => step.key)));
}

/** The innermost feed row crossing `line` (a viewport y), or the first row below it, with its top: the row the reader is looking at, which must not move as rows above it change. */
export function lastReadingRow(list: HTMLElement, line: number): { row: Element; top: number } | null {
  let found: Element | null = null;
  for (const row of list.querySelectorAll("li")) {
    const { top, bottom } = row.getBoundingClientRect();
    if (top <= line && bottom > line) {
      found = row;
    } else if (found === null && top > line) {
      found = row;
      break;
    }
  }
  return found === null ? null : { row: found, top: found.getBoundingClientRect().top };
}
