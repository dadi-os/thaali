import type { LogRecord, Reminder, Routine, WakeEntry, WakeOutcome, WakeReason, WakeSummary, WakeToolCall } from "../../../types/hath";
import { countNoun } from "../../../shared/lib/ux/plural";
import { formatSpan } from "../../../shared/lib/ux/time";

/** A turn entry of a wake. */
export type TurnEntry = Extract<WakeEntry, { type: "turn" }>;

/** The words of each wake outcome. */
export const OUTCOME_LABEL: Record<WakeOutcome, string> = {
  running: "Running",
  waiting: "Waiting",
  yielded: "Yielded",
  failed: "Failed",
};

/** A wake's reason as a sentence: the words before the name, and the agent it names when one does (`agentId` null for Ankur or no one). */
export type ReasonLine = { lead: string; agentId: string | null; name: string | null };

/** What the sheet can name about the routines and reminders that wake an agent. */
export type ScheduleNames = { routines: Routine[]; reminders: Reminder[] };

/** The reason a wake began in words; a `message` wake names its sender (no sender is Ankur), a `schedule` wake the routine or reminder when the sheet still knows it. */
export function reasonLine(reason: WakeReason, names: ScheduleNames): ReasonLine {
  switch (reason.kind) {
    case "message":
      return { lead: "Opened by", agentId: reason.ref, name: reason.ref ?? "Ankur" };
    case "schedule": {
      const routine = names.routines.find((candidate) => candidate.id === reason.ref);
      if (routine !== undefined) {
        return { lead: "Routine", agentId: null, name: routine.title };
      }
      const reminder = names.reminders.find((candidate) => candidate.id === reason.ref);
      return reminder === undefined ? { lead: "Routine or reminder", agentId: null, name: null } : { lead: "Reminder", agentId: null, name: reminder.note };
    }
    case "recovery":
      return { lead: "Recovery", agentId: null, name: null };
    case "steer":
      return { lead: "Helper reported back", agentId: null, name: null };
    case "manual":
      return { lead: "Started by hand", agentId: null, name: null };
  }
}

/** A count of thousands as `1.2k`, of millions as `3.4M`, below that the number. */
export function compact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** A wake's counts as one line, leaving out what is zero; empty when it did nothing. */
export function countsLine(counts: WakeSummary["counts"]): string {
  return [
    counts.tool_calls > 0 ? `${counts.tool_calls} tool ${countNoun(counts.tool_calls, "call")}` : null,
    counts.messages_sent > 0 ? `${counts.messages_sent} ${countNoun(counts.messages_sent, "message")} sent` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** How long a wake took, or has taken so far when it still runs. */
export function wakeDuration(wake: Pick<WakeSummary, "started_at" | "ended_at">, now: number): string {
  const end = wake.ended_at === null ? now : Date.parse(wake.ended_at);
  return formatSpan(Math.max(0, end - Date.parse(wake.started_at)));
}

/** Input keys that name what a tool call acts on, most telling first. */
const TARGET_KEYS = ["url", "path", "file_path", "id", "to", "to_agent_id", "query", "command", "name", "instruction", "message", "content"];

/** The longest a call's target is drawn before it is cut, in characters. */
const TARGET_MAX = 72;

/** What a tool call acts on, read from its input: the first of the well-known keys with text, else the first text value, else empty. */
export function callTarget(input: unknown): string {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return "";
  }
  const fields = input as Record<string, unknown>;
  const key = TARGET_KEYS.find((candidate) => typeof fields[candidate] === "string" && fields[candidate] !== "");
  const text = key === undefined ? Object.values(fields).find((value): value is string => typeof value === "string" && value !== "") : (fields[key] as string);
  if (text === undefined) {
    return "";
  }
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > TARGET_MAX ? `${oneLine.slice(0, TARGET_MAX - 1)}…` : oneLine;
}

/** What the agent is doing this moment: the latest call of a running wake. */
export type NowLine = {
  name: string;
  target: string;
  /** True while the call has no result. */
  running: boolean;
  /** ISO time of the turn that made the call. */
  at: string;
};

/** The last call of the latest turn in a running wake's entries; null when the agent has not called anything. */
export function nowLine(entries: WakeEntry[]): NowLine | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.type === "turn") {
      const call: WakeToolCall | undefined = entry.calls[entry.calls.length - 1];
      if (call === undefined) {
        continue;
      }
      return { name: call.name, target: callTarget(call.input), running: call.result === null, at: entry.at };
    }
  }
  return null;
}

/** The plain sentence for a halt that Hath refused, by its error code; the code itself when it is one this does not know. */
export function haltSentence(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("task_not_found")) {
    return "That task no longer exists.";
  }
  if (text.includes("task_conflict")) {
    return "The task changed while stopping it; try again.";
  }
  if (/HTTP 502/.test(text)) {
    return "Nas did not answer, so the task was not stopped.";
  }
  return text;
}

/**
 * A tool input or result as display text: structures and JSON text indented, any other text as it is.
 * A result cut at the server cap may be unfinished JSON; it is shown as received.
 */
export function prettyJson(value: unknown): string {
  if (typeof value !== "string") {
    return JSON.stringify(value, null, 2);
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return value;
  }
}

/** The text of a raw `tool_result` log row: its `content` when it has text, else the whole payload as JSON. */
export function rawContent(log: Pick<LogRecord, "payload">): string {
  const { content } = log.payload;
  return typeof content === "string" ? content : JSON.stringify(log.payload, null, 2);
}
