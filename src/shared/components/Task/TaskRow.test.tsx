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

  it("leaves a sleeping task's row inert: no modal, no toast, aria-disabled, no hover affordance, and says it is asleep", () => {
    act(() => root.render(<TaskRow task={task("asleep")} owner="finance-specialist" showOwner />));
    const row = host.querySelector("button")!;
    act(() => row.click());
    expect(getTakeover()).toBeNull();
    expect(getToasts()).toHaveLength(0);
    expect(row.getAttribute("aria-disabled")).toBe("true");
    expect(row.className).toContain("cursor-default");
    expect(row.className).not.toContain("ui-hover-fill");
    expect(host.textContent).toContain("Asleep since");
  });

  it("keeps a live task's row clickable", () => {
    act(() => root.render(<TaskRow task={task("idle")} owner="finance-specialist" showOwner />));
    const row = host.querySelector("button")!;
    expect(row.getAttribute("aria-disabled")).toBeNull();
    expect(row.className).toContain("ui-hover-fill");
  });
});
