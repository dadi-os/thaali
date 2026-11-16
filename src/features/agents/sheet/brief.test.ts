import { describe, expect, it } from "vitest";
import type { AgentRecord, DurableMessage, JobLedger, WakeDetail, WakeMessage } from "../../../types/hath";
import { formatClock } from "../../../shared/lib/ux/time";
import { answerByOf, briefOf, nowLine, standingOf } from "./brief";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const OPENED = "2026-11-15T11:56:00Z";
const job = (over: Partial<JobLedger> = {}): JobLedger => ({
  job: 12,
  requester: null,
  opened: { seq: 12, at: OPENED, content: "Check the two pending charges." },
  answer_by: "2026-11-15T12:01:00Z",
  asks: [],
  helpers: [],
  stored: [],
  told: [],
  reminders: [],
  stopped: null,
  ...over,
});
const agent = (running: Partial<AgentRecord["running"]> = {}): Pick<AgentRecord, "id" | "running" | "updated_at"> => ({ id: "finance", updated_at: "2026-11-15T11:30:00Z", running: { working: false, waiting_on: null, job: null, ...running } });

describe("briefOf: the job ledger as copy", () => {
  it("says it works on Ankur's request, another agent's, or its own routine", () => {
    expect(briefOf(agent({ working: true, job: job() }), NOW)).toMatchObject({ tone: "working", headline: "Working on your request", ask: { who: "You", routine: false } });
    expect(briefOf(agent({ working: true, job: job({ requester: "career-manager" }) }), NOW).headline).toBe("Working for career-manager");
    expect(briefOf(agent({ working: true, job: job({ requester: "finance" }) }), NOW)).toMatchObject({ headline: "Running its routine", ask: { who: "Routine", routine: true } });
    expect(briefOf(agent({ working: true }), NOW)).toMatchObject({ headline: "Working", ask: null });
  });

  it("names what it waits on and since when", () => {
    const waiting_on = { targets: ["task/browser/3", "bob"], since: "2026-11-15T11:55:00Z", wakes_by: "2026-11-15T12:25:00Z" };
    expect(briefOf(agent({ waiting_on, job: job() }), NOW)).toMatchObject({ tone: "waiting", headline: `Waiting on task/browser/3, bob since ${formatClock(waiting_on.since)}` });
  });

  it("reads a stopped job as stopped by you, unless the loop has moved on", () => {
    const stopped = { at: "2026-11-15T11:58:00Z", by: "ankur" };
    expect(briefOf(agent({ job: job({ stopped }) }), NOW)).toMatchObject({ tone: "stopped", headline: `Stopped by you at ${formatClock(stopped.at)}` });
    expect(briefOf(agent({ job: job({ stopped: { at: stopped.at, by: "career-manager" } }) }), NOW).headline).toContain("Stopped by career-manager");
    expect(briefOf(agent({ working: true, job: job({ stopped }) }), NOW).tone).toBe("working");
  });

  it("is idle with its last activity when there is no job and no wait", () => {
    expect(briefOf(agent(), NOW)).toMatchObject({ tone: "idle", headline: "Idle · last active 30 minutes ago", ask: null, answerBy: null });
  });

  it("carries what it asked, told, stored and will check back on", () => {
    const brief = briefOf(
      agent({
        working: true,
        job: job({ asks: [{ to: "schedule", seq: 3, answered_seq: 4 }, { to: "health", seq: 5, answered_seq: null }], helpers: ["task/browser/3"], stored: ["Chase charges"], told: [{ seq: 6, preview: "Working on it." }], reminders: ["2026-11-15T12:20:00Z"] }),
      }),
      NOW,
    );
    expect(brief).toMatchObject({
      asked: [{ to: "schedule", replied: true }, { to: "health", replied: false }],
      helpers: ["task/browser/3"],
      stored: ["Chase charges"],
      told: ["Working on it."],
      checkBacks: ["2026-11-15T12:20:00Z"],
    });
  });
});

describe("answerByOf", () => {
  it("counts down to the answer time, then counts how late it is", () => {
    expect(answerByOf(job(), NOW)).toEqual({ overdue: false, label: "Answer due in 1m" });
    expect(answerByOf(job({ answer_by: "2026-11-15T11:57:00Z" }), NOW)).toEqual({ overdue: true, label: "Answer 3m overdue" });
  });

  it("has no clock once the requester was told, or for a job with no answer time", () => {
    expect(answerByOf(job({ told: [{ seq: 7, preview: "Done" }] }), NOW)).toBeNull();
    expect(answerByOf(job({ answer_by: null }), NOW)).toBeNull();
  });
});

describe("nowLine", () => {
  it("is the ask while working, the headline while waiting or stopped, and empty at rest", () => {
    expect(nowLine(agent({ working: true, job: job() }), NOW)).toBe("Check the two pending charges.");
    expect(nowLine(agent({ job: job({ stopped: { at: OPENED, by: "ankur" } }) }), NOW)).toContain("Stopped by you");
    expect(nowLine(agent(), NOW)).toBe("");
  });
});

const message = (seq: number, over: Partial<DurableMessage> = {}): DurableMessage => ({ id: `m${seq}`, seq, from_agent_id: "finance", to_agent_id: null, content: `message ${seq}`, attachments: [], created_at: OPENED, ...over });
const sent = (seq: number, over: Partial<WakeMessage> = {}): WakeMessage => ({ id: `m${seq}`, seq, kind: "message", status: null, from_agent_id: "finance", to_agent_id: null, content: `message ${seq}`, created_at: OPENED, attachments: [], ...over });
const wake = (entries: Array<{ direction: "sent" | "received"; message: WakeMessage }>): WakeDetail => ({ wake: {} as WakeDetail["wake"], entries: entries.map((entry, ord) => ({ ord, at: OPENED, type: "message" as const, ...entry })) });

describe("standingOf: what the thread still waits on", () => {
  it("reads needs_input and blocked from the agent's newest message, and a done one leaves nothing open", () => {
    expect(standingOf([message(1, { status: "done" }), message(2, { status: "needs_input" })], [])).toMatchObject({ status: "needs_input", content: "message 2" });
    expect(standingOf([message(2, { status: "blocked" })], [])).toMatchObject({ status: "blocked" });
    expect(standingOf([message(2, { status: "needs_input" }), message(3, { status: "done" })], [])).toBeNull();
  });

  it("is settled by Ankur's newer message and never read from a notice", () => {
    expect(standingOf([message(2, { status: "needs_input" }), message(3, { from_agent_id: null, to_agent_id: "finance" })], [])).toBeNull();
    expect(standingOf([message(2, { status: "needs_input" }), message(3, { kind: "notice", status: null })], [])).toMatchObject({ status: "needs_input" });
  });

  it("reads the human messages of the wakes when the thread route carries no status", () => {
    const asked = wake([{ direction: "sent", message: sent(9, { status: "needs_input" }) }]);
    expect(standingOf([message(9)], [asked])).toMatchObject({ status: "needs_input", content: "message 9" });
    const answered = wake([{ direction: "received", message: sent(10, { from_agent_id: null, to_agent_id: "finance" }) }]);
    expect(standingOf([message(9)], [answered, asked])).toBeNull();
    const note = wake([{ direction: "received", message: sent(11, { kind: "notice", from_agent_id: "finance", to_agent_id: "finance" }) }]);
    expect(standingOf([message(9)], [note, asked])).toMatchObject({ status: "needs_input" });
    expect(standingOf([], [])).toBeNull();
  });
});
