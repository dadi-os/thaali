import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../types/timeline";
import { formatUntil } from "./dates";
import { isMultiDay, itemKey, lanesThrough, plansOn, runsAsBar, spanLanes, spanOf, startLabel, weekSlots } from "./plans";

function item(over: Partial<TimelineItem>): TimelineItem {
  return {
    id: "n",
    occurrence_date: "2026-10-01",
    title: "t",
    body: null,
    kind: null,
    status: "confirmed",
    start_at: null,
    end_at: null,
    due_at: null,
    opens_at: null,
    all_day: false,
    time_zone: null,
    hide_from_planner: false,
    state: "scheduled",
    outcome: null,
    outcome_at: null,
    actual_start: null,
    actual_end: null,
    recurrence: null,
    series: null,
    place: null,
    owner: "schedule-specialist",
    notes: [],
    ...over,
  };
}

function plan(id: string, start: Date, end: Date | null, allDay = false): TimelineItem {
  return item({ id, start_at: start.toISOString(), end_at: end ? end.toISOString() : null, all_day: allDay });
}

describe("sessions", () => {
  it("are keyed by plan and date, so each session of a series is its own entry", () => {
    expect(itemKey(item({ id: "p1", occurrence_date: "2026-10-09" }))).not.toBe(itemKey(item({ id: "p1", occurrence_date: "2026-10-16" })));
  });

  it("place a deadline with no time set aside at its due, labelled as due", () => {
    const due = new Date(2026, 9, 14, 23, 59);
    const homework = item({ id: "hw", due_at: due.toISOString() });
    expect(spanOf(homework)).toEqual({ start: due, end: due });
    expect(plansOn([homework], new Date(2026, 9, 14)).map((p) => p.id)).toEqual(["hw"]);
    expect(startLabel(homework)).toMatch(/^Due /);
    expect(spanOf(item({ status: "idea" }))).toBeNull();
  });
});

describe("plansOn", () => {
  it("lists a multi-day plan on every day it spans, earliest first", () => {
    const trip = plan("trip", new Date(2026, 9, 2, 18), new Date(2026, 9, 4, 12));
    const lunch = plan("lunch", new Date(2026, 9, 3, 13), null);
    const days = [2, 3, 4, 5].map((d) => plansOn([lunch, trip], new Date(2026, 9, d)).map((p) => p.id));
    expect(days).toEqual([["trip"], ["trip", "lunch"], ["trip"], []]);
  });

  it("treats a plan without an end as a moment at its start", () => {
    const at = new Date(2026, 9, 3, 13);
    expect(spanOf(plan("p", at, null))).toEqual({ start: at, end: at });
  });
});

describe("formatUntil", () => {
  const now = new Date(2026, 9, 3, 9, 0);

  it("counts minutes, then hours and minutes, within a day", () => {
    expect(formatUntil(now, new Date(2026, 9, 3, 9, 12))).toBe("in 12m");
    expect(formatUntil(now, new Date(2026, 9, 3, 11, 10))).toBe("in 2h 10m");
    expect(formatUntil(now, new Date(2026, 9, 3, 12, 0))).toBe("in 3h");
  });

  it("switches to calendar days a day or more out", () => {
    expect(formatUntil(now, new Date(2026, 9, 6, 8, 0))).toMatch(/3 days/);
  });
});

describe("isMultiDay", () => {
  it("is false for a moment and for a plan that ends the day it starts", () => {
    expect(isMultiDay(plan("a", new Date(2026, 9, 2, 9), null))).toBe(false);
    expect(isMultiDay(plan("b", new Date(2026, 9, 2, 9), new Date(2026, 9, 2, 23, 59)))).toBe(false);
  });

  it("is true once the plan runs past midnight", () => {
    expect(isMultiDay(plan("c", new Date(2026, 9, 2, 22), new Date(2026, 9, 3, 1)))).toBe(true);
  });
});

describe("spanLanes", () => {
  const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 28 + i));

  it("stacks overlapping multi-day plans and shares a lane between ones on different days", () => {
    const window = plan("window", new Date(2026, 8, 28, 9), new Date(2026, 9, 1, 17));
    const trip = plan("trip", new Date(2026, 8, 30, 8), new Date(2026, 9, 2, 20));
    const weekend = plan("weekend", new Date(2026, 9, 3, 10), new Date(2026, 9, 4, 18));
    const lunch = plan("lunch", new Date(2026, 8, 29, 12), new Date(2026, 8, 29, 13));
    const lanes = spanLanes([weekend, lunch, trip, window], week);
    expect(lanes.map((lane) => lane.map((p) => p.id))).toEqual([["window", "weekend"], ["trip"]]);
  });

  it("leaves out multi-day plans that do not touch the shown days", () => {
    const later = plan("later", new Date(2026, 9, 10, 9), new Date(2026, 9, 12, 9));
    expect(spanLanes([later], week)).toEqual([]);
  });
});

