import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "../../shared/overlay/Popover";
import { useRetained } from "../../shared/hooks/useRetained";
import type { TimelineItem } from "../../types/timeline";
import { itemKey } from "./plans";
import { SessionCard } from "./planner/SessionCard";

/** A session and the point it was opened from. */
type Shown = { item: TimelineItem; x: number; y: number };

/** How long after a click a popover still opens at that click, in ms. */
const PRESS_FRESH_MS = 400;
/** Radius kept clear around the point, so the card sits beside the pointer and never under it. */
const POINTER_CLEARANCE = 8;

/** Where the pointer last clicked and when; a click from the keyboard has no position and leaves it alone. */
const lastPress = { x: 0, y: 0, at: 0 };

/** What {@link useSessionPopover} gives back. */
export type SessionPopover = {
  /** Open the details popover of `item`: beside the press that asked for it, or under `fallback` (where the item is drawn) when there was none just now. */
  show: (item: TimelineItem, fallback: DOMRect) => void;
  /** Key of the session whose details are open, or null. */
  openKey: string | null;
  /** The popover; render it once, anywhere in the page. */
  popovers: ReactNode;
};

/**
 * A session's click popover: its card (kind, time, place, notes, Mark done, Show in Yaad and Message) opening beside where
 * the pointer pressed, kept clear of it and inside the window, its notes scrolling inside the card when they are long. It
 * closes on Escape, a press outside and when the page that owns it goes away.
 */
export function useSessionPopover(): SessionPopover {
  const [details, setDetails] = useState<Shown | null>(null);
  const shown = useRetained(details);
  useEffect(() => {
    const press = (event: MouseEvent) => {
      if (event.detail === 0) {
        return;
      }
      lastPress.x = event.clientX;
      lastPress.y = event.clientY;
      lastPress.at = performance.now();
    };
    document.addEventListener("click", press, true);
    return () => document.removeEventListener("click", press, true);
  }, []);
  const popovers =
    shown === null ? null : (
      <Popover open={details !== null} anchor={{ x: shown.x, y: shown.y, radius: POINTER_CLEARANCE }} aria-label={`${shown.item.title} details`} widthPx={340} reserveRoom={false} onClose={() => setDetails(null)}>
        <div className="flex min-h-0 flex-1 flex-col" onClick={(event) => (event.target as Element).closest("button") !== null && setDetails(null)}>
          <SessionCard block={shown.item} />
        </div>
      </Popover>
    );
  return {
    show: (item, fallback) => {
      const fresh = performance.now() - lastPress.at < PRESS_FRESH_MS;
      setDetails({ item, x: fresh ? lastPress.x : fallback.left, y: fresh ? lastPress.y : fallback.bottom });
    },
    openKey: details === null ? null : itemKey(details.item),
    popovers,
  };
}
