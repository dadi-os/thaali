import { describe, expect, it } from "vitest";
import type { Routine } from "../../../types/hath";
import { activeRoutines, cadenceOf, daysLabel, reminderWhen, timeLabel } from "./routines";
import { formatClock, formatDay } from "../../../shared/lib/ux/time";

describe("routine copy", () => {
  it("names the days a routine runs", () => {
    expect(daysLabel(null)).toBe("Every day");
    expect(daysLabel(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBe("Every day");
    expect(daysLabel(["fri", "mon", "wed", "tue", "thu"])).toBe("Weekdays");
    expect(daysLabel(["sun", "sat"])).toBe("Weekends");
    expect(daysLabel(["fri", "mon"])).toBe("Mon, Fri");
  });

  it("reads HH:MM as a clock time and joins it to the days", () => {
    expect(timeLabel("07:30")).toBe("7:30 AM");
    expect(timeLabel("00:05")).toBe("12:05 AM");
    expect(timeLabel("12:00")).toBe("12:00 PM");
    expect(timeLabel("18:45")).toBe("6:45 PM");
    expect(cadenceOf({ days: ["sun"], at: "18:00" })).toBe("Sun at 6:00 PM");
    expect(() => timeLabel("later")).toThrow();
  });

  it("words a reminder's time and lists only routines that are still active", () => {
    const run_at = "2026-11-17T21:00:00Z";
    expect(reminderWhen({ run_at })).toBe(`${formatDay(run_at)}, ${formatClock(run_at)}`);
    const routine = (id: string, active: boolean) => ({ id, active }) as Routine;
    expect(activeRoutines([routine("a", true), routine("b", false)]).map((r) => r.id)).toEqual(["a"]);
  });
});
