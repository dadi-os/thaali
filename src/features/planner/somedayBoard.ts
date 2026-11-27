/** Someday board logic: the days a task can be dropped on, the words that ask for a close date, search, and arrow-key travel between cards. */
import { addDays, dateKey, startOfDay } from "./dates";

/** How many days the drop strip offers, today first. */
export const STRIP_DAYS = 7;

/** The `data-drop` prefix of a day tile. */
const DAY_DROP = "day:";

/** The days the strip offers: `count` local days from today. */
export function somedayDays(now: Date, count = STRIP_DAYS): Date[] {
  const today = startOfDay(now);
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

/** The `data-drop` key of a day's tile. */
export function dayDropKey(day: Date): string {
  return `${DAY_DROP}${dateKey(day)}`;
}

/** The local day (`YYYY-MM-DD`) a `data-drop` key names, or null for any other key. */
export function parseDayDrop(key: string): string | null {
  return key.startsWith(DAY_DROP) && /^\d{4}-\d{2}-\d{2}$/.test(key.slice(DAY_DROP.length)) ? key.slice(DAY_DROP.length) : null;
}

/** A tile's two lines: "Today" or a weekday over the month and day. */
export function tileLabel(day: Date, now: Date): { name: string; date: string } {
  const steps = Math.round((startOfDay(day).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const name = steps === 0 ? "Today" : steps === 1 ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day);
  return { name, date: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(day) };
}

/** Whether a title or its keeper contains every word of `query`, ignoring case; an empty query matches everything. */
export function matchesQuery(item: { title: string; owner: string }, query: string): boolean {
  const hay = `${item.title} ${item.owner}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

/** A card's box on screen. */
export type Box = { left: number; top: number; width: number; height: number };

/** An arrow key. */
export type Direction = "left" | "right" | "up" | "down";

/**
 * The card an arrow key moves to from `boxes[from]`: the nearest one that way in the same row or column, or null at the edge.
 */
export function neighbor(boxes: Box[], from: number, direction: Direction): number | null {
  const origin = boxes[from];
  if (origin === undefined) return null;
  const cx = origin.left + origin.width / 2;
  const cy = origin.top + origin.height / 2;
  let best: number | null = null;
  let bestScore = Infinity;
  boxes.forEach((box, index) => {
    if (index === from) return;
    const dx = box.left + box.width / 2 - cx;
    const dy = box.top + box.height / 2 - cy;
    const along = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
    const across = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const sameLine = direction === "left" || direction === "right" ? across < origin.height * 0.75 : across < origin.width;
    if (along <= 1 || !sameLine) return;
    const score = across * 3 + along;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
