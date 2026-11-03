import { describe, expect, it } from "vitest";
import type { ActivityStep, ActivityWake } from "./activity";
import { feedKeys, foldedCount, hiddenWakes, laneFilterOf, shownWakes, wakeTitle } from "./feed";

const step = (key: string, lane: "process" | "work"): ActivityStep => ({ kind: "turn", key, lane, at: "2026-10-28T10:00:00.000Z", thought: null, parts: [] });
const wake = (key: string, steps: ActivityStep[]): ActivityWake => ({ key, startedAt: "2026-10-28T10:00:00.000Z", at: "2026-10-28T10:01:00.000Z", steps, lanes: [...new Set(steps.map((s) => s.lane))], toolCount: 0, errorCount: 0 });

describe("foldedCount", () => {
  it("folds nothing until it would hide two steps", () => {
    expect([10, 11, 12, 14].map(foldedCount)).toEqual([0, 0, 2, 4]);
  });
});

describe("shownWakes", () => {
  const wakes = [wake("a", [step("1", "process"), step("2", "work")]), wake("b", [step("3", "process")])];
  it("keeps every wake under all", () => {
    expect(shownWakes(wakes, "all").map((x) => x.steps.length)).toEqual([2, 1]);
  });
  it("narrows steps to a lane and drops wakes left with none", () => {
    expect(shownWakes(wakes, "work").map((x) => [x.wake.key, x.steps.map((s) => s.key)])).toEqual([["a", ["2"]]]);
  });
  it("counts the wakes beyond the page", () => {
    expect([hiddenWakes(8, 5), hiddenWakes(3, 5)]).toEqual([3, 0]);
  });
  it("lists every step key", () => {
    expect([...feedKeys(wakes)].sort()).toEqual(["1", "2", "3"]);
  });
});

describe("wakeTitle", () => {
  it("names who messaged, scheduled ones as such, else the lanes", () => {
    const received = (scheduled: boolean): ActivityStep => ({ kind: "message", key: "m", lane: "process", at: "", direction: "receive", peer: null, scheduled, wakeStopped: false, content: "hi" });
    expect(wakeTitle(wake("a", [received(false)]))).toBe("from you");
    expect(wakeTitle(wake("a", [received(true)]))).toBe("scheduled from you");
    expect(wakeTitle(wake("a", [step("1", "process"), step("2", "work")]))).toBe("processing + working");
  });
});

describe("laneFilterOf", () => {
  it("maps the control's words and refuses others", () => {
    expect(["All", "Processing", "Working"].map(laneFilterOf)).toEqual(["all", "process", "work"]);
    expect(() => laneFilterOf("Idle")).toThrow();
  });
});
