import { beforeEach, describe, expect, it, vi } from "vitest";
import { timeline as fixtureTimeline } from "../../dev/fixtures/timeline";
import type { Action } from "../../shared/interaction/actions";
import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import { planActions, type PlanActionDeps } from "./planActions";

let item: TimelineItem;

beforeEach(() => {
  item = fixtureTimeline("normal", {
    from: new Date(2026, 9, 28).toISOString(),
    to: new Date(2026, 9, 29).toISOString(),
    view: "planner",
  }).items[0]!;
});

/** The actions of a session with every dependency a spy. */
function actionsOf(session: TimelineItem, overrides: Partial<PlanActionDeps> = {}) {
  const deps: PlanActionDeps = {
    keeper: null,
    setDone: vi.fn(() => Promise.resolve()),
    message: vi.fn(),
    tellDadi: vi.fn(),
    showInYaad: vi.fn(),
    ...overrides,
  };
  const rows = planActions(session, deps).filter((row): row is Action => row !== "separator");
  return { rows, deps, byId: (id: string) => rows.find((row) => row.id === id) };
}

describe("plan actions", () => {
  it("marks only the selected occurrence done, and takes the mark back", () => {
    const open = actionsOf({ ...item, outcome: null });
    void open.byId("mark-done")!.run();
    expect(open.deps.setDone).toHaveBeenCalledWith(expect.objectContaining({ id: item.id }), true);

    const done = actionsOf({ ...item, outcome: "done" });
    expect(done.byId("mark-done")!.label).toBe("Take back done");
    void done.byId("mark-done")!.run();
    expect(done.deps.setDone).toHaveBeenCalledWith(expect.objectContaining({ id: item.id }), false);
  });

  it("offers no outcome write for a cancelled session", () => {
    const { byId } = actionsOf({ ...item, state: "cancelled" });
    expect(byId("mark-done")).toBeUndefined();
  });

  it("messages the keeper, or Dadi when none still runs", () => {
    const dadi = actionsOf(item);
    expect(dadi.byId("message")!.label).toBe("Tell Dadi");
    void dadi.byId("message")!.run();
    expect(dadi.deps.tellDadi).toHaveBeenCalledOnce();

    const keeper = { id: "a1", name: "Career Manager" } as AgentRecord;
    const kept = actionsOf(item, { keeper });
    expect(kept.byId("message")!.label).toBe("Message Career Manager");
    void kept.byId("message")!.run();
    expect(kept.deps.message).toHaveBeenCalledWith("a1");
  });

  it("shows the session in Yaad and offers details only where a card exists", () => {
    const plain = actionsOf(item);
    void plain.byId("show-in-yaad")!.run();
    expect(plain.deps.showInYaad).toHaveBeenCalledWith(item.id);
    expect(plain.byId("details")).toBeUndefined();

    const details = vi.fn();
    const carded = actionsOf(item, { details });
    void carded.byId("details")!.run();
    expect(details).toHaveBeenCalledOnce();
  });
});
