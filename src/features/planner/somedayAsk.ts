/** Asking an agent to give a Someday task a day: the words, the one-ask-per-drop guard, and the send. */
import type { HathClient } from "../../shared/api/hath";
import { formatDay } from "../../shared/lib/ux/time";

/** A title longer than this is cut, so a pasted paragraph does not become the whole message. */
const TITLE_MAX = 160;

/** How long an ask stays pending when the task never gains a close date, in ms. */
export const ASK_TTL_MS = 10 * 60_000;

/** A task title as one line of plain text: newlines and runs of space become one space, double quotes become single, and a long title is cut with an ellipsis. */
export function cleanTitle(title: string): string {
  const line = title.replace(/\s+/g, " ").replace(/"/g, "'").trim();
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1).trimEnd()}…` : line;
}

/** The day as the app words it, "Fri, Nov 27". */
export function dayLabel(day: Date): string {
  return formatDay(day.toISOString());
}

/** What Ankur says to the agent that keeps a task: `Please schedule "Organize the garage" for Fri, Nov 27.` */
export function scheduleMessage(title: string, day: Date): string {
  return `Please schedule "${cleanTitle(title)}" for ${dayLabel(day)}.`;
}

/** Remembers which task and day have been asked for, so one drop sends once however often it fires. */
export type AskGuard = {
  /** True when this ask may be sent; false when the same task is already waiting on the same day. */
  begin: (taskId: string, dayKey: string, at: number) => boolean;
  /** Forgets an ask that failed, so it can be tried again. */
  release: (taskId: string, dayKey: string) => void;
  /** The day (`YYYY-MM-DD`) a task is waiting on, or null when nothing pends or the ask has gone stale. */
  pendingDay: (taskId: string, at: number) => string | null;
};

/** A guard that holds one pending ask per task for `ttlMs`. */
export function createAskGuard(ttlMs = ASK_TTL_MS): AskGuard {
  const asks = new Map<string, { dayKey: string; at: number }>();
  const live = (taskId: string, at: number) => {
    const ask = asks.get(taskId);
    return ask !== undefined && at - ask.at < ttlMs ? ask : undefined;
  };
  return {
    begin(taskId, dayKey, at) {
      if (live(taskId, at)?.dayKey === dayKey) return false;
      asks.set(taskId, { dayKey, at });
      return true;
    },
    release(taskId, dayKey) {
      if (asks.get(taskId)?.dayKey === dayKey) asks.delete(taskId);
    },
    pendingDay: (taskId, at) => live(taskId, at)?.dayKey ?? null,
  };
}

/** Sends the schedule request to `agentId` as Ankur, through Hath's message post; returns the words sent and the stored message. */
export async function sendScheduleAsk(hath: Pick<HathClient, "postMessage">, agentId: string, title: string, day: Date) {
  const content = scheduleMessage(title, day);
  const stored = await hath.postMessage({ to_agent_id: agentId, content });
  return { content, stored };
}
