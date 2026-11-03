import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ChaaviItem } from "../../types/chaavi";

/** How far the pointer moves, in px, before a press becomes a drag. */
const DRAG_PX = 5;

/** How long a row a dragged item landed on stays washed, in ms. */
const LANDED_MS = 700;

/** Where an item can be dropped: the favorites, a folder by id, or no folder. */
export type DropTarget = { kind: "favorites" } | { kind: "folder"; id: string } | { kind: "none" };

/** Reads a `data-drop` key (`favorites`, `none` or `folder:<id>`). */
export function parseDrop(key: string): DropTarget | null {
  if (key === "favorites") {
    return { kind: "favorites" };
  }
  if (key === "none") {
    return { kind: "none" };
  }
  return key.startsWith("folder:") ? { kind: "folder", id: key.slice("folder:".length) } : null;
}

/** What dropping `item` on `target` changes, or null when it is already there. */
export function dropChange(item: ChaaviItem, target: DropTarget): { favorite: true } | { folderId: string | null } | null {
  if (target.kind === "favorites") {
    return item.favorite ? null : { favorite: true };
  }
  const folderId = target.kind === "folder" ? target.id : null;
  return folderId === item.folderId ? null : { folderId };
}

/** The item being dragged and where the pointer is, in the page's own coordinates. */
export type Ghost = { item: ChaaviItem; x: number; y: number };

export type ItemDragOptions = {
  /** The element the ghost is placed in, whose top left corner is its origin. */
  container: RefObject<HTMLElement | null>;
  onSelect: (id: string) => void;
  onDrop: (item: ChaaviItem, target: DropTarget) => void;
};

/**
 * Pointer dragging of list rows onto the pane's `data-drop` rows. A press that never moves selects the row; a drag shows a ghost at the
 * pointer and the drop row under it as hot, and a release over a drop row hands the item and target to `onDrop`.
 */
export function useItemDrag({ container, onSelect, onDrop }: ItemDragOptions) {
  const press = useRef<{ item: ChaaviItem; startX: number; startY: number; dragging: boolean } | null>(null);
  const landedTimer = useRef<number | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  const dropKeyAt = (x: number, y: number): string | null => {
    for (const node of document.elementsFromPoint(x, y)) {
      const key = node.closest("[data-drop]")?.getAttribute("data-drop");
      if (key !== undefined && key !== null) {
        return key;
      }
    }
    return null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, item: ChaaviItem) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { item, startX: event.clientX, startY: event.clientY, dragging: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = press.current;
    const origin = container.current?.getBoundingClientRect();
    if (current === null || origin === undefined) {
      return;
    }
    if (!current.dragging && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_PX) {
      return;
    }
    current.dragging = true;
    setGhost({ item: current.item, x: event.clientX - origin.left, y: event.clientY - origin.top });
    setHot(dropKeyAt(event.clientX, event.clientY));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = press.current;
    press.current = null;
    if (current === null) {
      return;
    }
    if (!current.dragging) {
      onSelect(current.item.id);
      return;
    }
    const key = dropKeyAt(event.clientX, event.clientY);
    const target = key === null ? null : parseDrop(key);
    setGhost(null);
    setHot(null);
    if (key !== null && target !== null) {
      onDrop(current.item, target);
      setLanded(key);
      if (landedTimer.current !== null) {
        window.clearTimeout(landedTimer.current);
      }
      landedTimer.current = window.setTimeout(() => setLanded(null), LANDED_MS);
    }
  };

  const onPointerCancel = () => {
    press.current = null;
    setGhost(null);
    setHot(null);
  };

  return { ghost, hot: hot ?? landed, draggingId: ghost?.item.id ?? null, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