describe("all-day plans", () => {
  it("span their whole days and read as all day", () => {
    const drop = plan("drop", new Date(2026, 9, 19), null, true);
    expect(spanOf(drop)).toEqual({ start: new Date(2026, 9, 19), end: new Date(2026, 9, 19, 23, 59, 59, 999) });
    expect(isMultiDay(drop)).toBe(false);
    expect(startLabel(drop)).toBe("All day");
    expect(startLabel(plan("quiz", new Date(2026, 9, 1, 13, 40), null))).not.toBe("All day");
  });

  it("a span of all-day dates is multi-day and lands in a lane", () => {
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 28 + i));
    const window = plan("window", new Date(2026, 8, 30), new Date(2026, 9, 2), true);
    expect(isMultiDay(window)).toBe(true);
    expect(spanLanes([window], week).map((lane) => lane.map((p) => p.id))).toEqual([["window"]]);
  });

  it("a single all-day date runs as a bar and lands in a lane, a timed plan does not", () => {
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 28 + i));
    const drop = plan("drop", new Date(2026, 8, 30), null, true);
    const lunch = plan("lunch", new Date(2026, 8, 30, 12), new Date(2026, 8, 30, 13));
    expect(runsAsBar(drop)).toBe(true);
    expect(runsAsBar(lunch)).toBe(false);
    expect(spanLanes([lunch, drop], week).map((lane) => lane.map((p) => p.id))).toEqual([["drop"]]);
  });
});

describe("weekSlots", () => {
  const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i));

  it("spans each bar over its columns and lists a day's timed plans in the slots its bars leave free", () => {
    const trip = plan("trip", new Date(2026, 9, 5), new Date(2026, 9, 6), true);
    const drop = plan("drop", new Date(2026, 9, 6), null, true);
    const lunch = plan("lunch", new Date(2026, 9, 6, 12), new Date(2026, 9, 6, 13));
    const quiz = plan("quiz", new Date(2026, 9, 8, 9), null);
    const layout = weekSlots([trip, drop, lunch, quiz], week, 4);
    expect(layout.bars.map((b) => [b.plan.id, b.lane, b.from, b.to])).toEqual([["trip", 0, 0, 1], ["drop", 1, 1, 1]]);
    expect(layout.items[1]!.map((i) => [i.plan.id, i.slot])).toEqual([["lunch", 2]]);
    expect(layout.items[3]!.map((i) => [i.plan.id, i.slot])).toEqual([["quiz", 0]]);
    expect(layout.slots).toBe(3);
  });

  it("turns a full day's last free slot into +N more", () => {
    const busy = [9, 10, 11, 12, 13].map((h) => plan(`p${h}`, new Date(2026, 9, 7, h), null));
    const layout = weekSlots(busy, week, 4);
    expect(layout.items[2]!.map((i) => i.slot)).toEqual([0, 1, 2]);
    expect(layout.more[2]).toEqual({ slot: 3, count: 2 });
    expect(layout.slots).toBe(4);
  });

  it("never holds more than the limit: bars past it are left out and counted in +N more", () => {
    const bars = ["a", "b", "c"].map((id) => plan(id, new Date(2026, 9, 7), new Date(2026, 9, 7), true));
    const layout = weekSlots(bars, week, 2);
    expect(layout.bars).toHaveLength(1);
    expect(layout.more[2]).toEqual({ slot: 1, count: 2 });
    expect(layout.slots).toBeLessThanOrEqual(2);
  });
});

describe("lanesThrough", () => {
  it("keeps a day's lanes down to its lowest bar and none for a day without bars", () => {
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i));
    const trip = plan("trip", new Date(2026, 9, 5), new Date(2026, 9, 6), true);
    const drop = plan("drop", new Date(2026, 9, 6), null, true);
    const lanes = spanLanes([trip, drop], week);
    expect(lanesThrough(lanes, week[0]!).map((l) => l.map((p) => p.id))).toEqual([["trip"]]);
    expect(lanesThrough(lanes, week[1]!)).toHaveLength(2);
    expect(lanesThrough(lanes, week[3]!)).toEqual([]);
  });
});
