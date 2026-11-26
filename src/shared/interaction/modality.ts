/**
 * Input modality: which kind of input the person used last, written on the root as `data-input="pointer"` or `"keyboard"`.
 * A focus ring is for a keyboard; the stylesheet draws it only while the last input was one (`html[data-input="pointer"]`
 * hides `:focus-visible`). Browsers decide `:focus-visible` on their own and decide differently when focus is put back after a
 * popover or menu closes, so a ring could be left around the block someone had just clicked. Reading the last real input
 * instead makes it the same everywhere: a click or touch never leaves a ring, and Tab, arrows or Shift+F10 always show one.
 */

/** Keys that are not navigation by themselves: holding a modifier or pressing it alone leaves the mode as it was. */
const SILENT = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

/** Start tracking the last input. Returns the function that stops it. */
export function installInputModality(root: HTMLElement = document.documentElement): () => void {
  const set = (mode: "pointer" | "keyboard") => () => {
    root.dataset.input = mode;
  };
  const pointer = set("pointer");
  const onKey = (event: KeyboardEvent) => {
    if (!SILENT.has(event.key)) root.dataset.input = "keyboard";
  };
  root.dataset.input = "pointer";
  document.addEventListener("pointerdown", pointer, true);
  document.addEventListener("keydown", onKey, true);
  return () => {
    document.removeEventListener("pointerdown", pointer, true);
    document.removeEventListener("keydown", onKey, true);
    delete root.dataset.input;
  };
}
