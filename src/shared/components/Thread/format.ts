/** Display helpers for the chat sidebar. */

import { formatClock } from "../../lib/ux/time";

/** The calendar day of an instant in the device's zone, as `2026-10-28`. */
function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA");
}

/** `Wed, Oct 28`: a day's weekday, month and date in the device's zone. */
function weekdayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * The heading of the day an instant falls on: "Today", "Yesterday", else the day itself
 * ("Mon, Oct 26"), by the device's calendar.
 */
export function dayLabel(
  /** ISO-8601 timestamp. */
  iso: string,
  /** Reference instant in ms since epoch. */
  now = Date.now(),
): string {
  const key = dayKey(new Date(iso).getTime());
  if (key === dayKey(now)) {
    return "Today";
  }
  return key === dayKey(now - 86_400_000) ? "Yesterday" : weekdayDate(iso);
}

/**
 * Groups items under the day of their last activity, keeping their order (newest first):
 * one group per day, headed by its {@link dayLabel}.
 */
export function groupByDay<T extends { last_at: string }>(
  items: T[],
  now = Date.now(),
): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const item of items) {
    const label = dayLabel(item.last_at, now);
    const group = groups.find((g) => g.label === label);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

/** A message's text without its Markdown marks, on one line, for a list preview. */
export function plainPreview(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

/**
 * A conversation's last activity, for the right edge of its list row: the time today,
 * "Yesterday", else the day ("Mon, Oct 26").
 */
export function formatRailTime(
  /** ISO-8601 timestamp. */
  iso: string,
  /** Reference instant in ms since epoch. */
  now = Date.now(),
): string {
  const label = dayLabel(iso, now);
  return label === "Today" ? formatClock(iso) : label === "Yesterday" ? label : weekdayDate(iso);
}

/**
 * Format an ISO timestamp as a relative English phrase (e.g. "3 minutes ago").
 */
export function formatRelative(
  /** ISO-8601 timestamp. */
  iso: string,
  /** Reference instant in ms since epoch. */
  now = Date.now(),
): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) {
    return rtf.format(diffSec, "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, "hour");
  }
  return rtf.format(Math.round(diffHour / 24), "day");
}

/** Whole calendar days from `at`'s local day to `now`'s (0 today, 1 yesterday). */
function daysAgo(at: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(at)) / 86_400_000);
}

/**
 * When a message was sent, for the line under its bubble: "3:42 PM" today,
 * "Yesterday 3:42 PM", "Oct 5, 3:42 PM" this year, else "Oct 5, 2025, 3:42 PM".
 */
export function formatMessageTime(
  /** ISO-8601 timestamp. */
  iso: string,
  /** Reference instant in ms since epoch. */
  now = Date.now(),
): string {
  const at = new Date(iso);
  const reference = new Date(now);
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = daysAgo(at, reference);
  if (days === 0) {
    return time;
  }
  if (days === 1) {
    return `Yesterday ${time}`;
  }
  const sameYear = at.getFullYear() === reference.getFullYear();
  return `${at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}, ${time}`;
}
