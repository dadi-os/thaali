import { describe, expect, it } from "vitest";
import type { Plan, Task } from "../../types/planner";
import { agoPhrase, confirmedPhrase, dayWord, duration, inPhrase } from "./phrases";
import { daySummary, freeBetween, nextPlanId, periodSummary, planStatus, taskStatus, timeState } from "./timeState";

const now = new Date(2026, 10, 18, 14, 0);
const at = (h: number, m = 0, d = 18) => new Date(2026, 10, d, h, m).toISOString();

function plan(id: string, start: string, end: string | null, over: Partial<Plan> = {}): Plan {
  return { id, title: id, body: null, rsvp: null, start_at: start, end_at: end, all_day: false, time_zone: null, attended: null, place: null, hub: null, owner: "manual", notes: [], ...over };
}

function task(over: Partial<Task>): Task {
  return { id: "t", title: "t", body: null, opens_on: "2026-11-16", closes_at: at(23, 59), done: false, verified_at: null, created_at: "", updated_at: "", past_due: false, hub: null, owner: "manual", ...over };
}

describe("phrases", () => {
  it("states lengths of time in words", () => {
    expect(duration(25 * 60_000)).toBe("25 min");
    expect(duration(90 * 60_000)).toBe("1 h 30 min");
    expect(duration(3 * 3_600_000)).toBe("3 h");
    expect(duration(2 * 86_400_000)).toBe("2 days");
    expect(duration(20_000)).toBe("under a minute");
  });

  it("labels moments relative to now", () => {
    expect(inPhrase(25 * 60_000)).toBe("in 25 min");
    expect(inPhrase(10_000)).toBe("now");
    expect(agoPhrase(8 * 3_600_000 + 7 * 60_000)).toBe("8 h ago");
    expect(inPhrase(150 * 60_000)).toBe("in 2 h 30 min");
    expect(agoPhrase(2 * 3_600_000)).toBe("2 h ago");
    expect(dayWord(new Date(2026, 10, 19), now)).toBe("tomorrow");
    expect(dayWord(new Date(2026, 10, 17), now)).toBe("yesterday");
    expect(dayWord(new Date(2026, 11, 30), now)).toBe("Dec 30");
    expect(confirmedPhrase(new Date(2026, 10, 15, 14).toISOString(), now)).toBe("Last confirmed 3 days ago");
    expect(confirmedPhrase(null, now)).toBeNull();
  });
});

describe("time states", () => {
  const plans = [plan("done", at(9), at(10)), plan("on", at(13, 30), at(14, 30)), plan("soon", at(15), at(16)), plan("later", at(18), at(19)), plan("skip", at(14, 30), at(15), { rsvp: "no" })];

  it("puts each plan in past, now, next or later, and only one is next", () => {
    const nextId = nextPlanId(plans, now);
    expect(nextId).toBe("soon");
    expect(plans.map((p) => timeState(p, now, nextId))).toEqual(["past", "now", "next", "later", "later"]);
  });

  it("never makes a declined plan next or now, and leaves tomorrow's plans later", () => {
    expect(nextPlanId([plan("skip", at(15), at(16), { rsvp: "no" })], now)).toBeNull();
    expect(nextPlanId([plan("tomorrow", at(9, 0, 19), at(10, 0, 19))], now)).toBeNull();
    expect(timeState(plan("skip", at(13), at(15), { rsvp: "no" }), now, null)).toBe("later");
    expect(timeState(plan("tomorrow", at(9, 0, 19), at(10, 0, 19)), now, null)).toBe("later");
  });

  it("states each situation as a labelled phrase", () => {
    expect(planStatus(plans[1]!, now, "now")).toBe("Now · 30 min left");
    expect(planStatus(plans[2]!, now, "next")).toBe("Starts in 1 h");
    expect(planStatus(plans[0]!, now, "past")).toBe("Ended 4 h ago");
    expect(planStatus(plan("t", at(9, 0, 19), at(10, 0, 19)), now, "later")).toMatch(/^Starts tomorrow 9:00.AM$/);
    expect(planStatus(plan("y", at(9, 0, 17), at(10, 0, 17)), now, "past")).toBe("Ended yesterday");
    expect(planStatus(plan("a", at(0), at(23, 59), { all_day: true }), now, "now")).toBe("All day");
  });
});

describe("a day's summary", () => {
  const day = [plan("a", at(9), at(10)), plan("b", at(11), at(12)), plan("c", at(12, 10), at(13)), plan("skip", at(10, 30), at(10, 50), { rsvp: "no" })];

  it("sums the free time between plans of 30 minutes or more, ignoring declined plans and short gaps", () => {
    expect(freeBetween(day, 30) / 60_000).toBe(60);
  });

  it("says plans, free time and tasks left, leaving zero parts out", () => {
    expect(daySummary(day, { open: 2, pastDue: 1 })).toBe("3 plans · 1 h free between plans · 3 tasks to do, 1 past due");
    expect(daySummary([day[0]!], { open: 0, pastDue: 0 })).toBe("1 plan");
    expect(daySummary([], null)).toBe("Nothing planned");
    expect(daySummary([], { open: 1, pastDue: 0 })).toBe("1 task to do");
  });
});

describe("task status", () => {
  it("states past due, soon, later, done and open-ended in words", () => {
    expect(taskStatus(task({ closes_at: at(9, 0, 13) }), now)).toEqual({ label: "Past due by 5 days", tone: "late" });
    expect(taskStatus(task({ closes_at: at(17) }), now).tone).toBe("soon");
    expect(taskStatus(task({ closes_at: at(17) }), now).label).toMatch(/^Closes today 5:00.PM · in 3 h$/);
    expect(taskStatus(task({ closes_at: at(23, 59, 20) }), now).label).toMatch(/^Closes Fri 11:59.PM · in 2 days$/);
    expect(taskStatus(task({ done: true }), now)).toEqual({ label: "Done", tone: "done" });
    expect(taskStatus(task({ closes_at: null }), now).label).toBe("No close date");
  });
});

describe("a week's summary", () => {
  it("names the busiest day and ignores declined and all-day plans", () => {
    const week = [16, 17, 18].map((d) => new Date(2026, 10, d));
    const plans = [plan("a", at(9, 0, 16), at(10, 0, 16)), plan("b", at(9, 0, 18), at(10, 0, 18)), plan("c", at(11, 0, 18), at(12, 0, 18)), plan("skip", at(13, 0, 17), at(14, 0, 17), { rsvp: "no" }), plan("allday", at(0, 0, 17), at(23, 59, 17), { all_day: true })];
    expect(periodSummary(plans, week, "week")).toBe("3 plans this week · busiest Wednesday with 2");
    expect(periodSummary([], week, "week")).toBe("Nothing planned this week");
  });
});
