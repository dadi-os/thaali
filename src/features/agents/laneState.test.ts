import { describe, expect, it } from "vitest";
import { agents } from "../../dev/fixtures/hath";
import type { AgentRecord } from "../../types/hath";
import { isLive, laneState } from "./laneState";

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
