// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskStatus } from "../../../types/hath";
import type { ControlState } from "./control";
import { PreviewModal } from "../../../shared/overlay/PreviewModal";
import { taskHead, type TakeoverTask } from "./parts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
});

/** Draws the header of a browser task in `status` with the control in `state`. */
function render(status: TaskStatus, state: ControlState, handlers = { onTakeover: vi.fn(), onReturn: vi.fn(), onMenu: vi.fn() }) {
  const task: TakeoverTask = { task: "task/browser/3f2a91", kind: "browser", owner: "finance-specialist", purpose: "Find the statement", status, resource: "3" };
  act(() => root.render(<PreviewModal scoped open label="Task" onClose={vi.fn()} {...taskHead(task, { state, ...handlers })}>body</PreviewModal>));
  return handlers;
}

describe("a task modal's head", () => {
  it("has one split control, no Watching label and no status badge", () => {
    render("working", "watching");
    expect(host.textContent).not.toContain("Watching");
    expect(host.querySelector(".badge")).toBeNull();
    const labels = [...host.querySelectorAll("button")].map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(labels).toEqual(["Takeover", "More", "Close"]);
  });

  it("takes over from the main half and opens the menu from the arrow", () => {
    const handlers = render("working", "watching");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Takeover")!.click());
    expect(handlers.onTakeover).toHaveBeenCalledOnce();
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='More']")!.click());
    expect(handlers.onMenu).toHaveBeenCalledOnce();
  });

  it("reads Return while in control", () => {
    const handlers = render("paused", "in-control");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Return")!.click());
    expect(handlers.onReturn).toHaveBeenCalledOnce();
  });

  it("shows a state dot for a task that is doing something and none for an idle one", () => {
    render("working", "watching");
    expect(host.querySelector("[role='img'][aria-label='Working']")).not.toBeNull();
    render("asking", "watching");
    expect(host.querySelector("[role='img'][aria-label='Waiting on its agent']")).not.toBeNull();
    render("idle", "watching");
    expect(host.querySelector("[role='img']")).toBeNull();
  });
});
