import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clipboard = vi.hoisted(() => ({ text: "", writes: [] as string[], readFails: false }));

vi.mock("../../shared/desktop/clipboard", () => ({
  copyText: async (value: string) => {
    clipboard.text = value;
    clipboard.writes.push(value);
  },
  readText: async () => {
    if (clipboard.readFails) {
      throw new Error("clipboard read refused");
    }
    return clipboard.text;
  },
}));

import { getToasts } from "../../store/toasts";
import { CLIPBOARD_CLEAR_MS, copySecret } from "./clipboard";

describe("copying a secret", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clipboard.text = "";
    clipboard.writes = [];
    clipboard.readFails = false;
  });
  afterEach(() => vi.useRealTimers());

  it("leaves the secret on the clipboard until the time is up, then empties it", async () => {
    await copySecret("hunter2");
    expect(clipboard.text).toBe("hunter2");
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS - 1);
    expect(clipboard.text).toBe("hunter2");
    await vi.advanceTimersByTimeAsync(1);
    expect(clipboard.text).toBe("");
  });

  it("leaves alone what the person copied since", async () => {
    await copySecret("hunter2");
    clipboard.text = "something else";
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(clipboard.text).toBe("something else");
    expect(clipboard.writes).toEqual(["hunter2"]);
  });

  it("toasts when the clipboard cannot be read to clear it", async () => {
    await copySecret("hunter2");
    clipboard.readFails = true;
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(getToasts().some((toast) => toast.key === "chaavi-clipboard-clear" && toast.tone === "error")).toBe(true);
  });
});
