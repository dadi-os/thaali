import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { isMeshOnline, timeline } from "../../shared/api";
import type { TimelineItem, TimelineViewName } from "../../types/timeline";
import { useConnection } from "../../shared/hooks/useConnection";
import { Glider } from "../../shared/components/Glider";
import { StateView } from "../../shared/components/states";
import { Popover, type PopoverAnchor } from "../../shared/components/Popover";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import {
  addDays,
  endOfDay,
  endOfMonth,
  formatMonthTitle,
  formatWeekTitle,
  monthGridDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toIsoBounds,
  weekDays,
  weekdayLabels,
} from "./dates";
import { MonthView } from "./MonthView";
import { NextUp } from "./NextUp";
import { NodePopover } from "./NodePopover";
import { anchorOf, itemKey } from "./plans";
import { isSettled } from "./planner/blocks";
import { PlannerDay } from "./planner/PlannerDay";
import { SessionCard } from "./planner/SessionCard";
import { RibbonView } from "./RibbonView";
import { NeedsATime, SomedayRail } from "./Someday";
import { WeekView } from "./WeekView";

export type TimelineView = "planner" | "week" | "month" | "someday";

export type TimelineCalendarProps = {
  mode: "full" | "preview";
  /** Controlled view; defaults to the planner. */
  view?: TimelineView;
  onViewChange?: (view: TimelineView) => void;
  className?: string;
  /** When true, omit the Someday ideas rail (preview / compact). */
  hideIdeas?: boolean;
};

const VIEW_OPTIONS: Array<{ value: TimelineView; label: string }> = [
  { value: "planner", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "someday", label: "Needs a time" },
];

/** How often live markers (now line, countdowns, ongoing pulses) re-read the clock. */
const TICK_MS = 30_000;

/**
 * Page motion: pages slide the way time moved (`1` later, `-1` earlier) and a view
 * switch (`0`) settles in place.
 */
const PAGE = {
  enter: (d: number) => ({ opacity: 0, x: d * 32, scale: d === 0 ? 0.985 : 1 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: d * -32, scale: d === 0 ? 1.01 : 1 }),
};

/** Wall clock that re-renders every `ms`, so live markers keep moving. */
function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Day (one day of timed sessions) / week / month calendar over Yaad's timeline views, plus
 * Needs a time (the someday view in full). Full mode pages with motion, keeps a live now marker
 * and Next up countdown, and opens any session to mark it Completed or message its owner. Preview is the compact current-week `RibbonView` of commitments, whose
 * sessions open the same detail popover in place; the popover's events stay out of the
 * surrounding tile, which opens the full timeline.
 */
