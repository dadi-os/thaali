import type { LogRecord, WakeCursor, WakeEntry, WakeList, WakeMessage, WakeSummary, WakeToolCall } from "../../types/hath";
import type { Scenario } from "../scenario";
import { agents } from "./hath";
import { ago, MIN } from "./time";

/** One wake as the fixtures hold it: its summary and the entries `GET /agents/:id/wakes/:wake_id` returns. */
type FixtureWake = { summary: WakeSummary; entries: WakeEntry[] };

/** How many wakes each fixture agent has, enough for the timeline to scroll and page twice. */
const WAKE_COUNT = 26;

/** Wakes from this position on (newest is 0) have aged out of the activity log and keep only their messages. */
const TRIMMED_FROM = 18;

/** The whole of the one tool result the fixtures cut short; the wake shows its first characters. */
const LONG_RESULT = Array.from({ length: 120 }, (_, n) => `row ${n + 1}: 2026-10-${String((n % 28) + 1).padStart(2, "0")},Merchant ${n + 1},${(12.4 + n).toFixed(2)}`).join("\n");

/** How much of {@link LONG_RESULT} a wake carries before it says it is cut. */
const CUT_AT = 240;

/** The calls of the work lane in the newest wake: name, input, what it answered and whether that was an error. */
const WORK_CALLS: ReadonlyArray<{ name: string; input: Record<string, unknown>; result: string; error?: true; text?: string; thinking?: string }> = [
  { name: "list_files", input: { path: "~/finance" }, result: "statements/\nbudget.md\nreceipts/", thinking: "The October statement should be under ~/finance/statements.\nI will list it first." },
  { name: "read_file", input: { path: "~/finance/statements/2026-10.csv" }, result: LONG_RESULT },
  { name: "read_file", input: { path: "~/finance/budget.md" }, result: "Spotify 12.40 monthly\nGym 38.00 monthly" },
  { name: "search_files", input: { pattern: "Spotify", path: "~/finance/receipts" }, result: "index unavailable: receipts are not indexed yet", error: true },
  { name: "run_command", input: { cmd: "grep -ril spotify ~/finance/receipts" }, result: '{"exit":0,"stdout":"receipts/spotify-oct.pdf\\n"}', text: "The index is down, so I searched the receipts folder directly." },
  { name: "recall", input: { query: "gym membership monthly charge" }, result: "Gym: $38.00 monthly, charged on the 6th." },
];

/** The other agent that opens some of an agent's wakes. */
const PEER = "efficiency-specialist";

/** A message row of a wake. */
function message(seq: number, from: string | null, to: string | null, content: string, minutesAgo: number): WakeMessage {
  return { id: `7c1e2b9a-3d4f-4e55-8a10-${String(seq).padStart(12, "0")}`, seq, kind: "message", status: null, from_agent_id: from, to_agent_id: to, content, created_at: ago(minutesAgo * MIN), attachments: [] };
}

/** The six shapes a wake takes, in the order they repeat from the newest. */
const SHAPES = ["ankur", "schedule", "peer", "failed", "steer", "ankur"] as const;

