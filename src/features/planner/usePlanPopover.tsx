import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "../../shared/overlay/Popover";
import { useRetained } from "../../shared/hooks/useRetained";
import type { Plan } from "../../types/planner";
import { PlanCard } from "./PlanCard";

/** A plan and the point it was opened from. */
type Shown = { plan: Plan; x: number; y: number };

/** How long after a click a popover still opens at that click, in ms. */
const PRESS_FRESH_MS = 400;
/** Radius kept clear around the point, so the card sits beside the pointer and never under it. */
const POINTER_CLEARANCE = 8;

/** Where the pointer last clicked and when; a click from the keyboard has no position and leaves it alone. */
const lastPress = { x: 0, y: 0, at: 0 };

/** What {@link usePlanPopover} gives back. */
export type PlanPopover = {
  /** Open the details popover of `plan`: beside the press that asked for it, or under `fallback` (where the item is drawn) when there was none just now. */
  show: (plan: Plan, fallback: DOMRect) => void;
  /** Key of the plan whose details are open, or null. */
  openKey: string | null;
  /** The popover; render it once, anywhere in the page. */
  popovers: ReactNode;
};

/**
 * A plan's click popover: its card (RSVP, time, place, notes, Attended, Message and Show in Yaad) opening beside where
 * the pointer pressed, kept clear of it and inside the window, its notes scrolling inside the card when they are long. It
 * closes on Escape, a press outside and when the page that owns it goes away.
 */
export function usePlanPopover(): PlanPopover {
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
      <Popover open={details !== null} anchor={{ x: shown.x, y: shown.y, radius: POINTER_CLEARANCE }} aria-label={`${shown.plan.title} details`} widthPx={400} reserveRoom={false} onClose={() => setDetails(null)}>
        <div className="flex min-h-0 flex-1 flex-col" onClick={(event) => (event.target as Element).closest("button") !== null && setDetails(null)}>
          <PlanCard plan={shown.plan} />
        </div>
      </Popover>
    );
  return {
    show: (plan, fallback) => {
      const fresh = performance.now() - lastPress.at < PRESS_FRESH_MS;
      setDetails({ plan, x: fresh ? lastPress.x : fallback.left, y: fresh ? lastPress.y : fallback.bottom });
    },
    openKey: details === null ? null : details.plan.id,
    popovers,
  };
}
