import type { Lane, LogRecord, WakeEntry, WakeOutcome, WakeReason, WakeSummary, WakeToolCall, WakeUsage } from "../../../types/hath";
import { countNoun } from "../../../shared/lib/ux/plural";
import { formatSpan } from "../../../shared/lib/ux/time";

/** The lane filter of an open wake: both lanes, or one. */
export type LaneFilter = "All" | "Work" | "Process";

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

/** The reason a wake began in words; a `message` wake names its sender, and no sender is Ankur. */
export function reasonLine(reason: WakeReason): ReasonLine {
  switch (reason.kind) {
    case "message":
      return { lead: "Opened by", agentId: reason.ref, name: reason.ref ?? "Ankur" };
    case "schedule":
      return { lead: "Schedule", agentId: null, name: null };
    case "recovery":
      return { lead: "Recovery", agentId: null, name: null };
    case "steer":
      return { lead: "Steer", agentId: null, name: null };
    case "manual":
      return { lead: "Manual", agentId: null, name: null };
  }
}

/** A count of thousands as `1.2k`, of millions as `3.4M`, below that the number. */
export function compact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** A wake's usage as its chip says it: tokens read and written, and how many of the prompt came from cache. */
export function usageChip(usage: WakeUsage): string {
  return `${compact(usage.input_tokens + usage.output_tokens)} tok · ${compact(usage.cache_read)} cached`;
}

/** A wake's counts as one line, leaving out what is zero; empty when it did nothing. */
export function countsLine(counts: WakeSummary["counts"]): string {
  return [
    counts.tool_calls > 0 ? `${counts.tool_calls} tool ${countNoun(counts.tool_calls, "call")}` : null,
    counts.messages_received > 0 ? `${counts.messages_received} in` : null,
    counts.messages_sent > 0 ? `${counts.messages_sent} out` : null,
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

/** The entries an open wake shows under a lane filter: every message, and the turns of the chosen lane (every turn for All). */
export function filterEntries(entries: WakeEntry[], filter: LaneFilter): WakeEntry[] {
  if (filter === "All") {
    return entries;
  }
  const lane: Lane = filter === "Work" ? "work" : "process";
  return entries.filter((entry) => entry.type === "message" || entry.lane === lane);
}

/** What the agent is doing this moment: its work lane's latest call. */
export type NowLine = {
  name: string;
  target: string;
  /** True while the call has no result. */
  running: boolean;
  /** ISO time of the turn that made the call. */
  at: string;
};

/** The last call of the work lane's latest turn in a running wake's entries; null when the lane has not called anything. */
export function nowLine(entries: WakeEntry[]): NowLine | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.type === "turn" && entry.lane === "work") {
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
