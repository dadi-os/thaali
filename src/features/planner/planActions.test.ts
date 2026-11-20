import { describe, expect, it, vi } from "vitest";
import type { Action } from "../../shared/interaction/actions";
import type { AgentRecord } from "../../types/hath";
import type { Plan } from "../../types/planner";
import { planActions, type PlanActionDeps } from "./planActions";

const plan: Plan = { id: "p1", title: "CSE 300 lecture", body: null, rsvp: "yes", start_at: "2026-11-16T15:20:00.000Z", end_at: "2026-11-16T16:40:00.000Z", all_day: false, time_zone: null, attended: null, place: null, hub: null, owner: "cse-300-specialist", notes: [] };

function actionsOf(over: Partial<Plan> = {}, overrides: Partial<PlanActionDeps> = {}) {
  const deps: PlanActionDeps = { agent: null, started: false, setAttended: vi.fn(), message: vi.fn(), showInYaad: vi.fn(), ...overrides };
  const rows = planActions({ ...plan, ...over }, deps).filter((row): row is Action => row !== "separator");
  return { rows, deps, byId: (id: string) => rows.find((row) => row.id === id) };
}

describe("plan actions", () => {
  it("offers Attended only once the plan has begun and Ankur did not decline it", () => {
    expect(actionsOf().byId("attended-yes")).toBeUndefined();
    expect(actionsOf({}, { started: true }).byId("attended-yes")).toBeDefined();
    expect(actionsOf({ rsvp: "no" }, { started: true }).byId("attended-yes")).toBeUndefined();
    expect(actionsOf({ all_day: true }, { started: true }).byId("attended-no")).toBeUndefined();
  });

  it("writes true, false, and takes the same answer back as null", () => {
    const yes = actionsOf({}, { started: true });
    void yes.byId("attended-yes")!.run();
    expect(yes.deps.setAttended).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), true);
    const no = actionsOf({ attended: false }, { started: true });
    expect(no.byId("attended-no")!.selected).toBe(true);
    void no.byId("attended-no")!.run();
    expect(no.deps.setAttended).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), null);
  });

  it("offers Message agent only when an agent keeps the plan", () => {
    expect(actionsOf().byId("message")).toBeUndefined();
    const agent = { id: "cse-300-specialist", name: "cse-300-specialist" } as AgentRecord;
    const kept = actionsOf({}, { agent });
    void kept.byId("message")!.run();
    expect(kept.deps.message).toHaveBeenCalledWith("cse-300-specialist");
  });

  it("always offers Show in Yaad and opens details when there is a card", () => {
    const details = vi.fn();
    const out = actionsOf({}, { details });
    void out.byId("show-in-yaad")!.run();
    expect(out.deps.showInYaad).toHaveBeenCalledWith("p1");
    void out.byId("details")!.run();
    expect(details).toHaveBeenCalled();
  });
});
