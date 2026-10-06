/** Display helpers for the chat sidebar. */

export type ConversationBucket = "Today" | "Yesterday" | "Previous";

/**
 * ChatGPT-style list grouping for a conversation's last activity.
 */
export function conversationBucket(
  /** ISO-8601 timestamp. */
  iso: string,
  /** Reference instant in ms since epoch. */
  now = Date.now(),
): ConversationBucket {
  const at = new Date(iso).getTime();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const todayMs = startToday.getTime();
  if (at >= todayMs) {
    return "Today";
  }
  const yesterdayMs = todayMs - 86_400_000;
  if (at >= yesterdayMs) {
    return "Yesterday";
  }
  return "Previous";
}

/**
 * Group conversations into Today / Yesterday / Previous, preserving newest-first order.
 */
export function groupConversations<T extends { last_at: string }>(
  conversations: T[],
  now = Date.now(),
): Array<{ bucket: ConversationBucket; items: T[] }> {
  const order: ConversationBucket[] = ["Today", "Yesterday", "Previous"];
  const buckets: Record<ConversationBucket, T[]> = {
    Today: [],
    Yesterday: [],
    Previous: [],
  };
  for (const conv of conversations) {
    buckets[conversationBucket(conv.last_at, now)].push(conv);
  }
  return order
    .filter((bucket) => buckets[bucket].length > 0)
    .map((bucket) => ({ bucket, items: buckets[bucket] }));
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

/**
 * A conversation's last activity, for the right edge of its list row: the time today,
 * "Yesterday", the weekday within a week, else "Oct 5" (with the year when it differs).
 */
export function formatListTime(
  /** ISO-8601 timestamp. */
  iso: string,
  /** Reference instant in ms since epoch. */
  now = Date.now(),
): string {
  const at = new Date(iso);
  const reference = new Date(now);
  const days = daysAgo(at, reference);
  if (days === 0) {
    return at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return at.toLocaleDateString("en-US", { weekday: "short" });
  }
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() === reference.getFullYear() ? {} : { year: "numeric" }),
  });
}
