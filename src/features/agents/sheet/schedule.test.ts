import { describe, expect, it } from "vitest";
import type { ScheduledMessage } from "../../../types/hath";
import { canSave, changesOf, draftOf, repeatLabel, toLocalInput } from "./schedule";

const schedule: ScheduledMessage = { id: "s1", from_agent_id: "a", to_agent_id: "a", content: "Check the budget.", run_at: "2026-10-29T04:42:00.000Z", interval_minutes: 1440, created_at: "2026-10-01T00:00:00.000Z" };

describe("repeatLabel", () => {
  it("names the presets and spells out any other interval", () => {
    expect([null, 60, 1440, 10080, 4320, 180, 45].map(repeatLabel)).toEqual(["Once", "Hourly", "Daily", "Weekly", "Every 3 days", "Every 3 h", "Every 45 min"]);
  });
});

describe("changesOf", () => {
  it("is empty for the draft a schedule starts with", () => {
    expect(changesOf(schedule, draftOf(schedule))).toEqual({});
    expect(canSave(schedule, draftOf(schedule))).toBe(false);
  });

  it("names only what changed, one-shot as a null interval and the run time as an instant", () => {
    const draft = { ...draftOf(schedule), repeat: "once", content: "  Check it twice.  ", runAt: "2026-11-02T09:30" };
    expect(changesOf(schedule, draft)).toEqual({ run_at: new Date("2026-11-02T09:30").toISOString(), interval_minutes: null, content: "Check it twice." });
    expect(canSave(schedule, draft)).toBe(true);
  });

  it("sends a custom interval as minutes", () => {
    expect(changesOf(schedule, { ...draftOf(schedule), repeat: "180" })).toEqual({ interval_minutes: 180 });
  });

  it("cannot save an empty message or run time", () => {
    expect(canSave(schedule, { ...draftOf(schedule), content: "   " })).toBe(false);
    expect(canSave(schedule, { ...draftOf(schedule), runAt: "", repeat: "once" })).toBe(false);
  });
});

describe("toLocalInput", () => {
  it("round-trips through the device's zone", () => {
    expect(new Date(toLocalInput(schedule.run_at)).toISOString()).toBe(schedule.run_at);
  });
});
