import { motion } from "motion/react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { TimelineCalendar, type TimelineView } from "../features/timeline/TimelineCalendar";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/**
 * Full Timeline page: the day planner, plus week and month plan calendars with a Someday
 * ideas rail. `?view=week` (the home tile's link) opens the week.
 */
export function TimelinePage() {
  const [params] = useSearchParams();
  const requested = params.get("view");
  const [view, setView] = useState<TimelineView>(requested === "week" || requested === "month" ? requested : "planner");
  return (
    <motion.div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <PageHeader
        title="TIMELINE"
        hint="The day planner · plans by week and month · ideas live in Someday"
      />
      <div className="min-h-0 flex-1 px-1 pb-1">
        <TimelineCalendar mode="full" view={view} onViewChange={setView} />
      </div>
    </motion.div>
  );
}
