import { describe, expect, it } from "vitest";
import type { AgentRecord } from "../types/hath";
import {
  applyWakeEvent,
  clearRouterRuns,
  getLiveWake,
  getRunning,
  seedRunningFromAgents,
  endRouterRun,
  hasLocalSend,
  isRouting,
  seedRouterRuns,
  setLocalSend,
  startRouterRun,
} from "./running";

describe("router runs", () => {
  it("stays routing until every overlapping run has ended", () => {
    clearRouterRuns();
    startRouterRun("a");
    startRouterRun("b");
    endRouterRun("a");
    expect(isRouting()).toBe(true);
    endRouterRun("b");
    expect(isRouting()).toBe(false);
  });

  it("ignores the end of a run it never heard start", () => {
    clearRouterRuns();
    endRouterRun("unknown");
    expect(isRouting()).toBe(false);
  });

  it("takes Hath's list as the runs in flight when a device connects mid-run", () => {
    clearRouterRuns();
    seedRouterRuns(["a", "b"]);
    expect(isRouting()).toBe(true);
    seedRouterRuns([]);
    expect(isRouting()).toBe(false);
  });

  it("counts this device's own send as routing until it answers", () => {
    clearRouterRuns();
    setLocalSend(true);
    expect(isRouting()).toBe(true);
    expect(hasLocalSend()).toBe(true);
    setLocalSend(false);
    expect(isRouting()).toBe(false);
    expect(hasLocalSend()).toBe(false);
  });

  it("forgets every run when the mesh goes away", () => {
    startRouterRun("a");
    clearRouterRuns();
    expect(isRouting()).toBe(false);
  });
});

const AT = "2026-11-15T12:00:00.000Z";
const agent = (id: string, running: Partial<AgentRecord["running"]> = {}) => ({ id, running: { working: false, waiting_on: null, job: null, ...running } }) as AgentRecord;

describe("wake events", () => {
  it("marks the loop working on wake_started and idle on wake_ended, keeping the ledger the list gave", () => {
    const job = { job: 7, requester: null, opened: { seq: 7, at: AT, content: "x" }, answer_by: null, asks: [], helpers: [], stored: [], told: [], reminders: [], stopped: null };
    seedRunningFromAgents([agent("a", { job })]);
    applyWakeEvent({ type: "wake_started", agent_id: "a", wake_id: "w1", reason: { kind: "message", ref: null }, at: AT });
    expect(getRunning().a).toMatchObject({ working: true, job });
    expect(getLiveWake("a")).toEqual({ wakeId: "w1", counts: { tool_calls: 0, messages_sent: 0, messages_received: 0 } });
    applyWakeEvent({ type: "wake_ended", agent_id: "a", wake_id: "w1", outcome: "waiting", at: AT });
    expect(getRunning().a).toMatchObject({ working: false, job });
    expect(getLiveWake("a")).toBeUndefined();
  });

  it("takes the counts of wake_activity and creates the agent a start names before it was listed", () => {
    seedRunningFromAgents([]);
    applyWakeEvent({ type: "wake_started", agent_id: "new", wake_id: "w2", reason: { kind: "schedule", ref: "r1" }, at: AT });
    applyWakeEvent({ type: "wake_activity", agent_id: "new", wake_id: "w2", counts: { tool_calls: 4, messages_sent: 1, messages_received: 2 } });
    expect(getRunning().new).toEqual({ working: true, waiting_on: null, job: null });
    expect(getLiveWake("new")?.counts).toEqual({ tool_calls: 4, messages_sent: 1, messages_received: 2 });
  });

  it("drops the live wake of an agent a refetch says is no longer working", () => {
    seedRunningFromAgents([]);
    applyWakeEvent({ type: "wake_started", agent_id: "b", wake_id: "w3", reason: { kind: "manual", ref: null }, at: AT });
    seedRunningFromAgents([agent("b", { working: false })]);
    expect(getLiveWake("b")).toBeUndefined();
    expect(getRunning().b?.working).toBe(false);
  });
});
