/**
 * Typing into a Nas terminal from the keyboard: the mapping from a key press to the keys Nas sends the pane, and the queue
 * that sends them in order, one request at a time.
 */

import { keyName, type TerminalActivity } from "./activity";

/** Keys for `POST /terminals/:id/keys`: text as typed when `literal`, otherwise tmux key names such as `Enter` or `C-c`. */
export type KeyBatch = { keys: string[]; literal: boolean };

/** What a key press sends the pane, and what it counts as in the summary (null for a key that only moves the cursor). */
export type TerminalInput = { batch: KeyBatch; activity: TerminalActivity | null };

/** The fields of a keyboard event that {@link terminalInputOf} reads. */
export type TerminalKeyEvent = { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean };

/** Named keys and the tmux name each sends. */
const NAMED: Record<string, string> = {
  Enter: "Enter",
  Backspace: "BSpace",
  Tab: "Tab",
  Escape: "Escape",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "PPage",
  PageDown: "NPage",
  Delete: "DC",
};

/** The named keys that move the cursor or the view only, so the summary does not list them. */
const MOVES = new Set(["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Delete"]);

/**
 * The input a key press makes in a terminal: a printable character as literal text, Enter, Backspace, Tab (Shift-Tab as BTab),
 * Escape, the arrows, Home, End, PageUp, PageDown and Delete as tmux names, and Ctrl with a letter as `C-<letter>`. Null for
 * what is not the terminal's: chords holding Cmd (the app's shortcuts and paste), other Ctrl chords, and modifiers alone.
 */
export function terminalInputOf(e: TerminalKeyEvent): TerminalInput | null {
  if (e.metaKey) {
    return null;
  }
  if (e.ctrlKey) {
    return /^[a-z]$/i.test(e.key) ? { batch: { keys: [`C-${e.key.toLowerCase()}`], literal: false }, activity: { type: "key", name: keyName(e) } } : null;
  }
  if ([...e.key].length === 1) {
    return { batch: { keys: [e.key], literal: true }, activity: { type: "text", text: e.key } };
  }
  if (e.key === "Tab" && e.shiftKey) {
    return { batch: { keys: ["BTab"], literal: false }, activity: { type: "key", name: "Shift-Tab" } };
  }
  const named = NAMED[e.key];
  if (named === undefined) {
    return null;
  }
  const activity: TerminalActivity | null =
    e.key === "Enter" ? { type: "enter" } : e.key === "Backspace" ? { type: "backspace" } : MOVES.has(e.key) ? null : { type: "key", name: keyName(e) };
  return { batch: { keys: [named], literal: false }, activity };
}

/** Text pasted into the pane, as the input it makes: literal, with its newlines. Null for an empty paste. */
export function terminalPasteOf(text: string): TerminalInput | null {
  return text === "" ? null : { batch: { keys: [text], literal: true }, activity: { type: "text", text } };
}

/**
 * Queue of keys for one terminal. `push` sends at once when idle, otherwise the batch waits and goes out with everything
 * queued behind the request in flight, with neighbouring batches of the same kind joined so fast typing is a few requests.
 * Order is kept. A failed request drops its batch and reports through `onError`; there is no retry.
 */
export function createKeySender(send: (keys: string[], literal: boolean) => Promise<unknown>, onError: (message: string) => void) {
  let queue: KeyBatch[] = [];
  let sending = false;

  async function flush(): Promise<void> {
    if (sending || queue.length === 0) {
      return;
    }
    const batches = queue;
    queue = [];
    sending = true;
    try {
      for (const batch of batches) {
        await send(batch.keys, batch.literal);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      sending = false;
    }
    void flush();
  }

  return {
    push(batch: KeyBatch): void {
      const last = queue[queue.length - 1];
      if (last !== undefined && last.literal === batch.literal) {
        queue[queue.length - 1] = { keys: batch.literal ? [last.keys.join("") + batch.keys.join("")] : [...last.keys, ...batch.keys], literal: batch.literal };
      } else {
        queue.push(batch);
      }
      void flush();
    },
  };
}
