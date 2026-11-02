import { describe, expect, it } from "vitest";
import type { AgentRecord, AgentStatus } from "../../../types/hath";
import { formatClock } from "../../../shared/lib/ux/time";
import { workLine } from "./workLine";

const SINCE = "2026-10-28T14:20:00Z";
const NOW = Date.parse("2026-10-28T14:42:00Z");

/** An agent whose status block says `work`, or that has no status block. */
function agent(work: AgentStatus["work"] | null, waiting: AgentRecord["running"]["waiting_on"] = null): Pick<AgentRecord, "running" | "updated_at"> {
  const status = work === null ? null : ({ job: null, work, step: null, recent: [], tasks: [], tasks_unreadable: null, pending: [] } satisfies AgentStatus);
  return { running: { work: work !== null, process: false, waiting_on: waiting, status }, updated_at: "2026-10-28T14:12:00Z" };
}

describe("workLine", () => {
  it("says what the work lane is doing, with the time it began waiting or last stepped", () => {
    expect(workLine(agent({ state: "running", since: SINCE, waiting_on: [] }), NOW)).toBe(`Working, last step ${formatClock(SINCE)}`);
    expect(workLine(agent({ state: "waiting", since: SINCE, waiting_on: ["task/browser/3", "bob"] }), NOW)).toBe(`Waiting on task/browser/3, bob since ${formatClock(SINCE)}`);
    expect(workLine(agent({ state: "idle", since: null, waiting_on: [] }), NOW)).toBe("Idle");
  });

  it("leaves out a time Hath did not give", () => {
    expect(workLine(agent({ state: "running", since: null, waiting_on: [] }), NOW)).toBe("Working");
    expect(workLine(agent({ state: "waiting", since: null, waiting_on: ["bob"] }), NOW)).toBe("Waiting on bob");
  });

  it("reads the wait itself when no status block is sent, and otherwise the last activity", () => {
    expect(workLine(agent(null, { targets: ["task/browser/3"], since: SINCE, wakes_by: SINCE }), NOW)).toBe(`Waiting on task/browser/3 since ${formatClock(SINCE)}`);
    expect(workLine(agent(null), NOW)).toBe("Idle · last active 30 minutes ago");
  });
});
