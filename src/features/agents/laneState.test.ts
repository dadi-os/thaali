import { describe, expect, it } from "vitest";
import { agents } from "../../dev/fixtures/hath";
import type { AgentRecord } from "../../types/hath";
import { isLive, keepsState, laneState, LANE_FILTERS, type LaneState } from "./laneState";

const base: AgentRecord = agents("normal")[0]!;
const withRunning = (running: Partial<AgentRecord["running"]>): AgentRecord => ({ ...base, running: { work: false, process: false, waiting_on: null, status: null, ...running } });

describe("laneState", () => {
  it("reads the lanes an agent has running", () => {
    expect(laneState(withRunning({ work: true, process: true }), undefined)).toBe("both");
    expect(laneState(withRunning({ work: true }), undefined)).toBe("working");
    expect(laneState(withRunning({ process: true }), undefined)).toBe("processing");
  });

  it("prefers the live lanes the events reported over the ones the list carried", () => {
    expect(laneState(withRunning({}), { work: true, process: false })).toBe("working");
    expect(laneState(withRunning({ work: true }), { work: false, process: false })).toBe("idle");
  });

  it("calls an agent that waits on something waiting, and one with nothing to do idle", () => {
    const waiting = { targets: ["task/browser/3"], since: "2026-10-28T14:00:00.000Z", wakes_by: "2026-10-28T15:00:00.000Z" };
    expect(laneState(withRunning({ waiting_on: waiting }), undefined)).toBe("waiting");
    expect(laneState(withRunning({}), undefined)).toBe("idle");
  });

  it("counts only a running lane as live", () => {
    expect(["both", "working", "processing"].every((state) => isLive(state as never))).toBe(true);
    expect(isLive("waiting")).toBe(false);
    expect(isLive("idle")).toBe(false);
  });
});

describe("keepsState", () => {
  const states: LaneState[] = ["both", "working", "processing", "waiting", "idle"];

  it("keeps every state under All", () => {
    expect(states.every((state) => keepsState("All", state))).toBe(true);
  });

  it("counts an agent on both lanes under Working and under Processing", () => {
    expect(states.filter((state) => keepsState("Working", state))).toEqual(["both", "working"]);
    expect(states.filter((state) => keepsState("Processing", state))).toEqual(["both", "processing"]);
  });

  it("keeps a waiting agent only under Waiting and an idle one only under Idle", () => {
    expect(states.filter((state) => keepsState("Waiting", state))).toEqual(["waiting"]);
    expect(states.filter((state) => keepsState("Idle", state))).toEqual(["idle"]);
  });

  it("names a chip for each state group, All first", () => {
    expect(Object.keys(LANE_FILTERS)).toEqual(["All", "Working", "Processing", "Waiting", "Idle"]);
  });
});
