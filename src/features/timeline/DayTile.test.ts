import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../types/timeline";
import { isSession } from "./DayTile";

function item(over: Partial<TimelineItem>): TimelineItem {
  return {
    id: "n",
    occurrence_date: "2026-10-01",
    title: "t",
    body: null,
    kind: null,
    status: "confirmed",
    start_at: "2026-10-01T14:00:00.000Z",
    end_at: "2026-10-01T15:00:00.000Z",
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

describe("the Home timeline tile's sessions", () => {
  it("draw a timed session", () => {
    expect(isSession(item({}))).toBe(true);
  });

  it("leave out plans that are only due, with or without a time", () => {
    expect(isSession(item({ start_at: null, end_at: null, due_at: "2026-10-01T23:59:00.000Z" }))).toBe(false);
    expect(isSession(item({ due_at: "2026-10-01T23:59:00.000Z", start_at: null }))).toBe(false);
  });

  it("leave out hidden and cancelled sessions", () => {
    expect(isSession(item({ hide_from_planner: true }))).toBe(false);
    expect(isSession(item({ state: "cancelled" }))).toBe(false);
  });
});
