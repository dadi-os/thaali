import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserActivity, type BrowserActivity } from "./activity";
import { createControl, IDLE_RETURN_MS } from "./control";

/** A control over fake Nas calls that record what they were given. */
function setup({ failPause = false, failResume = false } = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  const control = createControl<BrowserActivity>({
    pause: async () => {
      calls.push("pause");
      if (failPause) {
        throw new Error("nas down");
      }
    },
    resume: async (summary) => {
      calls.push(`resume: ${summary}`);
      if (failResume) {
        throw new Error("nas down");
      }
    },
    activity: createBrowserActivity(),
    onError: (message) => errors.push(message),
  });
  return { control, calls, errors };
}

describe("takeover control", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("watches at first: input is dropped, nothing pauses, and a hand back does nothing", async () => {
    const { control, calls } = setup();
    expect(control.getState()).toBe("watching");
    expect(control.record({ type: "click" })).toBe(false);
    expect(await control.handBack()).toBe(true);
    expect(calls).toEqual([]);
  });

  it("pauses the task at Takeover and lets input through from then", async () => {
    const { control, calls } = setup();
    const states: string[] = [];
    control.subscribe(() => states.push(control.getState()));
    await control.takeOver();
    expect(calls).toEqual(["pause"]);
    expect(states).toEqual(["pausing", "in-control"]);
    expect(control.record({ type: "click" })).toBe(true);
  });

  it("stays watching and reports it when the pause fails", async () => {
    const { control, errors } = setup({ failPause: true });
    await control.takeOver();
    expect(control.getState()).toBe("watching");
    expect(errors).toEqual(["The task did not pause"]);
    expect(control.record({ type: "click" })).toBe(false);
  });

  it("returns the task with a summary of what he did, goes back to watching, and starts a fresh record at the next takeover", async () => {
    const { control, calls } = setup();
    await control.takeOver();
    control.record({ type: "click" });
    control.record({ type: "click" });
    expect(await control.handBack()).toBe(true);
    expect(control.getState()).toBe("watching");
    expect(calls[1]).toBe("resume: Ankur took over this browser. He clicked twice.");
    expect(control.record({ type: "click" })).toBe(false);
    await control.takeOver();
    await control.handBack();
    expect(calls[3]).toBe("resume: Ankur took over this browser but did nothing.");
  });

  it("keeps him in control and reports it when the hand back fails, so closing can be retried", async () => {
    const { control, errors } = setup({ failResume: true });
    await control.takeOver();
    expect(await control.handBack()).toBe(false);
    expect(control.getState()).toBe("in-control");
    expect(errors).toEqual(["The task did not resume"]);
  });

  it("hands back by itself, with the summary, after half an hour without input, and input restarts the wait", async () => {
    const { control, calls } = setup();
    await control.takeOver();
    await vi.advanceTimersByTimeAsync(IDLE_RETURN_MS - 1_000);
    control.record({ type: "scroll" });
    await vi.advanceTimersByTimeAsync(IDLE_RETURN_MS - 1_000);
    expect(control.getState()).toBe("in-control");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(control.getState()).toBe("watching");
    expect(calls[calls.length - 1]).toBe("resume: Ankur took over this browser. He scrolled.");
  });

  it("stops waiting once disposed", async () => {
    const { control, calls } = setup();
    await control.takeOver();
    control.dispose();
    await vi.advanceTimersByTimeAsync(IDLE_RETURN_MS * 2);
    expect(calls).toEqual(["pause"]);
  });
});
