import { afterEach, describe, expect, it, vi } from "vitest";
import { tidyActions, type Action } from "./actions";
import { matchesShortcut } from "./shortcuts";

const action = (id: string): Action => ({ id, label: id, run: () => undefined });

/** A key event with the modifiers a test sets. */
function key(init: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }): KeyboardEvent {
  return { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init } as KeyboardEvent;
}

describe("tidyActions", () => {
  it("drops separators that open the list, close it or repeat", () => {
    const list = ["separator", action("a"), "separator", "separator", action("b"), "separator"] as const;
    expect(tidyActions(list).map((entry) => (entry === "separator" ? entry : entry.id))).toEqual(["a", "separator", "b"]);
  });

  it("leaves a list with no stray separators as it is", () => {
    const list = [action("a"), "separator", action("b")] as const;
    expect(tidyActions(list)).toHaveLength(3);
  });

  it("returns nothing for a list of only separators", () => {
    expect(tidyActions(["separator", "separator"])).toEqual([]);
  });
});

describe("matchesShortcut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes mod to be Command on a Mac", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(matchesShortcut(key({ key: "k", metaKey: true }), "mod+k")).toBe(true);
    expect(matchesShortcut(key({ key: "k", ctrlKey: true }), "mod+k")).toBe(false);
  });

  it("takes mod to be Control elsewhere", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(matchesShortcut(key({ key: "k", ctrlKey: true }), "mod+k")).toBe(true);
    expect(matchesShortcut(key({ key: "k", metaKey: true }), "mod+k")).toBe(false);
  });

  it("requires the exact modifiers, so mod+k is not mod+shift+k", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(matchesShortcut(key({ key: "K", metaKey: true, shiftKey: true }), "mod+k")).toBe(false);
    expect(matchesShortcut(key({ key: "K", metaKey: true, shiftKey: true }), "mod+shift+k")).toBe(true);
  });
});
