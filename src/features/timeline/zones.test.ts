import { describe, expect, it } from "vitest";
import { timeline } from "../../dev/fixtures/timeline";
import { clockChange, plannedClock, zoneOffset } from "./zones";

describe("Timeline zones", () => {
  it("finds the repeated hour on a fall-back day", () => {
    expect(
      clockChange(
        new Date("2026-11-01T00:00:00-04:00"),
        new Date("2026-11-02T00:00:00-05:00"),
        "America/New_York",
      ),
    ).toEqual({
      kind: "fall",
      minute: 60,
      duration: 60,
      from: "EDT",
      to: "EST",
    });
  });

  it("finds the skipped hour on a spring-forward day", () => {
    expect(
      clockChange(
        new Date("2026-03-08T00:00:00-05:00"),
        new Date("2026-03-09T00:00:00-04:00"),
        "America/New_York",
      ),
    ).toEqual({
      kind: "spring",
      minute: 120,
      duration: 60,
      from: "EST",
      to: "EDT",
    });
  });

  it("detects a half-hour clock change", () => {
    const change = clockChange(
      new Date("2026-04-05T00:00:00+11:00"),
      new Date("2026-04-06T00:00:00+10:30"),
      "Australia/Lord_Howe",
    );
    expect(change).toMatchObject({ kind: "fall", minute: 90, duration: 30 });
  });

  it("does not invent a change for an ordinary day", () => {
    expect(
      clockChange(
        new Date("2026-10-28T00:00:00-04:00"),
        new Date("2026-10-29T00:00:00-04:00"),
        "America/New_York",
      ),
    ).toBeNull();
  });

  it("keeps fractional-hour offsets and UTC", () => {
    const instant = new Date("2026-10-28T12:00:00Z");
    expect(zoneOffset(instant, "Asia/Kathmandu")).toBe(345);
    expect(zoneOffset(instant, "UTC")).toBe(0);
    expect(zoneOffset(instant, "America/New_York")).toBe(-240);
  });

  it("shows a session's original clock after travel, and suppresses equal offsets", () => {
    const base = timeline("normal", {
      from: "2026-10-28T00:00:00-04:00",
      to: "2026-10-29T00:00:00-04:00",
      view: "planner",
    }).items[0]!;
    const item = {
      ...base,
      time_zone: "America/New_York",
      start_at: "2026-10-28T09:00:00-04:00",
      end_at: "2026-10-28T10:00:00-04:00",
    };
    expect(plannedClock(item, "America/Los_Angeles")).toBe(
      "In New York: 9:00 AM – 10:00 AM EDT",
    );
    expect(plannedClock(item, "America/Detroit")).toBeNull();
    expect(
      plannedClock({ ...item, time_zone: null }, "America/Los_Angeles"),
    ).toBeNull();
  });
});
