import { describe, expect, it } from "vitest";
import type { AgentRecord, JobLedger } from "../../../types/hath";
import { agentFacts, duration, relative, situationOf, targetWords } from "./facts";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const iso = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
const job = (over: Partial<JobLedger> = {}): JobLedger => ({ job: 1, requester: null, opened: { seq: 1, at: iso(-4), content: "Check the two pending charges." }, answer_by: iso(1), asks: [], helpers: [], stored: [], told: [], reminders: [], stopped: null, ...over });
const agent = (running: Partial<AgentRecord["running"]> = {}, sessions: AgentRecord["sessions"] = { tasks: [] }): Pick<AgentRecord, "id" | "running" | "updated_at" | "sessions" | "created_at"> => ({ id: "finance", updated_at: iso(-180), created_at: iso(-30 * 1440), sessions, running: { working: false, waiting_on: null, job: null, ...running } });
const nameOf = (id: string | null) => (id === null ? "Ankur" : id);

describe("time words", () => {
  it("says how long in the fewest honest words", () => {
    expect(duration(20_000)).toBe("under a minute");
    expect(duration(4 * 60_000)).toBe("4 min");
    expect(duration(130 * 60_000)).toBe("2 h 10 min");
    expect(duration(5 * 3_600_000)).toBe("5 h");
    expect(duration(3 * 86_400_000)).toBe("3 d");
    expect(relative(iso(-4), NOW)).toBe("4 min ago");
    expect(relative(iso(20), NOW)).toBe("in 20 min");
    expect(relative(iso(0), NOW)).toBe("just now");
  });
});

describe("situationOf: one line", () => {
  it("puts what needs Ankur first, then stopped, overdue, working, waiting, idle", () => {
    const waiting = { targets: ["bob"], since: iso(-3), wakes_by: iso(20) };
    expect(situationOf(agent({ job: job() }), { status: "needs_input", content: "?", at: iso(-1) }, NOW)).toEqual({ tone: "wait", text: "Needs your input" });
    expect(situationOf(agent(), { status: "blocked", content: "?", at: iso(-1) }, NOW)).toEqual({ tone: "late", text: "Blocked" });
    expect(situationOf(agent({ job: job({ stopped: { at: iso(-6), by: "ankur" } }) }), null, NOW)).toEqual({ tone: "late", text: "Stopped 6 min ago" });
    expect(situationOf(agent({ working: true, job: job({ answer_by: iso(-4) }) }), null, NOW)).toEqual({ tone: "late", text: "Answer 4m overdue" });
    expect(situationOf(agent({ working: true, job: job() }), null, NOW)).toEqual({ tone: "live", text: "Working · 4 min" });
    expect(situationOf(agent({ waiting_on: waiting }), null, NOW)).toEqual({ tone: "wait", text: "Waiting" });
    expect(situationOf(agent(), null, NOW)).toEqual({ tone: "rest", text: "Idle" });
  });
});

describe("agentFacts: only true, labelled facts", () => {
  it("states the ask and what the agent did, with no ids, and no answer clock once it has told the requester", () => {
    const facts = agentFacts({
      agent: agent({ working: true, job: job({ asks: [{ to: "health", seq: 2, answered_seq: null }], stored: ["Chase charges"], told: [{ seq: 3, preview: "Working on it." }], reminders: [iso(20)] }) }),
      counts: { tool_calls: 7, messages_sent: 1 },
      nameOf,
      now: NOW,
    });
    expect(facts.map((fact) => [fact.label, fact.value])).toEqual([
      ["Asked by", "You"],
      ["Task", "Check the two pending charges."],
      ["So far", "7 tool calls · 1 message sent"],
      ["Asked health", "No reply yet"],
      ["Told you", "Working on it."],
      ["Saved to memory", "Chase charges"],
      ["Checks back", "in 20 min"],
      ["Last active", "3 h ago"],
      ["Created", expect.any(String)],
    ]);
  });

  it("puts the agent's own words first when its message waits on Ankur", () => {
    const facts = agentFacts({ agent: agent(), counts: undefined, nameOf, now: NOW, standing: { status: "needs_input", content: "Move gym to Friday?", at: iso(-12) } });
    expect(facts[0]).toMatchObject({ label: "Asked you", value: "Move gym to Friday?", hint: "12 min ago", long: true });
    expect(agentFacts({ agent: agent(), counts: undefined, nameOf, now: NOW, standing: { status: "blocked", content: "Cannot sign in.", at: iso(-1) } })[0]!.label).toBe("Stuck on");
  });

  it("puts Created right under Last active with how long ago in weeks", () => {
    const facts = agentFacts({ agent: agent(), counts: undefined, nameOf, now: NOW });
    expect(facts.map((fact) => fact.label).slice(-2)).toEqual(["Last active", "Created"]);
    expect(facts[facts.length - 1]!.hint).toBe("4 weeks ago");
    expect(duration(56 * 86_400_000)).toBe("8 weeks");
    expect(duration(90 * 86_400_000)).toBe("3 months");
  });

  it("flags an answer past its time and says who stopped a job", () => {
    expect(agentFacts({ agent: agent({ job: job({ answer_by: iso(-4) }) }), counts: undefined, nameOf, now: NOW }).find((fact) => fact.label === "Answer was due")).toMatchObject({ value: "4 min ago", tone: "late" });
    expect(agentFacts({ agent: agent({ job: job({ stopped: { at: iso(-6), by: "ankur" } }) }), counts: undefined, nameOf, now: NOW }).find((fact) => fact.label === "Stopped")).toMatchObject({ value: "by you", hint: "6 min ago" });
  });

  it("names a wait by who it waits on, a helper by its kind and never by an address", () => {
    const sessions = { tasks: [{ id: "task/terminal/c5728f", kind: "terminal" as const, status: "working" as const, purpose: "Build it", current: "", last_activity: iso(-1) }] };
    expect(targetWords("task/terminal/c5728f", sessions.tasks, nameOf)).toBe("a terminal helper");
    expect(targetWords("task/browser/9", [], nameOf)).toBe("a browser helper");
    expect(targetWords("bob", [], nameOf)).toBe("bob");
    const facts = agentFacts({ agent: agent({ waiting_on: { targets: ["task/terminal/c5728f"], since: iso(-3), wakes_by: iso(20) } }, sessions), counts: undefined, nameOf, now: NOW });
    expect(facts.find((fact) => fact.label === "Waiting on")).toMatchObject({ value: "a terminal helper", hint: "for 3 min" });
  });

  it("gives an idle agent real facts, and drops the ones that are not true", () => {
    expect(agentFacts({ agent: agent(), counts: undefined, nameOf, now: NOW }).map((fact) => fact.label)).toEqual(["Last active", "Created"]);
    const facts = agentFacts({ agent: agent(), counts: undefined, nameOf, now: NOW, parent: { id: "boss", name: "career-manager" } });
    expect(facts.map((fact) => [fact.label, fact.value]).slice(0, 2)).toEqual([
      ["Reports to", "career-manager"],
      ["Last active", "3 h ago"],
    ]);
    expect(facts.map((fact) => fact.label)).not.toContain("Helpers");
    expect(facts.map((fact) => fact.label)).not.toContain("Routines");
  });

});