export function TimelineCalendar({
  mode,
  view: viewProp,
  onViewChange,
  className = "",
  hideIdeas = mode === "preview",
}: TimelineCalendarProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const preview = mode === "preview";

  const [internalView, setInternalView] = useState<TimelineView>("planner");
  const view = viewProp ?? internalView;
  const setView = (next: TimelineView) => {
    setDirection(0);
    setOpenedBlock(null);
    onViewChange?.(next);
    if (viewProp === undefined) {
      setInternalView(next);
    }
  };

  const now = useNow(TICK_MS);
  const today = startOfDay(now);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [direction, setDirection] = useState(0);
  const [opened, setOpened] = useState<{
    id: string;
    anchor: PopoverAnchor;
    open: boolean;
    session?: TimelineItem;
  } | null>(null);
  const [openedBlock, setOpenedBlock] = useState<{ key: string; anchor: PopoverAnchor; open: boolean } | null>(null);

  const range = useMemo(() => {
    if (view === "planner" && !preview) {
      const start = startOfDay(anchor);
      const end = endOfDay(addDays(start, 1));
      return { start, end, ...toIsoBounds(start, end) };
    }
    if (view === "week" || preview) {
      const start = startOfWeek(anchor);
      const end = endOfDay(addDays(start, 6));
      return { start, end, ...toIsoBounds(start, end) };
    }
    const start = startOfWeek(startOfMonth(anchor));
    const end = endOfDay(addDays(startOfWeek(endOfMonth(anchor)), 6));
    return { start, end, ...toIsoBounds(start, end) };
  }, [anchor, view, preview]);

  const views: TimelineViewName[] = preview ? ["tile"] : view === "week" ? ["planner", "tile"] : ["month"];
  const plansQuery = useQuery({
    queryKey: ["yaad", "timeline", views.join("+"), range.occurred_from, range.occurred_to],
    queryFn: async () => {
      const results = await Promise.all(
        views.map((name) => timeline.query({ from: range.occurred_from, to: range.occurred_to, view: name })),
      );
      const byKey = new Map(results.flatMap(({ items }) => items).map((item) => [itemKey(item), item] as const));
      return [...byKey.values()];
    },
    enabled: connected && (preview || (view !== "planner" && view !== "someday")),
  });

  const planned = !preview && view === "planner";
  const blocksQuery = useQuery({
    queryKey: ["yaad", "timeline", "planner", range.occurred_from, range.occurred_to],
    queryFn: async () => (await timeline.query({ from: range.occurred_from, to: range.occurred_to, view: "planner" })).items,
    enabled: connected && planned,
  });

  const duesQuery = useQuery({
    queryKey: ["yaad", "timeline", "due", range.occurred_from, range.occurred_to],
    queryFn: async () => (await timeline.query({ from: range.occurred_from, to: range.occurred_to, view: "due" })).items,
    enabled: connected && planned,
  });

  const plans = plansQuery.data ?? [];
  const blocks = blocksQuery.data ?? [];
  const labels = weekdayLabels();

  const page = (step: 1 | -1) => {
    setDirection(step);
    setOpenedBlock(null);
    if (view === "planner" && !preview) {
      setAnchor((a) => addDays(a, step));
    } else if (view === "week" || preview) {
      setAnchor((a) => addDays(a, 7 * step));
    } else {
      setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + step, 1));
    }
  };

  const goToday = () => {
    setDirection(Math.sign(today.getTime() - startOfDay(anchor).getTime()));
    setAnchor(today);
  };

  const closeNode = () => setOpened((o) => (o ? { ...o, open: false } : o));
  const closeBlock = () => setOpenedBlock((o) => (o ? { ...o, open: false } : o));

  const openNode = (session: TimelineItem, el: Element) => {
    setOpened({ id: session.id, anchor: anchorOf(el), open: true, session });
  };

  const shownData = preview || !planned ? plansQuery.data : blocksQuery.data;
  if (!connected && !shownData) {
    return <StateView tone="offline" label="Timeline is offline" detail="Plans come back when dadi reconnects" compact={preview} className={className} />;
  }

  const failed = planned ? (blocksQuery.isError ? blocksQuery : duesQuery) : plansQuery;
  if (failed.isError && !failed.data) {
    return (
      <StateView
        tone="error"
        label={planned ? "Could not load the plan" : "Could not load plans"}
        error={failed.error}
        onRetry={() => void failed.refetch()}
        compact={preview}
        className={className}
      />
    );
  }

  if (preview) {
    return (
      <>
        <RibbonView
          days={weekDays(anchor)}
          labels={labels}
          today={today}
          now={now}
          plans={plans}
          loading={plansQuery.isPending}
          onOpen={openNode}
          className={className}
        />
        {opened ? (
          <div className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <NodePopover
              open={opened.open}
              nodeId={opened.id}
              {...(opened.session ? { session: opened.session } : {})}
              anchor={opened.anchor}
              onClose={closeNode}
              onSelect={(id) => setOpened((o) => (o ? { id, anchor: o.anchor, open: o.open } : o))}
            />
          </div>
        ) : null}
      </>
    );
  }

  const title =
    view === "planner" || view === "someday" ? "" : view === "week" ? formatWeekTitle(anchor) : formatMonthTitle(anchor);
  const openBlock = openedBlock === null ? null : (blocks.find((b) => itemKey(b) === openedBlock.key) ?? null);

  return (
    <div className={`flex h-full min-h-0 gap-3 portrait:flex-col ${className}`}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Glider options={VIEW_OPTIONS} value={view} onChange={setView} label="Timeline view" size="lg" />
          <div className={`flex items-center gap-1 ${view === "someday" ? "invisible" : ""}`}>
            <button
              type="button"
              onClick={() => page(-1)}
              className="flex size-8 items-center justify-center rounded-full text-[16px] text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-ink"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-9 rounded-full bg-bone px-4 text-[14px] font-semibold text-ink shadow-[0_1px_2px_rgba(92,107,82,0.08),0_4px_12px_rgba(44,48,42,0.06)] transition-colors duration-slow ease-dadi hover:text-sage-deep"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              className="flex size-8 items-center justify-center rounded-full text-[16px] text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-ink"
              aria-label="Next"
            >
              ›
            </button>
          </div>
        </div>

        {title ? (
          <div className="mb-4 flex min-w-0 items-end justify-between gap-4">
            <div className="relative min-w-0 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.h2
                  key={title}
                  custom={direction}
                  initial={{ opacity: 0, y: direction === 0 ? 4 : direction * 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: direction === 0 ? -4 : direction * -10 }}
                  transition={{ duration: SLOW_S, ease: EASE }}
                  className="m-0 whitespace-nowrap text-[44px] leading-[1.05] font-bold tracking-[-1px] text-ink"
                >
                  {title}
                </motion.h2>
              </AnimatePresence>
            </div>
            <NextUp now={now} onOpen={openNode} />
          </div>
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={`${view}:${range.occurred_from}`}
              custom={direction}
              variants={PAGE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: SLOW_S, ease: EASE }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {planned ? (
                <PlannerDay
                  day={startOfDay(anchor)}
                  today={today}
                  now={now}
                  blocks={blocks}
                  dues={duesQuery.data ?? []}
                  loading={blocksQuery.isPending}
                  onOpen={(block, el) => {
                    closeNode();
                    setOpenedBlock({ key: itemKey(block), anchor: anchorOf(el), open: true });
                  }}
                />
              ) : view === "someday" ? (
                <NeedsATime onOpen={openNode} />
              ) : view === "week" ? (
                <WeekView
                  days={weekDays(anchor)}
                  labels={labels}
                  today={today}
                  now={now}
                  plans={plans}
                  loading={plansQuery.isPending}
                  onOpen={openNode}
                />
              ) : (
                <MonthView
                  days={monthGridDays(anchor)}
                  anchor={anchor}
                  labels={labels}
                  today={today}
                  now={now}
                  plans={plans}
                  loading={plansQuery.isPending}
                  onOpen={openNode}
                  onSelectDay={(day) => {
                    setAnchor(day);
                    setView("week");
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!hideIdeas && !planned && view !== "someday" ? <SomedayRail onOpen={openNode} /> : null}

      {openedBlock !== null && openBlock !== null ? (
        <Popover
          open={openedBlock.open}
          onClose={closeBlock}
          anchor={openedBlock.anchor}
          aria-label={`${openBlock.title} details`}
          widthPx={300}
          contentKey={itemKey(openBlock)}
        >
          <SessionCard block={openBlock} settled={isSettled(openBlock, now)} />
        </Popover>
      ) : null}

      {opened ? (
        <NodePopover
          open={opened.open}
          nodeId={opened.id}
          {...(opened.session ? { session: opened.session } : {})}
          anchor={opened.anchor}
          onClose={closeNode}
          onSelect={(id) => setOpened((o) => (o ? { id, anchor: o.anchor, open: o.open } : o))}
        />
      ) : null}
    </div>
  );
}
