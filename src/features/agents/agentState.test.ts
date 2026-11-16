import { describe, expect, it } from "vitest";
import type { AgentRunning, JobLedger } from "../../types/hath";
import { agentMark, agentState, keepsState } from "./agentState";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const job = (over: Partial<JobLedger> = {}): JobLedger => ({ job: 1, requester: null, opened: { seq: 1, at: "2026-11-15T11:50:00Z", content: "x" }, answer_by: null, asks: [], helpers: [], stored: [], told: [], reminders: [], stopped: null, ...over });
const running = (over: Partial<AgentRunning> = {}): AgentRunning => ({ working: false, waiting_on: null, job: null, ...over });
const waiting = { targets: ["bob"], since: "2026-11-15T11:55:00Z", wakes_by: "2026-11-15T12:25:00Z" };

describe("agentState", () => {
  it("is working while the loop runs, waiting on a watch, idle otherwise; the live block wins over the listed one", () => {
    expect(agentState({ running: running({ working: true }) })).toBe("working");
    expect(agentState({ running: running({ waiting_on: waiting }) })).toBe("waiting");
    expect(agentState({ running: running() })).toBe("idle");
    expect(agentState({ running: running() }, running({ working: true }))).toBe("working");
  });

  it("keeps by state under each filter chip", () => {
    expect(keepsState("All", "idle")).toBe(true);
    expect(keepsState("Working", "waiting")).toBe(false);
    expect(keepsState("Waiting", "waiting")).toBe(true);
  });
});

describe("agentMark", () => {
  it("flags a stopped job, and an answer past its time with nothing sent, and nothing else", () => {
    expect(agentMark(running(), NOW)).toBeNull();
    expect(agentMark(running({ job: job() }), NOW)).toBeNull();
    expect(agentMark(running({ job: job({ stopped: { at: "2026-11-15T11:58:00Z", by: "ankur" } }) }), NOW)).toBe("stopped");
    expect(agentMark(running({ job: job({ answer_by: "2026-11-15T11:55:00Z" }) }), NOW)).toBe("overdue");
    expect(agentMark(running({ job: job({ answer_by: "2026-11-15T12:05:00Z" }) }), NOW)).toBeNull();
    expect(agentMark(running({ job: job({ answer_by: "2026-11-15T11:55:00Z", told: [{ seq: 2, preview: "On it" }] }) }), NOW)).toBeNull();
  });
});
