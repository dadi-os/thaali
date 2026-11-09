import { describe, expect, it, vi } from "vitest";
import type { TaskStatus } from "../../../types/hath";
import type { ControlState } from "./control";
import { taskMenu } from "./menu";

/** The ids of the rows the menu shows for a status and control state. */
function ids(status: TaskStatus, state: ControlState = "watching"): string[] {
  const list = taskMenu({ status, state, onPause: vi.fn(), onResume: vi.fn(), onStop: vi.fn() });
  return list.flatMap((entry) => (entry === "separator" ? [] : [entry.id]));
}

describe("takeover menu", () => {
  it.each<TaskStatus>(["working", "asking", "idle"])("offers Pause and Stop while %s", (status) => {
    expect(ids(status)).toEqual(["task.pause", "task.stop"]);
  });

  it("offers Resume instead of Pause while paused and not driven", () => {
    expect(ids("paused")).toEqual(["task.resume", "task.stop"]);
  });

  it("offers only Stop while Ankur is in control", () => {
    expect(ids("paused", "in-control")).toEqual(["task.stop"]);
    expect(ids("working", "pausing")).toEqual(["task.stop"]);
  });

  it("offers only Stop once the task is asleep or stopped", () => {
    expect(ids("asleep")).toEqual(["task.stop"]);
    expect(ids("stopped")).toEqual(["task.stop"]);
  });

  it("runs the handlers of the rows", async () => {
    const onPause = vi.fn(() => Promise.resolve());
    const onStop = vi.fn();
    const list = taskMenu({ status: "working", state: "watching", onPause, onResume: vi.fn(), onStop });
    for (const entry of list) {
      if (entry !== "separator") {
        await entry.run();
      }
    }
    expect(onPause).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
  });
});
