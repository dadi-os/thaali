import { describe, expect, it } from "vitest";
import type { Segment } from "./layout";
import { barRows, capLanes, blockFit, bubbleFit, narrowColumn, bubbleState, laneBox, weekAnchor, weekColumns, weekHeadHeight, WEEK } from "./weekLayout";
import type { Plan } from "../../types/planner";

const seg = (startMin: number, endMin: number): Segment => ({ block: {} as Plan, startMin, endMin, lane: 0, lanes: 1 });
const lane = (id: string, startMin: number, endMin: number, lane: number, lanes: number): Segment => ({ block: { id } as Plan, startMin, endMin, lane, lanes });
const plan = (id: string) => ({ id }) as Plan;

describe("week spacing", () => {
  it("builds every gap from the 4 pt scale", () => {
    const scale = new Set([4, 8, 12, 16, 24, 32]);
    for (const gap of [WEEK.edge, WEEK.gutter, WEEK.top, WEEK.bubbleToBars, WEEK.barGap, WEEK.headToGrid, WEEK.inset, WEEK.laneGap, WEEK.blockGap, WEEK.padX, WEEK.padY, WEEK.padYShort, WEEK.bottom, WEEK.dotGap, WEEK.lineGap]) {
      expect(scale.has(gap)).toBe(true);
    }
    for (const [name, size] of Object.entries(WEEK)) if (name !== "barRows" && name !== "lanes") expect(size % 4).toBe(0);
  });

  it("sizes the pinned header by its bar rows", () => {
    expect(weekHeadHeight(0)).toBe(52);
    expect(weekHeadHeight(1)).toBe(52 + 8 + 24);
    expect(weekHeadHeight(2)).toBe(52 + 8 + 24 + 4 + 24);
    expect(weekHeadHeight(2, true)).toBe(52 + 8 + 24 + 4 + 24 + 4 + 24);
    expect(weekHeadHeight(0, true)).toBe(52 + 8 + 24);
    expect(weekColumns(7)).toBe("80px repeat(7, minmax(0, 1fr)) 12px");
  });

  it("splits a column between overlapping blocks with the lane gap between them", () => {
    expect(laneBox(0, 1)).toEqual({ left: "calc(8px + 0 * ((100% - 16px - 0px) / 1 + 4px))", width: "calc((100% - 16px - 0px) / 1)" });
    expect(laneBox(1, 2)).toEqual({ left: "calc(8px + 1 * ((100% - 16px - 4px) / 2 + 4px))", width: "calc((100% - 16px - 4px) / 2)" });
  });

});

describe("week bars", () => {
  it("shows two bar rows and counts the plans in the rest", () => {
    const lanes = [[plan("a")], [plan("b"), plan("c")], [plan("d")], [plan("e"), plan("f")]];
    const { shown, hidden } = barRows(lanes);
    expect(shown).toHaveLength(2);
    expect(hidden).toBe(3);
    expect(barRows([[plan("a")]]).hidden).toBe(0);
  });
});

describe("week opening hour", () => {
  it("opens one hour before the earliest plan of the week", () => {
    expect(weekAnchor([[seg(600, 660)], [seg(450, 500)]], null)).toBe(360);
  });
  it("ignores a plan carried over from the night before", () => {
    expect(weekAnchor([[seg(0, 300)], [seg(600, 660)]], null)).toBe(540);
  });
  it("opens before now when today is earlier than every plan", () => {
    expect(weekAnchor([[seg(720, 780)]], 540)).toBe(480);
  });
  it("keeps the first plan when now is later", () => {
    expect(weekAnchor([[seg(480, 540)]], 900)).toBe(420);
  });
  it("opens around seven on an empty week, or before now on today", () => {
    expect(weekAnchor([[], []], null)).toBe(360);
    expect(weekAnchor([[]], 840)).toBe(780);
  });
  it("never goes above midnight", () => {
    expect(weekAnchor([[seg(30, 90)]], null)).toBe(0);
  });
});

