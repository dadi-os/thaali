import { describe, expect, it } from "vitest";
import type { Plan } from "../../types/planner";
import { canTell, rsvpChoice, rsvpMessage } from "./rsvp";

const plan: Plan = { id: "p", title: "CSE 300 lecture", body: null, rsvp: null, start_at: new Date(2026, 10, 20, 10, 20).toISOString(), end_at: new Date(2026, 10, 20, 11, 40).toISOString(), all_day: false, time_zone: null, attended: null, place: null, hub: null, owner: "cse-300-specialist", notes: [] };

describe("RSVP through the agent", () => {
  it("words each answer with the plan and its day", () => {
    expect(rsvpMessage(plan, "yes")).toMatch(/^I’m going to CSE 300 lecture on \w{3}, Nov 20$/);
    expect(rsvpMessage(plan, "no")).toMatch(/^I’m not going to CSE 300 lecture on \w{3}, Nov 20$/);
  });

  it("offers the choice only when an agent keeps the plan and it has not ended", () => {
    expect(canTell(plan, true, new Date(2026, 10, 20, 9))).toBe(true);
    expect(canTell(plan, true, new Date(2026, 10, 20, 10, 30))).toBe(true);
    expect(canTell(plan, true, new Date(2026, 10, 20, 12))).toBe(false);
    expect(canTell(plan, false, new Date(2026, 10, 20, 9))).toBe(false);
  });

  it("selects the answer Yaad holds, and neither while it holds none", () => {
    expect(rsvpChoice(plan)).toBe("");
    expect(rsvpChoice({ ...plan, rsvp: "yes" })).toBe("yes");
    expect(rsvpChoice({ ...plan, rsvp: "no" })).toBe("no");
  });
});
