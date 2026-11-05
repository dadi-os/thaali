/**
 * Selection scope: the window is chrome and not selectable (see base.css); content opts in with
 * `data-selectable`. Select all (Cmd or Ctrl + A) follows that: in a text field it selects the field, over
 * selectable content it selects that content's region, and anywhere else it does nothing instead of
 * highlighting the whole interface.
 */

/** The nearest region of selectable content around `target`, if any. */
function regionOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest<HTMLElement>("[data-selectable-scope], [data-selectable]");
}

/** Whether `target` is a field whose own select-all should run. */
function isField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * Start scoping select all. Returns the function that stops it.
 * The region is the one under the last pointer press, or the one holding keyboard focus.
 */
export function installSelectionScope(): () => void {
  let lastPressed: EventTarget | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    lastPressed = event.target;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "a") {
      return;
    }
    if (isField(event.target)) {
      return;
    }
    event.preventDefault();
    const region = regionOf(document.activeElement === document.body ? lastPressed : document.activeElement) ?? regionOf(lastPressed);
    if (region === null) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(region);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown);
  };
}
