// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduledMessage } from "../../../types/hath";
import { ScheduleRow } from "./ScheduleRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const schedule: ScheduledMessage = { id: "s1", from_agent_id: "me", to_agent_id: "me", content: "Check the budget.", run_at: "2026-10-29T04:42:00.000Z", interval_minutes: 1440, created_at: "2026-10-01T00:00:00.000Z" };

/** Long enough for the row's skipped exit and enter animations to flush. */
const SETTLE_MS = 80;

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

/** Lets the row's animations finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  });
}

/** The button whose text is `text`. */
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  if (found === undefined) {
    throw new Error(`no button ${text}`);
  }
  return found;
}

/** Sets a text control's value the way typing does. */
function type(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), "value")!.set!;
  setter.call(control, value);
  act(() => {
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

function mount(onSave = vi.fn(() => Promise.resolve()), onCancel = vi.fn(() => Promise.resolve())) {
  act(() => root.render(<ScheduleRow schedule={schedule} agentId="me" position={1} onSave={onSave} onCancel={onCancel} />));
  return { onSave, onCancel };
}

describe("ScheduleRow", () => {
  it("opens the editor from Edit, saves only what changed, and closes", async () => {
    const { onSave } = mount();
    act(() => button("Edit").click());
    await settle();
    expect(button("Save").disabled).toBe(true);
    type(host.querySelector("textarea")!, "Check it twice.");
    type(host.querySelector("select")!, "10080");
    expect(button("Save").disabled).toBe(false);
    await act(async () => button("Save").click());
    await settle();
    expect(onSave).toHaveBeenCalledWith("s1", { interval_minutes: 10080, content: "Check it twice." });
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("keeps the editor open and shows the reason when Hath refuses the save", async () => {
    mount(vi.fn(() => Promise.reject(new Error("run_at must be in the future"))));
    act(() => button("Edit").click());
    await settle();
    type(host.querySelector("textarea")!, "Another message.");
    await act(async () => button("Save").click());
    await settle();
    expect(host.textContent).toContain("run_at must be in the future");
    expect(host.querySelector("textarea")).not.toBeNull();
  });

  it("asks twice before cancelling, and Discard leaves the schedule alone", async () => {
    const { onCancel } = mount();
    act(() => button("Edit").click());
    await settle();
    act(() => button("Cancel schedule").click());
    await settle();
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.textContent).toContain("This schedule will not run again.");
    await act(async () => button("Confirm cancel").click());
    await settle();
    expect(onCancel).toHaveBeenCalledWith("s1");

    act(() => button("Edit").click());
    await settle();
    act(() => button("Discard").click());
    await settle();
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.textContent).toContain("Check the budget.");
  });

  it("offers a repeat of its own beside the presets", async () => {
    mount();
    act(() => button("Edit").click());
    await settle();
    const options = [...host.querySelectorAll("option")].map((option) => option.textContent);
    expect(options).toEqual(["Once", "Hourly", "Daily", "Weekly"]);
  });
});
