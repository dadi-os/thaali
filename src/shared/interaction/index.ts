/**
 * Desktop input system.
 *
 * Owns: how the window treats selection, scrolling edges, the native context menu, shortcuts and dismissal,
 * installed once at boot so no component decides any of it alone.
 *
 * Does not own: what a menu or overlay looks like (shared/overlay) or what an action does (each noun's actions).
 */

import { installScrollEdges } from "./scrollEdges";
import { installSelectionScope } from "./selection";

/** Install every document-level input behavior. Returns the function that removes them all. */
export function installInteraction(): () => void {
  const stops = [installScrollEdges(), installSelectionScope()];
  return () => {
    for (const stop of stops) {
      stop();
    }
  };
}
