import { describe, expect, it } from "vitest";
import { formatAge, formatClock } from "./time";

describe("formatClock", () => {
  it("reads 12-hour with AM or PM in the zone it is given", () => {
    expect(formatClock("2026-10-28T14:42:00.000Z", "America/New_York")).toMatch(/^10:42\s?AM$/);
    expect(formatClock("2026-10-28T14:42:00.000Z", "America/Los_Angeles")).toMatch(/^7:42\s?AM$/);
    expect(formatClock("2026-10-28T23:05:00.000Z", "America/New_York")).toMatch(/^7:05\s?PM$/);
  });

  it("reads both 1:30s of a fall-back day", () => {
    expect(formatClock("2026-11-01T05:30:00.000Z", "America/New_York")).toMatch(/^1:30\s?AM$/);
    expect(formatClock("2026-11-01T06:30:00.000Z", "America/New_York")).toMatch(/^1:30\s?AM$/);
  });
});

describe("formatAge", () => {
  const now = Date.parse("2026-10-28T14:42:00.000Z");
  it("uses the coarsest unit that still says something", () => {
    expect(formatAge("2026-10-28T14:41:30.000Z", now)).toBe("30s");
    expect(formatAge("2026-10-28T14:39:00.000Z", now)).toBe("3m");
    expect(formatAge("2026-10-28T09:42:00.000Z", now)).toBe("5h");
    expect(formatAge("2026-10-26T14:42:00.000Z", now)).toBe("2d");
  });

  it("never reads negative", () => {
    expect(formatAge("2026-10-28T14:43:00.000Z", now)).toBe("0s");
  });
});
