// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentTask } from "../../../types/hath";
import { getToasts, resetToasts } from "../../../contexts/toasts";
import { HelperTasks, type SheetTask } from "./HelperTasks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const NOW = Date.parse("2026-11-09T12:00:00.000Z");

/** A helper task in `status`. */
function task(hex: string, status: AgentTask["status"]): SheetTask {
  return { task: { id: `task/browser/${hex}`, kind: "browser", status, purpose: `Purpose ${hex}`, current: "example.com", last_activity: "2026-11-09T11:58:00.000Z" }, question: "" };
}

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetToasts();
});

/** Draws the tasks with `onHalt`. */
function render(tasks: SheetTask[], onHalt: (id: string) => Promise<void>) {
  act(() => root.render(<HelperTasks owner="finance-specialist" tasks={tasks} onHalt={onHalt} now={NOW} />));
}

/** The button whose text is `text`. */
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  if (found === undefined) {
    throw new Error(`no button ${text}`);
  }
  return found;
}

/** Waits for pending promises to settle inside act. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("HelperTasks", () => {
  it("offers Stop only on tasks that can still be stopped", () => {
    render([task("a", "working"), task("b", "asleep"), task("c", "stopped"), task("d", "asking"), task("e", "paused"), task("f", "idle")], vi.fn());
    const stops = [...host.querySelectorAll("button")].filter((candidate) => candidate.getAttribute("aria-label")?.startsWith("Stop "));
    expect(stops.map((stop) => stop.getAttribute("aria-label"))).toEqual(["Stop task/browser/a", "Stop task/browser/d", "Stop task/browser/e"]);
    act(() => button("Show 3 idle").click());
    const all = [...host.querySelectorAll("button")].filter((candidate) => candidate.getAttribute("aria-label")?.startsWith("Stop "));
    expect(all.map((stop) => stop.getAttribute("aria-label"))).toEqual(["Stop task/browser/a", "Stop task/browser/d", "Stop task/browser/e", "Stop task/browser/f"]);
  });

  it("lists only the active tasks and keeps idle, asleep and stopped ones behind a toggle", () => {
    render([task("a", "working"), task("b", "asleep"), task("c", "idle")], vi.fn());
    expect(host.textContent).toContain("Purpose a");
    expect(host.textContent).not.toContain("Purpose b");
    expect(host.textContent).toContain("1 of 3 active");
    act(() => button("Show 2 idle").click());
    expect(host.textContent).toContain("Purpose b");
    expect(host.textContent).toContain("Purpose c");
    act(() => button("Hide idle").click());
    expect(button("Show 2 idle")).toBeDefined();
  });

  it("collapses the whole list behind the toggle when every task is idle", () => {
    render([task("b", "asleep"), task("c", "stopped")], vi.fn());
    expect(host.textContent).not.toContain("Purpose b");
    expect(host.textContent).toContain("0 of 2 active");
    expect(button("Show 2 idle")).toBeDefined();
  });

  it("asks before stopping, and Keep leaves the task running", () => {
    const onHalt = vi.fn(() => Promise.resolve());
    render([task("a", "working")], onHalt);
    act(() => button("Stop").click());
    expect(host.textContent).toContain("Stop this task?");
    act(() => button("Keep").click());
    expect(host.textContent).not.toContain("Stop this task?");
    expect(onHalt).not.toHaveBeenCalled();
  });

  it("halts the task by its full address once confirmed", async () => {
    const onHalt = vi.fn(() => Promise.resolve());
    render([task("a", "working")], onHalt);
    act(() => button("Stop").click());
    act(() => button("Stop").click());
    await settle();
    expect(onHalt).toHaveBeenCalledWith("task/browser/a");
    expect(host.textContent).not.toContain("Stop this task?");
    expect(getToasts()).toHaveLength(0);
  });

  it("toasts a refused halt in plain words", async () => {
    const onHalt = vi.fn(() => Promise.reject(new Error('HTTP 409 POST /halt: {"error":{"type":"task_conflict"}}')));
    render([task("a", "working")], onHalt);
    act(() => button("Stop").click());
    act(() => button("Stop").click());
    await settle();
    const [toast] = getToasts();
    expect(toast).toMatchObject({ tone: "error", body: "The task changed while stopping it; try again." });
  });
});
