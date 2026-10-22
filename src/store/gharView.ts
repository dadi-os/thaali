/** Which Ghar view this computer opens on, kept on this device (localStorage). */

const KEY = "thaali.ghar.view";

/** The tiles (the default) or the 3D house. */
export type GharView = "tiles" | "house";

/** The view last chosen here; the tiles until one is chosen. */
export function loadGharView(): GharView {
  return localStorage.getItem(KEY) === "house" ? "house" : "tiles";
}

/** Remember the chosen view. */
export function saveGharView(view: GharView): void {
  localStorage.setItem(KEY, view);
}
