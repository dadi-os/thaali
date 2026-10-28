import { useSyncExternalStore } from "react";

const PORTRAIT = "(orientation: portrait)";

/** Subscribes to the window turning between portrait and landscape. */
function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(PORTRAIT);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * Whether the window is taller than it is wide (a portrait monitor), the same test the CSS
 * layouts use, for views whose React tree changes with it rather than only their styles.
 */
export function usePortrait(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PORTRAIT).matches);
}
