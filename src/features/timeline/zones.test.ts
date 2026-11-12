import { describe, expect, it } from "vitest";
import { clockChange, zoneOffset } from "./zones";

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
});
