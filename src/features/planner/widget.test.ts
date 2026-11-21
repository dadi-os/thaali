import { describe, expect, it } from "vitest";
import type { Plan } from "../../types/planner";
import { dayRecap, ROW, tilePlans, tomorrowPreview, windowRows } from "./widget";

const day = new Date(2026, 10, 18);
const t = (h: number, m = 0) => new Date(2026, 10, 18, h, m).toISOString();

function plan(id: string, start: string, end: string | null, over: Partial<Plan> = {}): Plan {
  return { id, title: id, body: null, rsvp: "yes", start_at: start, end_at: end, all_day: false, time_zone: null, attended: null, place: null, hub: null, owner: "manual", notes: [], ...over };
}

const busy = Array.from({ length: 12 }, (_, i) => plan(`p${i}`, t(8 + i, 0), t(8 + i, 50)));
const titles = (rows: ReturnType<typeof windowRows>["rows"]) => rows.flatMap((r) => (r.kind === "plan" ? [r.plan.id] : ["free"]));

describe("widget plans", () => {
  it("keeps only timed plans with a start and an end on the day", () => {
    const plans = [plan("a", t(9), t(10)), plan("no-end", t(11), null), plan("all-day", t(0), t(23), { all_day: true }), plan("tomorrow", new Date(2026, 10, 19, 9).toISOString(), new Date(2026, 10, 19, 10).toISOString())];
    expect(tilePlans(plans, day).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("widget window", () => {
  it("shows every plan and the free time between them when they fit", () => {
    const plans = [plan("a", t(9), t(10)), plan("b", t(10, 40), t(11, 30))];
    const out = windowRows(plans, new Date(2026, 10, 18, 9, 30), 400);
    expect(titles(out.rows)).toEqual(["a", "free", "b"]);
    expect(out.rows[1]).toEqual({ kind: "free", minutes: 40 });
    expect([out.earlier, out.later]).toEqual([0, 0]);
  });

  it("follows now when they do not fit: the current plan, what is next, and chips for the rest", () => {
    const now = new Date(2026, 10, 18, 13, 20);
    const out = windowRows(busy, now, 3 * ROW.plan + ROW.current + 2 * ROW.chip + 12);
    const shown = out.rows.flatMap((r) => (r.kind === "plan" ? [r.plan.id] : []));
    expect(shown).toContain("p5");
    expect(shown).toContain("p6");
    expect(out.earlier + shown.length + out.later).toBe(12);
    expect(out.earlier).toBeGreaterThan(0);
    expect(out.later).toBeGreaterThan(0);
    expect(shown[0]).toBe(`p${out.earlier}`);
  });

  it("starts at the first plan with no earlier chip before the day begins", () => {
    const out = windowRows(busy, new Date(2026, 10, 18, 6, 0), 200);
    expect(out.rows[0]).toMatchObject({ kind: "plan", plan: { id: "p0" } });
    expect(out.earlier).toBe(0);
    expect(out.later).toBeGreaterThan(0);
  });

  it("ends on the last plan with no later chip once the day is over", () => {
    const out = windowRows(busy, new Date(2026, 10, 18, 22, 0), 200);
    expect(out.rows[out.rows.length - 1]).toMatchObject({ kind: "plan", plan: { id: "p11" } });
    expect(out.later).toBe(0);
    expect(out.earlier).toBeGreaterThan(0);
  });

  it("never ends a window on free time, and never counts a declined plan as a commitment for free time", () => {
    const plans = [plan("a", t(9), t(10)), plan("skipped", t(10, 5), t(11, 55), { rsvp: "no" }), plan("b", t(12), t(13))];
    const out = windowRows(plans, new Date(2026, 10, 18, 9, 30), 400);
    expect(out.rows.filter((r) => r.kind === "free")).toEqual([{ kind: "free", minutes: 120 }]);
    const narrow = windowRows(busy, new Date(2026, 10, 18, 9, 0), ROW.current + ROW.free + ROW.plan + ROW.chip + 2 * ROW.gap + 6);
    expect(narrow.rows[narrow.rows.length - 1]!.kind).toBe("plan");
  });

  it("is empty for a day with no plans", () => {
    expect(windowRows([], day, 300)).toEqual({ rows: [], earlier: 0, later: 0 });
  });
});

describe("day recap and tomorrow", () => {
  it("recaps what was done and attended, leaving out declined plans", () => {
    const plans = [plan("a", t(9), t(10), { attended: true }), plan("b", t(11), t(12)), plan("c", t(13), t(14), { rsvp: "no" })];
    expect(dayRecap(plans)).toBe("2 plans done · 1 attended");
    expect(dayRecap([plan("a", t(9), t(10))])).toBe("1 plan done");
    expect(dayRecap([])).toBe("");
  });

  it("previews tomorrow's first plan and count, or nothing", () => {
    const next = [plan("x", t(9), t(10)), plan("y", t(11), t(12))];
    expect(tomorrowPreview(next)).toEqual({ first: next[0], count: 2 });
    expect(tomorrowPreview([])).toBeNull();
  });
});
