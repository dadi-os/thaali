/**
 * Which box path the file explorer is open at: a `box://` link in any message opens it, and the app frame draws it over
 * the whole window, so the links and the frame share this one place instead of passing it through the pages.
 */

type Listener = () => void;

let openPath: string | null = null;
const listeners = new Set<Listener>();

/** The absolute box path the explorer is open at (a file is selected, a folder is listed), or null while it is closed. */
export function getOpenBoxPath(): string | null {
  return openPath;
}

/** Listens for the explorer opening and closing; returns the unsubscribe function. */
export function subscribeOpenBoxPath(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Opens the explorer at a box path, or closes it with null. */
export function setOpenBoxPath(path: string | null): void {
  openPath = path;
  for (const listener of listeners) {
    listener();
  }
}
