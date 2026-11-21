import { describe, expect, it } from "vitest";
import type { AgentRecord } from "../../types/hath";
import type { Plan } from "../../types/planner";
import { allDayMarks, bandPlans, barColumns, gridPlans, isCurrent, keptBy, loosePlans, monthPlans, monthTile, ownerAgent, planTone, plansOn, runsAsBar, spanLanes } from "./plans";

function plan(id: string, start: Date, end: Date | null, over: Partial<Plan> = {}): Plan {
  return { id, title: id, body: null, rsvp: "yes", start_at: start.toISOString(), end_at: end?.toISOString() ?? null, all_day: false, time_zone: null, attended: null, place: null, hub: null, owner: "manual", notes: [], ...over };
}

const d = (n: number, h = 0) => new Date(2026, 9, n, h);
const week = [14, 15, 16, 17, 18, 19, 20].map((n) => d(n));

describe("plan bars", () => {
  it("run along the top for all-day and multi-day plans, and as blocks for the rest", () => {
    expect(runsAsBar(plan("a", d(14), d(14, 23), { all_day: true }))).toBe(true);
    expect(runsAsBar(plan("b", d(14, 20), d(15, 8)))).toBe(true);
    expect(runsAsBar(plan("c", d(14, 9), d(14, 10)))).toBe(false);
  });

  it("show a multi-day plan on every day it touches and give it its columns", () => {
    const trip = plan("trip", d(15, 9), d(17, 17));
    expect(plansOn([trip], d(16)).map((p) => p.id)).toEqual(["trip"]);
    expect(plansOn([trip], d(18))).toEqual([]);
    expect(barColumns(trip, week)).toEqual({ from: 1, to: 3 });
  });

  it("stack overlapping bars in lanes and share a lane between bars that never meet", () => {
    const lanes = spanLanes([plan("a", d(14), d(16), { all_day: true }), plan("b", d(15), d(17), { all_day: true }), plan("c", d(17, 12), d(18), { all_day: true })], week);
    expect(lanes.map((lane) => lane.map((p) => p.id))).toEqual([["a", "c"], ["b"]]);
  });
});

describe("month tiles", () => {
  it("show the first plans and count the rest", () => {
    const plans = [1, 2, 3, 4, 5].map((h) => plan(`p${h}`, d(14, h + 8), d(14, h + 9)));
    const tile = monthTile(plans, d(14), 3);
    expect(tile.shown.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(tile.more).toBe(2);
  });
});

describe("plan marks", () => {
  it("mutes a declined plan, tints a course session, and knows what is on now", () => {
    expect(planTone(plan("a", d(14, 9), d(14, 10), { rsvp: "no" }))).toBe("var(--ink-faint)");
    expect(planTone(plan("a", d(14, 9), d(14, 10), { hub: { id: "h", title: "CSE 300" } }))).toBe("var(--tide)");
    expect(isCurrent(plan("a", d(14, 9), d(14, 10)), d(14, 9))).toBe(true);
    expect(isCurrent(plan("a", d(14, 9), d(14, 10)), d(14, 10))).toBe(false);
    expect(isCurrent(plan("a", d(14, 9), null), d(14, 9))).toBe(false);
  });
});

describe("owner", () => {
  const agent = (id: string, active: boolean) => ({ id, name: id, active }) as AgentRecord;
  it("resolves an active agent and offers nothing for a source or a retired agent", () => {
    const agents = [agent("cse-300-specialist", true), agent("old-worker", false)];
    expect(ownerAgent("cse-300-specialist", agents)?.id).toBe("cse-300-specialist");
    expect(ownerAgent("old-worker", agents)).toBeNull();
    expect(keptBy("cse-300-specialist")).toBe("cse-300-specialist");
    expect(keptBy("ingest")).toBeNull();
    expect(keptBy("manual")).toBeNull();
    expect(ownerAgent("manual", [agent("manual", true)])).toBeNull();
    expect(ownerAgent("ingest", agents)).toBeNull();
    expect(ownerAgent("cse-300-specialist", undefined)).toBeNull();
  });
});

describe("what each view draws from one list of plans", () => {
  const all = [plan("timed", d(14, 9), d(14, 10)), plan("no-end", d(14, 11), null), plan("all-day", d(14), d(14, 23), { all_day: true }), plan("trip", d(15, 9), d(17, 17)), plan("declined", d(14, 12), d(14, 13), { rsvp: "no" })];

  it("gives the grid the timed plans with an end, declined ones and plans that run past midnight included", () => {
    expect(gridPlans(all).map((p) => p.id)).toEqual(["timed", "trip", "declined"]);
  });

  it("gives the all-day band all-day and multi-day plans", () => {
    expect(bandPlans(all).map((p) => p.id)).toEqual(["all-day", "trip"]);
  });

  it("gives Month everything, and the Someday sheet the plans with no end", () => {
    expect(monthPlans(all)).toHaveLength(5);
    expect(loosePlans(all).map((p) => p.id)).toEqual(["no-end"]);
  });
});

describe("all-day marks", () => {
  it("mark each shown day a bar touches, joining the days of a multi-day plan", () => {
    const marks = allDayMarks([plan("trip", d(15, 9), d(17, 17)), plan("fair", d(19), d(19, 23), { all_day: true }), plan("c", d(16, 9), d(16, 10))], week);
    expect(marks[0]).toBeNull();
    expect(marks[1]).toEqual({ titles: ["trip"], fromPrev: false, toNext: true });
    expect(marks[2]).toEqual({ titles: ["trip"], fromPrev: true, toNext: true });
    expect(marks[3]).toEqual({ titles: ["trip"], fromPrev: true, toNext: false });
    expect(marks[5]).toEqual({ titles: ["fair"], fromPrev: false, toNext: false });
    expect(marks[6]).toBeNull();
  });
});
