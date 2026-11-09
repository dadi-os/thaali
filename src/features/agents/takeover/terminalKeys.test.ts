import { describe, expect, it } from "vitest";
import { createKeySender, terminalInputOf, terminalPasteOf, type TerminalKeyEvent } from "./terminalKeys";

const key = (k: string, mods: Partial<TerminalKeyEvent> = {}): TerminalKeyEvent => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });

describe("terminalInputOf", () => {
  it("sends printable characters as literal text and counts them as typed text", () => {
    expect(terminalInputOf(key("a"))).toEqual({ batch: { keys: ["a"], literal: true }, activity: { type: "text", text: "a" } });
    expect(terminalInputOf(key(" "))?.batch).toEqual({ keys: [" "], literal: true });
    expect(terminalInputOf(key("A", { shiftKey: true }))?.batch).toEqual({ keys: ["A"], literal: true });
  });

  it("maps the editing and cursor keys to tmux names", () => {
    const names = { Enter: "Enter", Backspace: "BSpace", Tab: "Tab", Escape: "Escape", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Home: "Home", End: "End", PageUp: "PPage", PageDown: "NPage", Delete: "DC" };
    for (const [pressed, sent] of Object.entries(names)) {
      expect(terminalInputOf(key(pressed))?.batch).toEqual({ keys: [sent], literal: false });
    }
    expect(terminalInputOf(key("Tab", { shiftKey: true }))?.batch).toEqual({ keys: ["BTab"], literal: false });
  });

  it("maps Ctrl with a letter to a chord, Ctrl-C included, and names it in the summary", () => {
    expect(terminalInputOf(key("c", { ctrlKey: true }))).toEqual({ batch: { keys: ["C-c"], literal: false }, activity: { type: "key", name: "Ctrl-C" } });
    expect(terminalInputOf(key("D", { ctrlKey: true }))?.batch.keys).toEqual(["C-d"]);
  });

  it("feeds the summary Enter, Backspace and named keys, and nothing for keys that only move the cursor", () => {
    expect(terminalInputOf(key("Enter"))?.activity).toEqual({ type: "enter" });
    expect(terminalInputOf(key("Backspace"))?.activity).toEqual({ type: "backspace" });
    expect(terminalInputOf(key("ArrowUp"))?.activity).toEqual({ type: "key", name: "Up" });
    expect(terminalInputOf(key("ArrowLeft"))?.activity).toBeNull();
  });

  it("leaves Cmd chords, other Ctrl chords and modifiers alone to the app", () => {
    expect(terminalInputOf(key("v", { metaKey: true }))).toBeNull();
    expect(terminalInputOf(key(".", { metaKey: true }))).toBeNull();
    expect(terminalInputOf(key("[", { ctrlKey: true }))).toBeNull();
    expect(terminalInputOf(key("Shift", { shiftKey: true }))).toBeNull();
    expect(terminalInputOf(key("F5"))).toBeNull();
  });

  it("sends pasted text literally, newlines kept, and nothing for an empty paste", () => {
    expect(terminalPasteOf("ls\nls -la")).toEqual({ batch: { keys: ["ls\nls -la"], literal: true }, activity: { type: "text", text: "ls\nls -la" } });
    expect(terminalPasteOf("")).toBeNull();
  });
});

describe("createKeySender", () => {
  /** A send that holds each request until released, and records what was sent. */
  function held() {
    const sent: Array<{ keys: string[]; literal: boolean }> = [];
    const releases: Array<() => void> = [];
    const send = (keys: string[], literal: boolean) => {
      sent.push({ keys, literal });
      return new Promise<void>((resolve) => releases.push(resolve));
    };
    return { sent, send, release: () => releases.shift()?.() };
  }

  it("sends one request at a time, in order, and joins the keys queued behind the one in flight", async () => {
    const { sent, send, release } = held();
    const sender = createKeySender(send, () => undefined);
    sender.push({ keys: ["l"], literal: true });
    sender.push({ keys: ["s"], literal: true });
    sender.push({ keys: [" "], literal: true });
    sender.push({ keys: ["Enter"], literal: false });
    sender.push({ keys: ["Up"], literal: false });
    expect(sent).toEqual([{ keys: ["l"], literal: true }]);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.slice(1)).toEqual([{ keys: ["s "], literal: true }]);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.slice(2)).toEqual([{ keys: ["Enter", "Up"], literal: false }]);
  });

  it("reports a failed request and carries on with the next", async () => {
    const errors: string[] = [];
    const calls: string[][] = [];
    const sender = createKeySender(
      (keys) => {
        calls.push(keys);
        return calls.length === 1 ? Promise.reject(new Error("tmux gone")) : Promise.resolve();
      },
      (message) => errors.push(message),
    );
    sender.push({ keys: ["a"], literal: true });
    sender.push({ keys: ["Enter"], literal: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors).toEqual(["tmux gone"]);
    expect(calls).toEqual([["a"], ["Enter"]]);
  });
});
