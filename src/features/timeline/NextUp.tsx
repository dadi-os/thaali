import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { yaad } from "../../shared/api";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { addDays, formatTime, formatUntil, toIsoBounds } from "./dates";
import { LiveDot } from "./markers";
import { asPlan, isMultiDay, occurrenceOf, spanOf, type PlanNode, type PlanOccurrence } from "./plans";

/** How far ahead the pill looks for the next plan. */
const WINDOW_DAYS = 14;

export type NextUpProps = {
  /** Ticking clock: drives the countdown and when a plan turns ongoing. */
  now: Date;
  /** The pill was clicked: open its plan beside `el`. */
  onOpen: (nodeId: string, el: Element, occurrence?: PlanOccurrence) => void;
};

/**
 * Header pill for what is happening now ("until 3:00 PM", with a live pulse) or else
 * the next plan and a countdown to it. A multi-day or all-day plan never counts as
 * happening now, so a week-long window or a deadline due today does not hide what is
 * next; the calendar shows them. Renders nothing when no plan falls in the next
 * two weeks.
 */
export function NextUp({ now, onOpen }: NextUpProps) {
  const hour = new Date(now);
  hour.setMinutes(0, 0, 0);
  const nextQuery = useQuery({
    queryKey: ["yaad", "plans", "next", hour.toISOString()],
    queryFn: async () => {
      const { nodes } = await yaad.query({
        kind: "plan",
        ...toIsoBounds(hour, addDays(hour, WINDOW_DAYS)),
        limit: 200,
      });
      return nodes
        .map(asPlan)
        .filter((n): n is PlanNode => n !== null)
        .filter((n) => n.detail.status !== "idea");
    },
    refetchInterval: POLL_MS,
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
      (s) => !isMultiDay(s.plan) && !s.plan.detail.all_day && s.start.getTime() <= t && t < s.end.getTime(),
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
      key={next.plan.id}
      type="button"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onClick={(e) => onOpen(next.plan.id, e.currentTarget, occurrenceOf(next.plan))}
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
