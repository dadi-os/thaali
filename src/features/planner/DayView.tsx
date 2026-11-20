import type { ReactNode } from "react";
import { Card } from "../../shared/ui/Card";
import type { Plan, Task } from "../../types/planner";
import { isSameDay } from "./dates";
import { AllDayBand } from "./AllDayBand";
import { DayRail } from "./DayRail";
import { bandPlans, gridPlans, plansOn } from "./plans";
import { TimeGrid } from "./TimeGrid";

/** The timeline's height, in px, when the rail sits under it: the page scrolls past it to Now, Up next and the Checklist. */
const NARROW_TIMELINE = 460;

export type DayViewProps = {
  /** The local day shown. */
  day: Date;
  /** The ticking clock. */
  now: Date;
  /** The device's IANA zone. */
  zone: string;
  /** Every plan the queries returned around the day: timed ones and the all-day ones. */
  plans: Plan[];
  /** Id of the plan whose detail is open. */
  selected: string | null;
  /** The rail sits beside the timeline; false stacks it under it. */
  wide: boolean;
  /** Opens the Someday sheet. */
  onSomeday: () => void;
  /** Opens a task's details beside the chosen control. */
  onOpenTask: (task: Task, element: Element) => void;
  /** What stands in for the timeline when plans cannot be shown; the Checklist keeps working on its own. */
  unavailable: ReactNode | null;
  onOpen: (plan: Plan, element: Element) => void;
};

/**
 * The Day view: the plans on the time axis, with all-day plans in a band above it, and beside it the rail of Now, Up next
 * and the Checklist, which scrolls on its own.
 */
export function DayView({ day, now, zone, plans, selected, wide, onSomeday, onOpenTask, unavailable, onOpen }: DayViewProps) {
  const timed = gridPlans(plans);
  const bars = plansOn(bandPlans(plans), day);
  const today = isSameDay(day, now);
  return (
    <div className={wide ? undefined : "scroll"} style={{ display: "flex", flexDirection: wide ? "row" : "column", flex: 1, gap: wide ? 16 : 12, minWidth: 0, minHeight: 0, alignItems: "stretch" }}>
      <Card aria-label="Timeline" style={{ flex: wide ? 1 : "none", height: wide ? undefined : NARROW_TIMELINE, padding: "4px 14px 14px", minHeight: 0, minWidth: 0 }}>
        <AllDayBand days={[day]} plans={bars} height={32} onOpen={onOpen} />
        {unavailable ?? <TimeGrid days={[day]} plans={timed} now={now} zone={zone} selected={selected} onOpen={onOpen} />}
      </Card>
      <DayRail day={day} plans={timed} now={now} live={today} onSomeday={onSomeday} onOpenTask={onOpenTask} docked={wide} onOpen={onOpen} />
    </div>
  );
}
