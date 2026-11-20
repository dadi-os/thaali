import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "../../shared/overlay/Popover";
import { useRetained } from "../../shared/hooks/useRetained";
import type { Plan, Task } from "../../types/planner";
import { PlanCard } from "./PlanCard";
import { placeAround } from "./popoverPlacement";
import { DayCard, type DayDetails } from "./DayCard";
import { TaskCard } from "./TaskCard";

/** What is open and the point it was opened from. */
type Item = { kind: "plan"; plan: Plan } | { kind: "task"; task: Task } | { kind: "day"; details: DayDetails };
type Shown = Item & { x: number; y: number };

/** How long after a click a popover still opens at that click, in ms. */
const PRESS_FRESH_MS = 400;
/** The popover's width, and how tall each kind of card usually is, in px: what placement plans around. */
const WIDTH = 420;
const HEIGHT = { plan: 420, task: 380, day: 520 } as const;

/** Where the pointer last clicked and when; a click from the keyboard has no position and leaves it alone. */
const lastPress = { x: 0, y: 0, at: 0 };

/** What {@link useDetailsPopover} gives back. */
export type DetailsPopover = {
  /** Open a plan's details beside the press that asked for it, or under `fallback` (where the plan is drawn) when there was none just now. */
  show: (plan: Plan, fallback: DOMRect) => void;
  /** Open a task's details the same way. */
  showTask: (task: Task, fallback: DOMRect) => void;
  /** Open a day's card (its plans and the tasks closing on it) the same way. */
  showDay: (details: DayDetails, fallback: DOMRect) => void;
  /** Key of the plan or task whose details are open, or null. */
  openKey: string | null;
  /** The popover; render it once, anywhere in the page. */
  popovers: ReactNode;
};

/**
 * The click popover of a plan or a task: its card, in the shared detail anatomy, opening beside where the pointer pressed,
 * kept clear of it and inside the window, its notes scrolling inside when long. It closes on Escape, a press outside and
 * when the page that owns it goes away; choosing Message agent or Show in Yaad closes it, while Attended and Mark done leave
 * it open so the answer can be seen.
 */
export function useDetailsPopover(onOpenDay: (day: Date) => void): DetailsPopover {
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
  const open = (next: Item, fallback: DOMRect) => {
    const around = placeAround(fallback, WIDTH, HEIGHT[next.kind], { width: window.innerWidth, height: window.innerHeight });
    if (around !== null) {
      setDetails({ ...next, ...around });
      return;
    }
    const fresh = performance.now() - lastPress.at < PRESS_FRESH_MS;
    setDetails({ ...next, x: fresh ? lastPress.x : fallback.left, y: fresh ? lastPress.y : fallback.bottom });
  };
  const title = shown === null ? "" : shown.kind === "plan" ? shown.plan.title : shown.kind === "task" ? shown.task.title : "Day";
  const popovers =
    shown === null ? null : (
      <Popover open={details !== null} anchor={{ x: shown.x, y: shown.y, radius: 0 }} aria-label={`${title} details`} widthPx={WIDTH} reserveRoom={false} onClose={() => setDetails(null)}>
        <div
          className="flex min-h-0 flex-1 flex-col"
          onClick={(event) => {
            const button = (event.target as Element).closest("button");
            if (button !== null && button.closest("[data-keep-open]") === null) setDetails(null);
          }}
        >
          {shown.kind === "plan" ? (
            <PlanCard plan={shown.plan} />
          ) : shown.kind === "task" ? (
            <TaskCard task={shown.task} />
          ) : (
            <DayCard details={shown.details} onOpenPlan={(plan, element) => open({ kind: "plan", plan }, element.getBoundingClientRect())} onOpenTask={(task, element) => open({ kind: "task", task }, element.getBoundingClientRect())} onOpenDay={() => { onOpenDay(shown.details.day); setDetails(null); }} />
          )}
        </div>
      </Popover>
    );
  return {
    show: (plan, fallback) => open({ kind: "plan", plan }, fallback),
    showTask: (task, fallback) => open({ kind: "task", task }, fallback),
    showDay: (details, fallback) => open({ kind: "day", details }, fallback),
    openKey: details === null ? null : details.kind === "plan" ? details.plan.id : details.kind === "task" ? details.task.id : details.details.day.toDateString(),
    popovers,
  };
}