describe("day bubble", () => {
  const now = new Date(2026, 10, 21, 11);
  it("marks today and quiets days that are over", () => {
    expect(bubbleState(new Date(2026, 10, 21), now, undefined)).toMatchObject({ today: true, over: false });
    expect(bubbleState(new Date(2026, 10, 20), now, undefined)).toMatchObject({ today: false, over: true });
    expect(bubbleState(new Date(2026, 10, 22), now, undefined)).toMatchObject({ today: false, over: false });
  });
  it("counts open tasks and flags the due ones", () => {
    const state = bubbleState(new Date(2026, 10, 21), now, { open: 3, urgent: true, allDone: false });
    expect(state).toMatchObject({ open: 3, urgent: true, done: false });
    expect(state.spoken).toBe(", 3 open tasks, some due");
  });
  it("shows a check when every task is done and nothing before the tasks load", () => {
    expect(bubbleState(new Date(2026, 10, 22), now, { open: 0, urgent: false, allDone: true })).toMatchObject({ done: true, spoken: ", all tasks done" });
    expect(bubbleState(new Date(2026, 10, 22), now, undefined)).toMatchObject({ open: 0, done: false, spoken: "" });
  });
});

describe("block fit", () => {
  it("keeps a short block to one line with tight padding and no time", () => {
    expect(blockFit(28, 1)).toEqual({ padX: 12, padY: 4, titleLines: 1, time: false, short: true });
  });
  it("gives an hour-long block a title line and its time", () => {
    expect(blockFit(60, 1)).toMatchObject({ padY: 8, titleLines: 1, time: true });
  });
  it("lets a tall block wrap its title before the time line", () => {
    expect(blockFit(124, 1).titleLines).toBe(5);
  });
  it("tightens the sides once a column is shared", () => {
    expect([1, 2, 3, 4].map((lanes) => blockFit(60, lanes).padX)).toEqual([12, 4, 4, 4]);
  });
  it("drops the time in a shared column so the title gets the room", () => {
    expect(blockFit(60, 2)).toMatchObject({ time: false, titleLines: 2 });
  });
});

describe("narrow weeks", () => {
  it("shortens the bubble as the column narrows", () => {
    expect([200, 136, 120, 104, 80].map(bubbleFit)).toEqual(["full", "full", "short", "short", "letter"]);
  });
  it("drops a block's time and tightens its sides in a narrow column", () => {
    expect(narrowColumn(119)).toBe(true);
    expect(narrowColumn(120)).toBe(false);
    expect(blockFit(60, 1, true)).toMatchObject({ time: false, padX: 4, titleLines: 2 });
  });
});

describe("capped lanes", () => {
  it("leaves a column of up to two lanes as it is", () => {
    const column = [lane("a", 600, 660, 0, 2), lane("b", 630, 690, 1, 2)];
    const { shown, more } = capLanes(column);
    expect(shown.map((segment) => [segment.block.id, segment.lane, segment.lanes])).toEqual([["a", 0, 2], ["b", 1, 2]]);
    expect(more.size).toBe(0);
  });

  it("folds the third and later plans of a crowd into a count on the cluster's last visible block", () => {
    const column = [lane("a", 600, 700, 0, 4), lane("b", 620, 700, 1, 4), lane("c", 640, 700, 2, 4), lane("d", 650, 700, 3, 4)];
    const { shown, more } = capLanes(column);
    expect(shown.map((segment) => [segment.block.id, segment.lanes])).toEqual([["a", 2], ["b", 2]]);
    expect([...more.keys()]).toEqual(["b"]);
    expect(more.get("b")!.map((plan) => plan.id)).toEqual(["c", "d"]);
  });

  it("caps each cluster of a day on its own", () => {
    const column = [lane("a", 540, 600, 0, 1), lane("b", 700, 800, 0, 3), lane("c", 710, 800, 1, 3), lane("d", 720, 800, 2, 3)];
    const { shown, more } = capLanes(column);
    expect(shown.map((segment) => [segment.block.id, segment.lanes])).toEqual([["a", 1], ["b", 2], ["c", 2]]);
    expect([...more.keys()]).toEqual(["c"]);
  });
});
