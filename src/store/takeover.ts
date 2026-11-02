/**
 * Which helper task's takeover modal is open: the agent sheet's and the System page's previews open it, and the app frame
 * draws it over the whole window, so the two sides share this one place instead of passing it through the pages.
 */

type Listener = () => void;

let openTask: string | null = null;
const listeners = new Set<Listener>();

/** The address of the task whose modal is open (such as `task/browser/3f2a91`), or null while none is. */
export function getTakeover(): string | null {
  return openTask;
}

/** Listens for the modal opening and closing; returns the unsubscribe function. */
export function subscribeTakeover(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Opens the modal for a task, or closes it with null. */
export function setTakeover(task: string | null): void {
  openTask = task;
  for (const listener of listeners) {
    listener();
  }
}
