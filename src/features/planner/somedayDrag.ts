import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { parseDayDrop } from "./somedayBoard";

/** How far the pointer moves, in px, before a press becomes a drag. */
const DRAG_PX = 5;

/** A task being dragged: what it is called, where the pointer is in the window, and whether the day under it will take it. */
export type SomedayGhost = { id: string; title: string; x: number; y: number; over: string | null };

/** The day (`data-drop="day:YYYY-MM-DD"`) under a window point, or null. */
function dayAt(x: number, y: number): string | null {
  for (const node of document.elementsFromPoint(x, y)) {
    const key = node.closest("[data-drop]")?.getAttribute("data-drop");
    const day = key === undefined || key === null ? null : parseDayDrop(key);
    if (day !== null) return day;
  }
  return null;
}

/** What {@link useSomedayDrag} is asked to do. */
export type SomedayDragOptions = {
  /** Whether the task can be given a day; a task nobody keeps cannot. */
  canDrop: (id: string) => boolean;
  /** Called when a task is released over a day tile. */
  onDrop: (id: string, day: string) => void;
};

/**
 * Pointer dragging of Someday cards onto the day strip, tracked on the window so a card that re-renders mid-drag does not lose it. A press that never moves is left to the card's own click; a drag shows
 * a ghost at the pointer and the tile under it as hot (only when the task can take a day), and a release over a tile hands the
 * task and the day to `onDrop`. The click that ends a drag is swallowed through `wasDragged`.
 */
export function useSomedayDrag({ canDrop, onDrop }: SomedayDragOptions) {
  const press = useRef<{ id: string; title: string; x: number; y: number; dragging: boolean } | null>(null);
  const swallow = useRef(false);
  const [ghost, setGhost] = useState<SomedayGhost | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string, title: string) => {
    if (event.button !== 0 || (event.target as Element).closest("button, a, input") !== null) return;
    press.current = { id, title, x: event.clientX, y: event.clientY, dragging: false };
    const move = (e: PointerEvent) => {
      const current = press.current;
      if (current === null) return;
      if (!current.dragging && Math.hypot(e.clientX - current.x, e.clientY - current.y) < DRAG_PX) return;
      current.dragging = true;
      const day = dayAt(e.clientX, e.clientY);
      setGhost({ id: current.id, title: current.title, x: e.clientX, y: e.clientY, over: day !== null && canDrop(current.id) ? day : null });
    };
    const finish = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const current = press.current;
      press.current = null;
      if (current === null || !current.dragging) return;
      swallow.current = true;
      window.setTimeout(() => (swallow.current = false), 0);
      setGhost(null);
      const day = e.type === "pointerup" ? dayAt(e.clientX, e.clientY) : null;
      if (day !== null && canDrop(current.id)) onDrop(current.id, day);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  return { ghost, wasDragged: () => swallow.current, onPointerDown };
}
