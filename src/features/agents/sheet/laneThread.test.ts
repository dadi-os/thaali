import { describe, expect, it } from "vitest";
import type { ActivityStep, ActivityWake } from "./activity";
import { defaultTab, flattenLane, withSeparators, type ThreadEntry } from "./laneThread";

const tool = { key: "t", id: "t", name: "read", input: {}, result: null };
const turn = (key: string, lane: "process" | "work", at: string, thought: string | null = "hm"): ActivityStep => ({
  kind: "turn", key, lane, at, thought: thought === null ? null : { gist: thought, text: thought }, parts: [{ kind: "tool", key: `${key}:0`, tool }, { kind: "text", key: `${key}:1`, text: "said" }],
});
const message = (key: string, lane: "process" | "work", at: string, wakeStopped = false): ActivityStep => ({ kind: "message", key, lane, at, direction: "send", peer: null, scheduled: false, wakeStopped, content: "x" });
const wake = (key: string, steps: ActivityStep[]): ActivityWake => ({ key, startedAt: steps[0]!.at, at: steps[steps.length - 1]!.at, steps, lanes: [], toolCount: 0, errorCount: 0 });

const wakes = [
  wake("b", [turn("3", "work", "2026-10-28T10:30:00.000Z", null)]),
  wake("a", [turn("1", "work", "2026-10-28T10:00:00.000Z"), message("2", "process", "2026-10-28T10:01:00.000Z"), message("n", "work", "2026-10-28T10:02:00.000Z", true)]),
];

describe("flattenLane", () => {
  it("orders one lane's entries oldest first across wakes and drops the other lane", () => {
    expect(flattenLane(wakes, "work").map((e) => e.key)).toEqual(["1:thought", "1:0", "1:1", "n", "3:0", "3:1"]);
    expect(flattenLane(wakes, "process").map((e) => e.kind)).toEqual(["message"]);
  });
  it("turns the wake-stopped report into a notice and keeps keys stable across rebuilds", () => {
    const first = flattenLane(wakes, "work");
    expect(first.find((e) => e.key === "n")?.kind).toBe("notice");
    expect(flattenLane(wakes.map((w) => ({ ...w })), "work").map((e) => e.key)).toEqual(first.map((e) => e.key));
  });
});

describe("withSeparators", () => {
  const at = (key: string, time: string): ThreadEntry => ({ kind: "thought", key, at: time, text: "" });
  it("separates only gaps over ten minutes", () => {
    const items = withSeparators([at("a", "2026-10-28T10:00:00.000Z"), at("b", "2026-10-28T10:10:00.000Z"), at("c", "2026-10-28T10:21:00.000Z")]);
    expect(items.map((i) => i.kind)).toEqual(["thought", "thought", "separator", "thought"]);
  });
  it("marks a day change as a day separator", () => {
    const items = withSeparators([at("a", "2026-10-28T12:00:00.000Z"), at("b", "2026-10-30T12:00:00.000Z")]);
    expect(items[1]).toMatchObject({ kind: "separator", day: true, key: "sep:b" });
  });
});

describe("defaultTab", () => {
  it("prefers Work, then Process, then About", () => {
    expect([defaultTab(true, 0, 0), defaultTab(false, 2, 0), defaultTab(false, 0, 1), defaultTab(false, 0, 0)]).toEqual(["Work", "Work", "Process", "About"]);
  });
});
