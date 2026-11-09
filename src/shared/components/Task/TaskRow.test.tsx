// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentTask } from "../../../types/hath";
import { getTakeover, setTakeover } from "../../../contexts/takeover";
import { getToasts, resetToasts } from "../../../contexts/toasts";
import { TaskRow } from "./TaskRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

/** A helper task in `status`. */
function task(status: AgentTask["status"]): AgentTask {
  return { id: "task/browser/3f2a91", kind: "browser", status, purpose: "Read the statement", current: "chase.com", last_activity: "2026-11-09T11:58:00.000Z" };
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
  setTakeover(null);
  resetToasts();
});

describe("TaskRow", () => {
  it("opens the takeover modal on a click, with no preview or dropdown in the row", () => {
    act(() => root.render(<TaskRow task={task("working")} owner="finance-specialist" showOwner />));
    expect(host.querySelector("canvas, pre, [aria-expanded]")).toBeNull();
    act(() => host.querySelector("button")!.click());
    expect(getTakeover()).toBe("task/browser/3f2a91");
  });

  it("opens nothing for a sleeping task and says so", () => {
    act(() => root.render(<TaskRow task={task("asleep")} owner="finance-specialist" showOwner />));
    act(() => host.querySelector("button")!.click());
    expect(getTakeover()).toBeNull();
    expect(getToasts().length).toBe(1);
  });
});
