// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder, Routine } from "../../../types/hath";
import { RoutineRow } from "./RoutineRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const NOW = Date.parse("2026-11-15T12:00:00Z");
const routine: Routine = { id: "r1", agent_id: "finance", title: "Morning money check", procedure: "Read the pending charges.", at: "07:30", days: null, next_run_at: "2026-11-16T12:30:00Z", last_run_at: null, last_job_id: null, active: true, created_at: "2026-10-01T00:00:00Z" };
const reminder: Reminder = { id: "q1", agent_id: "finance", job_id: "12", note: "Check the charges settled", run_at: "2026-11-15T12:20:00Z" };

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

/** The button whose text is `text`. */
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  if (found === undefined) {
    throw new Error(`no button ${text}`);
  }
  return found;
}

function mount(item: Parameters<typeof RoutineRow>[0]["item"], onCancel = vi.fn(() => Promise.resolve())) {
  act(() => root.render(<RoutineRow item={item} onCancel={onCancel} now={NOW} />));
  return onCancel;
}

describe("RoutineRow", () => {
  it("shows a routine's title, procedure and cadence, with Cancel as its only control and no editor", () => {
    mount({ kind: "routine", routine });
    expect(host.textContent).toContain("Morning money check");
    expect(host.textContent).toContain("Read the pending charges.");
    expect(host.textContent).toContain("Every day at 7:30 AM");
    expect(host.textContent).toContain("never ran");
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Cancel"]);
    expect(host.querySelector("input, textarea, select")).toBeNull();
  });

  it("asks once before cancelling a routine, and cancels by its id", async () => {
    const onCancel = mount({ kind: "routine", routine });
    act(() => button("Cancel").click());
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.textContent).toContain("It will not run again.");
    await act(async () => button("Cancel routine").click());
    expect(onCancel).toHaveBeenCalledWith("r1");
  });

  it("lets Keep back out of a cancel", () => {
    const onCancel = mount({ kind: "routine", routine });
    act(() => button("Cancel").click());
    act(() => button("Keep").click());
    expect(onCancel).not.toHaveBeenCalled();
    expect(button("Cancel")).toBeDefined();
  });

  it("cancels a reminder by its own id", async () => {
    const onCancel = mount({ kind: "reminder", reminder });
    expect(host.textContent).toContain("Check the charges settled");
    act(() => button("Cancel").click());
    await act(async () => button("Cancel reminder").click());
    expect(onCancel).toHaveBeenCalledWith("q1");
  });

  it("shows hath's reason when a cancel fails, and offers it again", async () => {
    mount({ kind: "routine", routine }, vi.fn(() => Promise.reject(new Error("routine_not_found"))));
    act(() => button("Cancel").click());
    await act(async () => button("Cancel routine").click());
    expect(host.textContent).toContain("routine_not_found");
    expect(button("Cancel")).toBeDefined();
  });
});
