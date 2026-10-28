import { motion } from "motion/react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { TimelineCalendar, type TimelineView } from "../features/timeline/TimelineCalendar";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/**
 * Full Timeline page: the day planner, week and month calendars with a Needs a time rail, and
 * Needs a time in full. `?view=week` (the home tile's link) opens the week; `?view=someday` Needs a time.
 */
export function TimelinePage() {
  const [params] = useSearchParams();
  const requested = params.get("view");
  const [view, setView] = useState<TimelineView>(requested === "week" || requested === "month" || requested === "someday" ? requested : "planner");
  return (
    <motion.div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <PageHeader
        title="TIMELINE"
        hint="Click a session to mark it completed or message the agent that keeps it"
      />
      <div className="min-h-0 flex-1 px-1 pb-1">
        <TimelineCalendar mode="full" view={view} onViewChange={setView} />
      </div>
    </motion.div>
  );
}
