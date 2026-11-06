/**
 * Asks the router dock to open from outside the sidebar: the ⌘K shortcut, a failed-send toast
 * and the timeline's "ask Dadi" actions, which arrive with something to say. The sidebar watches the count and opens the dock,
 * with its field focused, each time it rises.
 */

import { DADI_DRAFT_KEY, loadDraft, saveDraft } from "./drafts";

type Listener = () => void;

let requests = 0;
const listeners = new Set<Listener>();

/** How many times the dock has been asked to open. */
export function getDockRequests(): number {
  return requests;
}

/** Listens for dock requests; returns the unsubscribe function. */
export function subscribeDock(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Asks the dock to open and take focus; `draft` is added to what the dock already holds, on a line of its own. */
export function requestDock(draft?: string): void {
  if (draft !== undefined) {
    const held = loadDraft(DADI_DRAFT_KEY);
    saveDraft(DADI_DRAFT_KEY, held.trim() === "" ? draft : `${held.trimEnd()}\n${draft}`);
  }
  requests += 1;
  for (const listener of listeners) {
    listener();
  }
}
