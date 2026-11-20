/** Labelled, human phrases for durations and moments, so no value in the Planner is shown bare. */
import { formatClock } from "../../shared/lib/ux/time";
import { startOfDay } from "./dates";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY_MS = 24 * HOUR;

/** A length of time in words: "25 min", "1 h 30 min", "3 h", "2 days". Under a minute is "under a minute". */
export function duration(ms: number): string {
  const minutes = Math.round(Math.abs(ms) / MIN);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.round(Math.abs(ms) / DAY_MS);
  return days === 1 ? "1 day" : `${days} days`;
}

/** A length for "in" and "ago" phrases: exact minutes below three hours, whole hours from there ("8 h", not "8 h 7 min"), then days. */
export function coarse(ms: number): string {
  const minutes = Math.round(Math.abs(ms) / MIN);
  return minutes >= 180 && minutes < 24 * 60 ? `${Math.round(minutes / 60)} h` : duration(ms);
}

/** "in 25 min", "in 2 days", or "now" when under a minute away. */
export function inPhrase(ms: number): string {
  return Math.abs(ms) < MIN ? "now" : `in ${coarse(ms)}`;
}

/** "25 min ago", "3 days ago", or "just now" when under a minute ago. */
export function agoPhrase(ms: number): string {
  return Math.abs(ms) < MIN ? "just now" : `${coarse(ms)} ago`;
}

/** A day named relative to `now`: "today", "tomorrow", "yesterday", a weekday within the week, else "Nov 28". */
export function dayWord(at: Date, now: Date): string {
  const days = Math.round((startOfDay(at).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(at);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(at);
}

/** A moment as day and clock: "today 3:30 PM", "Fri 11:59 PM". */
export function momentPhrase(iso: string, now: Date): string {
  return `${dayWord(new Date(iso), now)} ${formatClock(iso)}`;
}

/** "Last confirmed 3 days ago", from the moment a task was last confirmed; null when it never was. */
export function confirmedPhrase(iso: string | null, now: Date): string | null {
  return iso === null ? null : `Last confirmed ${agoPhrase(now.getTime() - Date.parse(iso))}`;
}
