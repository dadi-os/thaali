import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { timeline } from "../../shared/api";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import type { TimelineItem } from "../../types/timeline";
import { addDays, formatTime, formatUntil } from "./dates";
import { LiveDot } from "./markers";
import { itemKey, isMultiDay, spanOf } from "./plans";

/** How far ahead the pill looks for the next plan. */
const WINDOW_DAYS = 14;

export type NextUpProps = {
  /** Ticking clock: drives the countdown and when a plan turns ongoing. */
  now: Date;
  /** The pill was clicked: open its plan beside `el`. */
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * Header pill for what is happening now ("until 3:00 PM", with a live pulse) or else
 * the next session on the planner and a countdown to it; cancelled sessions are skipped.
 * Renders nothing when no session falls in the next two weeks.
 */
export function NextUp({ now, onOpen }: NextUpProps) {
  const hour = new Date(now);
  hour.setMinutes(0, 0, 0);
  const nextQuery = useQuery({
    queryKey: ["yaad", "timeline", "next", hour.toISOString()],
    queryFn: async () =>
      (
        await timeline.query({ from: hour.toISOString(), to: addDays(hour, WINDOW_DAYS).toISOString(), view: "planner" })
      ).items.filter((item) => item.state !== "cancelled"),
  });

  const next = useMemo(() => {
    if (!nextQuery.data) {
      return null;
    }
    const t = now.getTime();
    const spans = nextQuery.data.flatMap((plan) => {
      const span = spanOf(plan);
      return span ? [{ plan, ...span }] : [];
    });
    const ongoing = spans.find(
      (s) => !isMultiDay(s.plan) && s.start.getTime() <= t && t < s.end.getTime(),
    );
    if (ongoing) {
      return { ...ongoing, ongoing: true };
    }
    const upcoming = spans
      .filter((s) => s.start.getTime() > t)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    return upcoming ? { ...upcoming, ongoing: false } : null;
  }, [nextQuery.data, now]);

  if (nextQuery.isError) {
    return <span className="truncate text-[12px] text-error">{nextQuery.error.message}</span>;
  }
  if (!next) {
    return null;
  }
  return (
    <motion.button
      key={itemKey(next.plan)}
      type="button"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onClick={(e) => onOpen(next.plan, e.currentTarget)}
      className="flex min-w-0 max-w-[320px] items-center gap-2 rounded-full border border-rule bg-bone px-3 py-1 text-[12px] transition-colors duration-slow ease-dadi hover:border-sage-line"
    >
      {next.ongoing ? (
        <LiveDot />
      ) : (
        <span className="text-[10px] font-medium tracking-[1.5px] text-ink-ghost">NEXT</span>
      )}
      <span className="min-w-0 truncate text-ink">{next.plan.title}</span>
      <span className="shrink-0 tabular-nums text-ink-muted">
        {next.ongoing ? `until ${formatTime(next.end.toISOString())}` : formatUntil(now, next.start)}
      </span>
    </motion.button>
  );
}
