import type { ReactNode } from "react";
import { Card } from "../../shared/ui/Card";
import type { Plan } from "../../types/planner";
import { isSameDay } from "./dates";
import { AllDayBand } from "./AllDayBand";
import { DayRail } from "./DayRail";
import { isMultiDay, plansOn } from "./plans";
import { TimeGrid } from "./TimeGrid";

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
  /** Open the Checklist's Someday section on arrival. */
  somedayOpen: boolean;
  /** What stands in for the timeline when plans cannot be shown; the Checklist keeps working on its own. */
  unavailable: ReactNode | null;
  onOpen: (plan: Plan, element: Element) => void;
};

/**
 * The Day view: the plans on the time axis, with all-day plans in a band above it, and beside it the rail of Now, Up next
 * and the Checklist, which scrolls on its own.
 */
export function DayView({ day, now, zone, plans, selected, wide, somedayOpen, unavailable, onOpen }: DayViewProps) {
  const timed = plans.filter((plan) => !plan.all_day && plan.end_at !== null);
  const bars = plansOn(plans, day).filter((plan) => plan.all_day || isMultiDay(plan));
  const today = isSameDay(day, now);
  return (
    <div style={{ display: "flex", flexDirection: wide ? "row" : "column", flex: 1, gap: wide ? 16 : 12, minWidth: 0, minHeight: 0, alignItems: "stretch" }}>
      <Card aria-label="Timeline" style={{ flex: wide ? 1 : 1.3, padding: "4px 14px 14px", minHeight: 0, minWidth: 0 }}>
        <AllDayBand days={[day]} plans={bars} height={32} onOpen={onOpen} />
        {unavailable ?? <TimeGrid days={[day]} plans={timed} now={now} zone={zone} selected={selected} onOpen={onOpen} />}
      </Card>
      <DayRail day={day} plans={timed} now={now} live={today} somedayOpen={somedayOpen} docked={wide} onOpen={onOpen} />
    </div>
  );
}
