/**
 * What Ankur did while he controlled a helper's browser or terminal, kept as the summary the helper is handed when he returns
 * it. A browser's summary holds counts only, never the text typed (it may be a password or a code); a terminal's holds the
 * commands he ran, which are the point of it.
 */

/** One thing Ankur did in a browser, as the page's input handlers see it. */
export type BrowserActivity =
  | { type: "click" }
  | { type: "scroll" }
  | { type: "type"; chars: number }
  /** A key or chord by name, such as `Enter` or `Ctrl-A`, or a navigation button (`Back`, `Reload`). */
  | { type: "key"; name: string };

/** One thing Ankur did in a terminal, as the pane's key handler sees it. */
export type TerminalActivity =
  | { type: "text"; text: string }
  | { type: "enter" }
  | { type: "backspace" }
  /** A key or chord by name, such as `Ctrl-C` or `Up`. */
  | { type: "key"; name: string };

/** A running record of what Ankur did, from which the hand-back summary is written. */
export type Activity<E> = {
  record: (event: E) => void;
  /** The summary of everything recorded since the last reset, as the helper is told it. */
  summary: () => string;
  /** Forgets everything recorded: a takeover starts from nothing. */
  reset: () => void;
};

/** Longest command, in characters, the terminal summary quotes in full. */
const COMMAND_CHARS = 200;
/** Most commands and keys the terminal summary lists before it counts the rest. */
const TERMINAL_ITEMS = 30;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

/** A count as prose: once, twice, 3 times. */
function times(count: number): string {
  return count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
}

/** Items as one list: `a`, `a and b`, `a, b, and c`. */
function listOf(items: string[]): string {
  if (items.length < 3) {
    return items.join(" and ");
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** The fields of a keyboard event that name a key for a summary. */
type KeyFields = { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean };

/** A key as the summaries name it: `Up` for ArrowUp, `Ctrl-C` for Ctrl+c, `Shift-Tab`; the text of a printable key is never named. */
export function keyName({ key, ctrlKey, altKey, metaKey }: KeyFields, shiftKey = false): string {
  const base = key.startsWith("Arrow") ? key.slice(5) : key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key;
  const prefix = `${ctrlKey ? "Ctrl-" : ""}${altKey ? "Alt-" : ""}${metaKey ? "Cmd-" : ""}${shiftKey && key.length > 1 ? "Shift-" : ""}`;
  return `${prefix}${base}`;
}

/**
 * What a browser key press counts as: characters typed, a key or chord by name, or nothing for a modifier on its own.
 * A character with Ctrl or Cmd held is a chord, named, not typed.
 */
export function browserKeyActivity(e: KeyFields & { shiftKey: boolean }): BrowserActivity | null {
  if (MODIFIER_KEYS.has(e.key)) {
    return null;
  }
  if ([...e.key].length === 1 && !e.ctrlKey && !e.metaKey) {
    return { type: "type", chars: 1 };
  }
  return { type: "key", name: keyName(e, e.shiftKey) };
}

/**
 * The record of a browser takeover: clicks, whether he scrolled, the characters typed and the keys pressed by name, in the
 * order each key was first pressed. The summary omits what is zero, and says he did nothing when it all is.
 */
export function createBrowserActivity(): Activity<BrowserActivity> {
  let clicks = 0;
  let scrolled = false;
  let typed = 0;
  let keys = new Map<string, number>();
  return {
    record(event) {
      if (event.type === "click") {
        clicks += 1;
      } else if (event.type === "scroll") {
        scrolled = true;
      } else if (event.type === "type") {
        typed += event.chars;
      } else {
        keys.set(event.name, (keys.get(event.name) ?? 0) + 1);
      }
    },
    summary() {
      const did: string[] = [];
      if (clicks > 0) {
        did.push(`clicked ${times(clicks)}`);
      }
      if (scrolled) {
        did.push("scrolled");
      }
      if (typed > 0) {
        did.push(`typed ${typed} ${typed === 1 ? "character" : "characters"}`);
      }
      for (const [name, count] of keys) {
        did.push(`pressed ${name} ${times(count)}`);
      }
      return did.length === 0 ? "Ankur took over this browser but did nothing." : `Ankur took over this browser. He ${listOf(did)}.`;
    },
    reset() {
      clicks = 0;
      scrolled = false;
      typed = 0;
      keys = new Map();
    },
  };
}

/** A command or a key, in the order Ankur did it. */
type TerminalItem = { kind: "command"; text: string } | { kind: "key"; name: string };

/** A command as the summary quotes it: cut at {@link COMMAND_CHARS} characters. */
function quoted(command: string): string {
  const chars = [...command];
  return `\`${chars.length > COMMAND_CHARS ? `${chars.slice(0, COMMAND_CHARS).join("")}…` : command}\``;
}

/**
 * The record of a terminal takeover: each line he typed and ran, split at Enter, with the keys he pressed by name between
 * them. Backspace edits the line being typed; Ctrl-C and Ctrl-U drop it. Text typed and not yet run is reported as such.
 * Keys that only move the cursor are not recorded.
 */
export function createTerminalActivity(): Activity<TerminalActivity> {
  let items: TerminalItem[] = [];
  let line = "";
  function run(): void {
    const command = line.trim();
    items.push(command === "" ? { kind: "key", name: "Enter" } : { kind: "command", text: command });
    line = "";
  }
  return {
    record(event) {
      if (event.type === "text") {
        for (const ch of event.text.replace(/\r\n?/g, "\n")) {
          if (ch === "\n") {
            run();
          } else {
            line += ch;
          }
        }
      } else if (event.type === "enter") {
        run();
      } else if (event.type === "backspace") {
        line = [...line].slice(0, -1).join("");
      } else {
        items.push({ kind: "key", name: event.name });
        if (event.name === "Ctrl-C" || event.name === "Ctrl-U") {
          line = "";
        }
      }
    },
    summary() {
      const shown = items.slice(0, TERMINAL_ITEMS).map((item) => (item.kind === "command" ? quoted(item.text) : item.name));
      if (items.length > TERMINAL_ITEMS) {
        shown.push(`and ${items.length - TERMINAL_ITEMS} more`);
      }
      const pending = line.trim() === "" ? null : `typed ${quoted(line.trim())} without running it`;
      if (shown.length === 0 && pending === null) {
        return "Ankur took over this terminal but typed nothing.";
      }
      const ran = shown.length === 0 ? "" : ` and ran: ${shown.join(", ")}`;
      if (pending === null) {
        return `Ankur took over this terminal${ran}.`;
      }
      return shown.length === 0 ? `Ankur took over this terminal and ${pending}.` : `Ankur took over this terminal${ran}, then ${pending}.`;
    },
    reset() {
      items = [];
      line = "";
    },
  };
}