/** One wake of an agent, number `n` counted from the newest; the newest is running when `running`, else the agent's latest wake waits on a task. */
function build(agentId: string, n: number, running: boolean): FixtureWake {
  const shape = SHAPES[n % SHAPES.length]!;
  const startedMin = 4 + n * 53;
  const durationMin = running && n === 0 ? 0 : 2 + (n % 7) * 2;
  const wakeId = `0b6f7d5e-6a0c-4b1e-9a43-2f1d7c3a${String(1000 + n).padStart(4, "0")}`;
  const trimmed = n >= TRIMMED_FROM;
  const seq0 = 24000 - n * 4;
  const opener =
    shape === "peer" ? message(seq0, PEER, agentId, "Can you confirm the gym charge for the weekly review?", startedMin)
    : shape === "schedule" ? message(seq0, agentId, agentId, "Morning money check: balances and anything pending.", startedMin)
    : shape === "steer" ? null
    : message(seq0, null, agentId, "Reconcile the October statement against the budget.", startedMin);
  const reason: WakeSummary["reason"] =
    shape === "peer" ? { kind: "message", ref: PEER }
    : shape === "schedule" ? { kind: "schedule", ref: "5e0a7b1c-1111-4c22-9d33-aaaaaaaaaa01" }
    : shape === "steer" ? { kind: "steer", ref: null }
    : { kind: "message", ref: null };
  const reply = message(seq0 + 1, agentId, opener?.from_agent_id ?? null, "Both pending charges are expected:\n- **$12.40** Spotify, renews on the 3rd\n- **$38.00** gym, monthly", startedMin - durationMin);
  const entries: WakeEntry[] = [];
  let ord = 0;
  const at = (offsetMin: number) => ago((startedMin - offsetMin) * MIN);
  if (opener !== null) {
    entries.push({ ord: ord++, at: opener.created_at, type: "message", direction: "received", message: opener });
  }
  if (!trimmed) {
    const usage = { input_tokens: 4, output_tokens: 310 + n * 20, cache_write: 1200, cache_read: 22_000 };
    entries.push({
      ord: ord++, at: at(0.1), type: "turn", lane: "process", usage,
      thinking: "This needs file reads, so the work lane should do it and I report back.\nI will hand it off.",
      text: "I'll have the work lane read the statement and the budget.",
      calls: [{ id: `toolu_${n}_p`, name: "steer_work", input: { instruction: "Reconcile the October statement against the budget." }, log_id: `a1f0c0de-0000-4000-8000-${String(n).padStart(4, "0")}00000000`, result: { content: '{"queued":true,"running":false,"terminated":false}', is_error: false, truncated: false, chars: 52 } }],
    });
    const calls = shape === "ankur" || n === 0 ? WORK_CALLS : WORK_CALLS.slice(0, 2);
    calls.forEach((call, i) => {
      const last = running && n === 0 && i === calls.length - 1;
      const cut = call.result === LONG_RESULT;
      const toolCall: WakeToolCall = {
        id: `toolu_${n}_${i}`,
        name: call.name,
        input: call.input,
        log_id: last ? null : `a1f0c0de-0000-4000-8000-${String(n).padStart(4, "0")}${String(i + 1).padStart(8, "0")}`,
        result: last ? null : { content: cut ? call.result.slice(0, CUT_AT) : call.result, is_error: call.error === true, truncated: cut, chars: call.result.length },
      };
      entries.push({ ord: ord++, at: at(0.5 + i * 0.4), type: "turn", lane: "work", usage, thinking: call.thinking ?? null, text: call.text ?? null, calls: [toolCall] });
    });
    if (!(running && n === 0)) {
      entries.push({ ord: ord++, at: at(durationMin - 0.2), type: "message", direction: "sent", message: reply });
    }
  } else if (opener !== null) {
    entries.push({ ord: ord++, at: reply.created_at, type: "message", direction: "sent", message: reply });
  }
  const toolCalls = entries.reduce((sum, entry) => sum + (entry.type === "turn" ? entry.calls.filter((call) => call.result !== null).length : 0), 0);
  const failed = shape === "failed" && !(running && n === 0);
  const summary: WakeSummary = {
    id: wakeId,
    agent_id: agentId,
    reason,
    opened_by: opener,
    started_at: ago(startedMin * MIN),
    ended_at: running && n === 0 ? null : ago((startedMin - durationMin) * MIN),
    outcome: running && n === 0 ? "running" : failed ? "failed" : n === 0 ? "waiting" : "yielded",
    error: failed ? "work lane stopped: prompt reached the 96000-token ceiling" : null,
    usage: trimmed ? { calls: 0, input_tokens: 0, output_tokens: 0, cache_write: 0, cache_read: 0 } : { calls: entries.filter((entry) => entry.type === "turn").length, input_tokens: 52, output_tokens: 6200 + n * 300, cache_write: 18_000, cache_read: 240_000 + n * 9000 },
    counts: {
      tool_calls: toolCalls,
      messages_sent: entries.filter((entry) => entry.type === "message" && entry.direction === "sent").length,
      messages_received: entries.filter((entry) => entry.type === "message" && entry.direction === "received").length,
    },
    activity_trimmed: trimmed,
  };
  return { summary, entries };
}

/** Every wake of a fixture agent, newest first; the newest is running while the agent's work lane runs. */
function wakesOf(scenario: Scenario, agentId: string): FixtureWake[] {
  const agent = agents(scenario).find((candidate) => candidate.id === agentId);
  const running = agent?.running.work === true;
  return Array.from({ length: WAKE_COUNT }, (_, n) => build(agentId, n, running));
}

/** Hath `GET /agents/:id/wakes`: a page of wakes, newest first, from after `before` when given. */
export function wakeList(scenario: Scenario, agentId: string, limit: number, before: WakeCursor | null): WakeList {
  const all = wakesOf(scenario, agentId);
  const start = before === null ? 0 : all.findIndex((wake) => wake.summary.id === before.id) + 1;
  const page = all.slice(start, start + limit);
  const last = page[page.length - 1];
  return { wakes: page.map((wake) => wake.summary), next_before: start + limit < all.length && last !== undefined ? { started_at: last.summary.started_at, id: last.summary.id } : null };
}

/** Hath `GET /agents/:id/wakes/:wake_id`; throws like Hath's `wake_not_found` when the agent has no such wake. */
export function wakeDetail(scenario: Scenario, agentId: string, wakeId: string): { wake: WakeSummary; entries: WakeEntry[] } {
  const found = wakesOf(scenario, agentId).find((wake) => wake.summary.id === wakeId);
  if (found === undefined) {
    throw new Error(`fixtures: wake_not_found ${wakeId}`);
  }
  return { wake: found.summary, entries: found.entries };
}

/** Hath `GET /agents/:id/logs/:log_id`: the raw `tool_result` row of a call; throws like Hath's `log_not_found`. */
export function logRow(scenario: Scenario, agentId: string, logId: string): { log: LogRecord } {
  for (const wake of wakesOf(scenario, agentId)) {
    for (const entry of wake.entries) {
      if (entry.type !== "turn") {
        continue;
      }
      for (const call of entry.calls) {
        if (call.log_id === logId && call.result !== null) {
          const content = call.result.truncated ? LONG_RESULT : call.result.content;
          return { log: { id: logId, agent_id: agentId, lane: entry.lane, event: "tool_result", payload: { name: call.name, content, is_error: call.result.is_error, tool_use_id: call.id }, wake_id: wake.summary.id, created_at: entry.at } };
        }
      }
    }
  }
  throw new Error(`fixtures: log_not_found ${logId}`);
}
