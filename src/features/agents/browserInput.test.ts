import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: string[][] = [];
let release: (() => void) | null = null;

vi.mock("../../shared/api", () => ({
  nas: {
    browserInput: (_id: number, events: Array<{ type: string }>) => {
      sent.push(events.map((e) => e.type));
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  },
}));

import { createInputSender, keyInput } from "./browserInput";

const key = (kind: "key_down" | "key_up", init: Partial<KeyboardEvent>) =>
  keyInput(kind, { key: "a", code: "KeyA", keyCode: 65, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...init });

describe("createInputSender", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("holds events behind the request in flight and sends them together, in order", async () => {
    const sender = createInputSender(10, () => {});
    const event = (type: "move" | "down" | "up") => ({ type, x: 0, y: 0, button: "left" as const, buttons: 1, click_count: 1, modifiers: 0 });
    sender.push(event("down"));
    sender.push(event("move"));
    sender.push(event("up"));
    expect(sent).toEqual([["down"]]);
    release?.();
    await vi.waitFor(() => expect(sent).toEqual([["down"], ["move", "up"]]));
  });
});

describe("keyInput", () => {
  it("keeps Escape and Cmd chords for the app", () => {
    expect(key("key_down", { key: "Escape", code: "Escape", keyCode: 27 })).toBeNull();
    expect(key("key_down", { metaKey: true })).toBeNull();
  });

  it("types a character only for printable keys without Ctrl", () => {
    expect(key("key_down", {})).toMatchObject({ text: "a" });
    expect(key("key_down", { ctrlKey: true })).toMatchObject({ text: "" });
    expect(key("key_down", { key: "Backspace", code: "Backspace", keyCode: 8 })).toMatchObject({ text: "" });
    expect(key("key_down", { key: "Enter", code: "Enter", keyCode: 13 })).toMatchObject({ text: "\r" });
  });
});
