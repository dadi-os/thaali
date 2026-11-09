import { describe, expect, it } from "vitest";
import { browserKeyActivity, createBrowserActivity, createTerminalActivity, keyName } from "./activity";

const noMods = { ctrlKey: false, altKey: false, metaKey: false, shiftKey: false };

describe("browser activity summary", () => {
  it("says he did nothing when nothing was recorded", () => {
    expect(createBrowserActivity().summary()).toBe("Ankur took over this browser but did nothing.");
  });

  it("counts clicks, keys and characters, omits what is zero, and never holds the text typed", () => {
    const activity = createBrowserActivity();
    for (let i = 0; i < 3; i += 1) {
      activity.record({ type: "click" });
    }
    activity.record({ type: "scroll" });
    activity.record({ type: "scroll" });
    for (const ch of "hunter2-secret!!") {
      activity.record(browserKeyActivity({ key: ch, ...noMods })!);
    }
    activity.record({ type: "key", name: "Back" });
    const summary = activity.summary();
    expect(summary).toBe("Ankur took over this browser. He clicked 3 times, scrolled, typed 16 characters, and pressed Back once.");
    expect(summary).not.toContain("hunter2");
  });

  it("names repeated keys and speaks of one click and one character in the singular", () => {
    const activity = createBrowserActivity();
    activity.record({ type: "click" });
    activity.record({ type: "type", chars: 1 });
    activity.record({ type: "key", name: "Enter" });
    activity.record({ type: "key", name: "Enter" });
    expect(activity.summary()).toBe("Ankur took over this browser. He clicked once, typed 1 character, and pressed Enter twice.");
  });

  it("starts from nothing after a reset", () => {
    const activity = createBrowserActivity();
    activity.record({ type: "click" });
    activity.reset();
    expect(activity.summary()).toBe("Ankur took over this browser but did nothing.");
  });

  it("types printable keys, names chords and special keys, and ignores a modifier alone", () => {
    expect(browserKeyActivity({ key: "a", ...noMods })).toEqual({ type: "type", chars: 1 });
    expect(browserKeyActivity({ key: "Enter", ...noMods })).toEqual({ type: "key", name: "Enter" });
    expect(browserKeyActivity({ key: "a", ...noMods, ctrlKey: true })).toEqual({ type: "key", name: "Ctrl-A" });
    expect(browserKeyActivity({ key: "ArrowDown", ...noMods })).toEqual({ type: "key", name: "Down" });
    expect(browserKeyActivity({ key: "Tab", ...noMods, shiftKey: true })).toEqual({ type: "key", name: "Shift-Tab" });
    expect(browserKeyActivity({ key: "Shift", ...noMods, shiftKey: true })).toBeNull();
  });
});

describe("terminal activity summary", () => {
  it("says he typed nothing when nothing was recorded", () => {
    expect(createTerminalActivity().summary()).toBe("Ankur took over this terminal but typed nothing.");
  });

  it("lists the commands he ran, split at Enter, verbatim", () => {
    const activity = createTerminalActivity();
    activity.record({ type: "text", text: "ls -la" });
    activity.record({ type: "enter" });
    activity.record({ type: "text", text: "cd ~/src" });
    activity.record({ type: "enter" });
    expect(activity.summary()).toBe("Ankur took over this terminal and ran: `ls -la`, `cd ~/src`.");
  });

  it("applies Backspace to the line, drops a line at Ctrl-C and names keys in order", () => {
    const activity = createTerminalActivity();
    activity.record({ type: "text", text: "lss" });
    activity.record({ type: "backspace" });
    activity.record({ type: "enter" });
    activity.record({ type: "text", text: "sleep 100" });
    activity.record({ type: "key", name: "Ctrl-C" });
    activity.record({ type: "text", text: "pwd" });
    activity.record({ type: "enter" });
    expect(activity.summary()).toBe("Ankur took over this terminal and ran: `ls`, Ctrl-C, `pwd`.");
  });

  it("splits pasted text with newlines into commands and reports text left unrun", () => {
    const activity = createTerminalActivity();
    activity.record({ type: "text", text: "make\r\nmake test\npartial" });
    expect(activity.summary()).toBe("Ankur took over this terminal and ran: `make`, `make test`, then typed `partial` without running it.");
  });

  it("records an Enter on an empty line as the key", () => {
    const activity = createTerminalActivity();
    activity.record({ type: "key", name: "Up" });
    activity.record({ type: "enter" });
    expect(activity.summary()).toBe("Ankur took over this terminal and ran: Up, Enter.");
  });

  it("cuts a very long command and counts the commands past the list's end", () => {
    const activity = createTerminalActivity();
    activity.record({ type: "text", text: `echo ${"x".repeat(500)}` });
    activity.record({ type: "enter" });
    expect(activity.summary()).toContain(`\`echo ${"x".repeat(195)}…\``);
    for (let i = 0; i < 40; i += 1) {
      activity.record({ type: "text", text: `c${i}` });
      activity.record({ type: "enter" });
    }
    const summary = activity.summary();
    expect(summary).toContain("and 11 more");
    expect(summary).not.toContain("`c39`");
  });

  it("starts from nothing after a reset", () => {
    const activity = createTerminalActivity();
    activity.record({ type: "text", text: "ls" });
    activity.reset();
    expect(activity.summary()).toBe("Ankur took over this terminal but typed nothing.");
  });
});

describe("keyName", () => {
  it("names a key the way the summaries and the footer read it", () => {
    expect(keyName({ key: "c", ctrlKey: true, altKey: false, metaKey: false })).toBe("Ctrl-C");
    expect(keyName({ key: " ", ctrlKey: false, altKey: false, metaKey: false })).toBe("Space");
  });
});
