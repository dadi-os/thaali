import { describe, expect, it } from "vitest";
import { planLook } from "./planLook";

describe("planLook", () => {
  it("gives an attended plan the sage fill, a solid border and its caption, whatever the clock says", () => {
    for (const state of ["past", "now"] as const) {
      expect(planLook({ rsvp: null, attended: true }, state)).toMatchObject({ kind: "attended", fill: "var(--slab-attended)", dashed: false, struck: false, caption: "Attended" });
    }
  });

  it("dashes and strikes a plan marked not attended", () => {
    expect(planLook({ rsvp: null, attended: false }, "past")).toMatchObject({ kind: "missed", dashed: true, struck: true, caption: "Didn’t attend" });
  });

  it("leaves a past plan nobody answered quiet, with no caption", () => {
    expect(planLook({ rsvp: null, attended: null }, "past")).toMatchObject({ kind: "past", dashed: false, struck: false, caption: null });
  });

  it("lets a declined plan win over an attended answer and follows the clock otherwise", () => {
    expect(planLook({ rsvp: "no", attended: true }, "past").kind).toBe("declined");
    expect(planLook({ rsvp: null, attended: null }, "now").kind).toBe("now");
    expect(planLook({ rsvp: "yes", attended: null }, "later").kind).toBe("upcoming");
  });
});
