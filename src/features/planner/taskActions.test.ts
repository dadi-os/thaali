import { describe, expect, it, vi } from "vitest";
import type { Action } from "../../shared/interaction/actions";
import type { AgentRecord } from "../../types/hath";
import type { Task } from "../../types/planner";
import { taskActions } from "./taskActions";

const task: Task = { id: "t1", title: "Submit homework 3", body: null, opens_on: "2026-11-16", closes_at: null, done: false, verified_at: null, created_at: "", updated_at: "", past_due: false, hub: null, owner: "cse-335-specialist" };
const agent = { id: "cse-335-specialist", name: "cse-335-specialist" } as AgentRecord;

function rows(over: Partial<Task>, a: AgentRecord | null) {
  const deps = { agent: a, tick: vi.fn(), message: vi.fn() };
  const list = taskActions({ ...task, ...over }, deps).filter((row): row is Action => row !== "separator");
  return { list, deps, byId: (id: string) => list.find((row) => row.id === id) };
}

describe("task actions", () => {
  it("ticks an open task and takes the tick back from a done one", () => {
    const open = rows({}, null);
    void open.byId("tick")!.run();
    expect(open.deps.tick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), true);
    const done = rows({ done: true }, null);
    expect(done.byId("tick")!.label).toBe("Take back done");
    void done.byId("tick")!.run();
    expect(done.deps.tick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), false);
  });

  it("offers Message agent only when an agent keeps the task, about that task", () => {
    expect(rows({}, null).byId("message")).toBeUndefined();
    const kept = rows({}, agent);
    void kept.byId("message")!.run();
    expect(kept.deps.message).toHaveBeenCalledWith("cse-335-specialist", "Submit homework 3");
  });
});
