import { describe, expect, it } from "vitest";
import type { NasTask } from "../../shared/api/nas";
import { filterCounts, listedTasks, slotLabel, tileTasks } from "./taskList";

const task = (id: string, status: NasTask["status"], lastActivity: string, resource?: string, kind: NasTask["kind"] = "browser"): NasTask => ({
  task: `task/${kind}/${id}`,
  kind,
  id,
  owner: "career-manager",
  steered_by: "career-manager",
  purpose: "p",
  status,
  ...(resource === undefined ? {} : { resource }),
  state: "s",
  created_at: "2026-10-28T10:00:00Z",
  last_activity: lastActivity,
});

describe("task list", () => {
  const tasks = [
    task("a", "working", "2026-10-28T10:40:00Z", "1"),
    task("b", "asking", "2026-10-28T10:10:00Z", "2"),
    task("c", "paused", "2026-10-28T10:30:00Z", "3"),
    task("d", "idle", "2026-10-28T10:20:00Z", "t1", "terminal"),
    task("e", "asleep", "2026-10-28T09:00:00Z"),
    task("f", "stopped", "2026-10-28T08:00:00Z"),
  ];

  it("counts a paused task with the working ones and every task under All", () => {
    expect(filterCounts(tasks)).toEqual({ All: 6, Working: 2, Waiting: 1, Idle: 1, Asleep: 1, Stopped: 1 });
  });

  it("lists a task waiting on its agent first, then the newest activity", () => {
    expect(listedTasks(tasks, "All").map((t) => t.id)).toEqual(["b", "a", "c", "d", "e", "f"]);
    expect(listedTasks(tasks, "Working").map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("names the slot a browser holds and nothing for a terminal or a sleeping task", () => {
    expect(slotLabel(tasks[0]!)).toBe("slot 1");
    expect(slotLabel(tasks[3]!)).toBeNull();
    expect(slotLabel(tasks[4]!)).toBeNull();
  });

  it("shows only active tasks on the tile while any exist, working before asking", () => {
    const shown = tileTasks(tasks);
    expect(shown.title).toBe("Active tasks");
    expect(shown.tasks.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
    expect(shown.tasks[shown.tasks.length - 1]!.status).toBe("asking");
  });

  it("shows only idle tasks when none are active, then asleep ones with stopped last", () => {
    const quiet = tasks.filter((t) => ["idle", "asleep", "stopped"].includes(t.status));
    expect(tileTasks(quiet).title).toBe("Idle tasks");
    expect(tileTasks(quiet).tasks.map((t) => t.id)).toEqual(["d"]);
    const sleeping = tasks.filter((t) => t.status === "stopped" || t.status === "asleep").reverse();
    expect(tileTasks(sleeping).title).toBe("Asleep tasks");
    expect(tileTasks(sleeping).tasks.map((t) => t.id)).toEqual(["e", "f"]);
  });
});
