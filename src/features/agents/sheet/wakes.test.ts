import { describe, expect, it } from "vitest";
import type { WakeEntry } from "../../../types/hath";
import { wakeDetail, wakeList } from "../../../dev/fixtures/wakes";
import { callTarget, countsLine, filterEntries, haltSentence, nowLine, prettyJson, rawContent, reasonLine, usageChip, wakeDuration } from "./wakes";

/** The newest wake of the fixtures' working agent: running, with its last work call unanswered. */
function runningEntries(): WakeEntry[] {
  const [newest] = wakeList("normal", "finance-specialist", 5, null).wakes;
  return wakeDetail("normal", "finance-specialist", newest!.id).entries;
}

describe("reasonLine", () => {
  it("names the sender of a message wake, Ankur when it has none", () => {
    expect(reasonLine({ kind: "message", ref: "career-manager" })).toEqual({ lead: "Opened by", agentId: "career-manager", name: "career-manager" });
    expect(reasonLine({ kind: "message", ref: null })).toEqual({ lead: "Opened by", agentId: null, name: "Ankur" });
  });

  it("states every other reason without naming anyone", () => {
    expect(reasonLine({ kind: "schedule", ref: "s1" }).lead).toBe("Schedule");
    expect(reasonLine({ kind: "recovery", ref: null }).lead).toBe("Recovery");
    expect(reasonLine({ kind: "steer", ref: null }).lead).toBe("Steer");
    expect(reasonLine({ kind: "manual", ref: null })).toEqual({ lead: "Manual", agentId: null, name: null });
  });
});

describe("wake figures", () => {
  it("counts what a wake did and leaves out zeros", () => {
    expect(countsLine({ tool_calls: 22, messages_sent: 1, messages_received: 1 })).toBe("22 tool calls · 1 in · 1 out");
    expect(countsLine({ tool_calls: 1, messages_sent: 0, messages_received: 0 })).toBe("1 tool call");
    expect(countsLine({ tool_calls: 0, messages_sent: 0, messages_received: 0 })).toBe("");
  });

  it("reads tokens and cache into one chip", () => {
    expect(usageChip({ calls: 14, input_tokens: 52, output_tokens: 21_340, cache_write: 188_200, cache_read: 940_100 })).toBe("21.4k tok · 940.1k cached");
  });

  it("measures an ended wake by its end and a running one by now", () => {
    const start = "2026-11-08T22:00:00.000Z";
    expect(wakeDuration({ started_at: start, ended_at: "2026-11-08T22:06:41.900Z" }, 0)).toBe("7m");
    expect(wakeDuration({ started_at: start, ended_at: null }, Date.parse(start) + 12_000)).toBe("12s");
  });
});

describe("callTarget", () => {
  it("prefers the keys that name a target and cuts long text", () => {
    expect(callTarget({ id: "task/browser/4fa9b970", message: "Read only..." })).toBe("task/browser/4fa9b970");
    expect(callTarget({ path: "~/finance/budget.md", content: "x" })).toBe("~/finance/budget.md");
    expect(callTarget({ instruction: "x".repeat(200) })).toHaveLength(72);
  });

  it("falls to the first text value, and is empty when there is none", () => {
    expect(callTarget({ flag: true, other: "hello" })).toBe("hello");
    expect(callTarget({})).toBe("");
    expect(callTarget(null)).toBe("");
  });
});

describe("filterEntries", () => {
  it("keeps entries in order, and every message under a lane filter", () => {
    const entries = runningEntries();
    expect(entries.map((entry) => entry.ord)).toEqual([...entries.map((entry) => entry.ord)].sort((a, b) => a - b));
    const work = filterEntries(entries, "Work");
    expect(work.some((entry) => entry.type === "turn" && entry.lane === "process")).toBe(false);
    expect(work.some((entry) => entry.type === "turn" && entry.lane === "work")).toBe(true);
    expect(work.filter((entry) => entry.type === "message")).toEqual(entries.filter((entry) => entry.type === "message"));
    const process = filterEntries(entries, "Process");
    expect(process.some((entry) => entry.type === "turn" && entry.lane === "work")).toBe(false);
    expect(filterEntries(entries, "All")).toBe(entries);
  });
});

describe("nowLine", () => {
  it("reads the work lane's latest call, running while it has no result", () => {
    const line = nowLine(runningEntries());
    expect(line).toMatchObject({ name: "recall", target: "gym membership monthly charge", running: true });
  });

  it("ignores the process lane and answers null when the work lane has not called anything", () => {
    const entries = runningEntries().filter((entry) => entry.type === "message" || entry.lane === "process");
    expect(nowLine(entries)).toBeNull();
    expect(nowLine([])).toBeNull();
  });

  it("is not running once the call has its result", () => {
    const answered = runningEntries().map((entry): WakeEntry => (entry.type === "turn" ? { ...entry, calls: entry.calls.map((call) => ({ ...call, result: call.result ?? { content: "ok", is_error: false, truncated: false, chars: 2 } })) } : entry));
    expect(nowLine(answered)?.running).toBe(false);
  });
});

describe("haltSentence", () => {
  it("turns Hath's error codes into plain sentences", () => {
    expect(haltSentence(new Error('HTTP 404 POST http://hath.dadi/x: {"error":{"type":"task_not_found"}}'))).toBe("That task no longer exists.");
    expect(haltSentence(new Error("HTTP 409 POST x: task_conflict"))).toBe("The task changed while stopping it; try again.");
    expect(haltSentence(new Error("HTTP 502 POST x: nas down"))).toBe("Nas did not answer, so the task was not stopped.");
  });
});

describe("tool text", () => {
  it("indents JSON and leaves other text and unfinished JSON as received", () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyJson("plain")).toBe("plain");
    expect(prettyJson('{"a":')).toBe('{"a":');
    expect(prettyJson({ b: 2 })).toBe('{\n  "b": 2\n}');
  });

  it("reads a raw row's content, or the whole payload when it has no text", () => {
    expect(rawContent({ payload: { content: "full text" } })).toBe("full text");
    expect(rawContent({ payload: { name: "x" } })).toBe('{\n  "name": "x"\n}');
  });
});
