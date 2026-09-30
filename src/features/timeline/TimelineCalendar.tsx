import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { isMeshOnline, yaad } from "../../shared/api";
import type { IngestResponse } from "../../shared/api/types";
import { useConnection } from "../../hooks/useConnection";
import { Glider } from "../../shared/components/Glider";
import { IconPlus } from "../../shared/components/IconButton";
import type { PopoverAnchor } from "../../shared/components/Popover";
import { EASE, REVEAL, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import {
  addDays,
  endOfDay,
  endOfMonth,
  formatDayLong,
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
import { anchorOf, asPlan, type PendingAdd, type PlanNode } from "./plans";
import { QuickAdd } from "./QuickAdd";
import { RibbonView } from "./RibbonView";
import { SomedayRail } from "./SomedayRail";
import { WeekView } from "./WeekView";

export type TimelineView = "week" | "month";

export type TimelineCalendarProps = {
  mode: "full" | "preview";
  /** Controlled view; defaults to week. */
  view?: TimelineView;
  onViewChange?: (view: TimelineView) => void;
  className?: string;
  /** When true, omit the Someday ideas rail (preview / compact). */
  hideIdeas?: boolean;
};

const VIEW_OPTIONS: Array<{ value: TimelineView; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** How often live markers (now line, countdowns, ongoing pulses) re-read the clock. */
const TICK_MS = 30_000;
/** How long a quick-add's new entries glow. */
const FRESH_MS = 4_000;
/** How long a success notice stays; errors stay until dismissed. */
const NOTICE_MS = 6_000;

/**
 * Page motion: pages slide the way time moved (`1` later, `-1` earlier) and a view
 * switch (`0`) settles in place.
 */
const PAGE = {
  enter: (d: number) => ({ opacity: 0, x: d * 32, scale: d === 0 ? 0.985 : 1 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: d * -32, scale: d === 0 ? 1.01 : 1 }),
};

/** A line under the header: what a quick-add or delete did, or why it failed. */
type Notice = { tone: "info" | "error"; text: string };

/** Wall clock that re-renders every `ms`, so live markers keep moving. */
function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** What a quick-add changed, in words: the entries it created, else what it updated, else why it kept nothing. */
function describeIngest(result: IngestResponse): string {
  const created = result.operations.flatMap((op) => (op.op === "create_node" ? [`“${op.title}”`] : []));
  if (created.length > 0) {
    return `Added ${created.join(", ")}`;
  }
  if (result.counts.update_node > 0) {
    return `Updated ${result.counts.update_node} ${result.counts.update_node === 1 ? "entry" : "entries"}`;
  }
  const reasons = result.operations.flatMap((op) => (op.op === "noop" ? [op.reason] : []));
  return `Nothing new to keep — ${reasons.join("; ")}`;
}

/**
 * Week / month calendar of Yaad plans and memories. Full mode pages with motion, keeps
 * a live now marker and Next up countdown, opens any entry for editing, and quick-adds
 * free text through Yaad ingest. Preview is the compact current-week `RibbonView`.
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
  const queryClient = useQueryClient();

  const [internalView, setInternalView] = useState<TimelineView>("week");
  const view = viewProp ?? internalView;
  const setView = (next: TimelineView) => {
    setDirection(0);
    onViewChange?.(next);
    if (viewProp === undefined) {
      setInternalView(next);
    }
  };

  const now = useNow(TICK_MS);
  const today = startOfDay(now);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [direction, setDirection] = useState(0);
  const [opened, setOpened] = useState<{ id: string; anchor: PopoverAnchor; open: boolean } | null>(null);
  const [composer, setComposer] = useState<{
    key: string;
    day: Date | null;
    anchor: PopoverAnchor;
    open: boolean;
  } | null>(null);
  const [pending, setPending] = useState<PendingAdd[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);

  const range = useMemo(() => {
    if (view === "week" || preview) {
      const start = startOfWeek(anchor);
      const end = endOfDay(addDays(start, 6));
      return { start, end, ...toIsoBounds(start, end) };
    }
    const start = startOfWeek(startOfMonth(anchor));
    const end = endOfDay(addDays(startOfWeek(endOfMonth(anchor)), 6));
    return { start, end, ...toIsoBounds(start, end) };
  }, [anchor, view, preview]);

  const plansQuery = useQuery({
    queryKey: ["yaad", "plans", range.occurred_from, range.occurred_to, preview ? "preview" : "full"],
    queryFn: async () => {
      const { nodes } = await yaad.query({
        kind: "plan",
        occurred_from: range.occurred_from,
        occurred_to: range.occurred_to,
        limit: 200,
      });
      return nodes
        .map(asPlan)
        .filter((n): n is PlanNode => n !== null)
        .filter((n) => n.detail.status !== "idea");
    },
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const memoriesQuery = useQuery({
    queryKey: ["yaad", "memories", range.occurred_from, range.occurred_to],
    queryFn: async () => {
      const { nodes } = await yaad.query({
        kind: "memory",
        occurred_from: range.occurred_from,
        occurred_to: range.occurred_to,
        limit: 200,
      });
      return nodes;
    },
    enabled: connected && !preview,
    refetchInterval: POLL_MS,
  });

  const addEntry = useMutation({
    mutationFn: (add: PendingAdd) =>
      yaad.ingest({
        text: add.day ? `On ${formatDayLong(add.day)}: ${add.text}` : add.text,
        occurred_at: new Date().toISOString(),
        source: "ingest",
      }),
    onMutate: (add) => setPending((list) => [...list, add]),
    onSettled: (_result, _error, add) => setPending((list) => list.filter((p) => p.key !== add.key)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["yaad"] });
      setFresh(new Set(result.operations.flatMap((op) => (op.op === "create_node" ? [op.id] : []))));
      setNotice({ tone: "info", text: describeIngest(result) });
    },
    onError: (error) => setNotice({ tone: "error", text: error.message }),
  });

  useEffect(() => {
    if (fresh.size === 0) {
      return;
    }
    const id = window.setTimeout(() => setFresh(new Set()), FRESH_MS);
    return () => window.clearTimeout(id);
  }, [fresh]);

  useEffect(() => {
    if (notice?.tone !== "info") {
      return;
    }
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  const plans = plansQuery.data ?? [];
  const memories = memoriesQuery.data ?? [];
  const labels = weekdayLabels();

  const page = (step: 1 | -1) => {
    setDirection(step);
    if (view === "week" || preview) {
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
  const closeComposer = () => setComposer((c) => (c ? { ...c, open: false } : c));

  const openNode = (id: string, el: Element) => {
    closeComposer();
    setOpened({ id, anchor: anchorOf(el), open: true });
  };

  const openComposer = (day: Date | null, el: Element) => {
    closeNode();
    setComposer({ key: crypto.randomUUID(), day, anchor: anchorOf(el), open: true });
  };

  if (!connected) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`}>
        <p className="text-[13px] text-ink-ghost">Connect to load timeline</p>
      </div>
    );
  }

  if (plansQuery.isError) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`}>
        <p className="text-[13px] text-error">{plansQuery.error.message}</p>
      </div>
    );
  }

  if (preview) {
    return (
      <RibbonView
        days={weekDays(anchor)}
        labels={labels}
        today={today}
        now={now}
        plans={plans}
        className={className}
      />
    );
  }

  const title = view === "week" ? formatWeekTitle(anchor) : formatMonthTitle(anchor);

  return (
    <div className={`flex h-full min-h-0 gap-3 ${className}`}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Glider options={VIEW_OPTIONS} value={view} onChange={setView} label="Timeline view" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => page(-1)}
              className="rounded-[6px] px-2 py-1 text-[12px] text-sage-deep transition-colors duration-slow ease-hath hover:bg-sage-active/40"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-[6px] px-2 py-1 text-[11px] tracking-wide text-ink-muted transition-colors duration-slow ease-hath hover:bg-sage-active/40"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              className="rounded-[6px] px-2 py-1 text-[12px] text-sage-deep transition-colors duration-slow ease-hath hover:bg-sage-active/40"
              aria-label="Next"
            >
              ›
            </button>
          </div>
          <div className="relative min-w-0 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.span
                key={title}
                custom={direction}
                initial={{ opacity: 0, y: direction === 0 ? 4 : direction * 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction === 0 ? -4 : direction * -10 }}
                transition={{ duration: SLOW_S, ease: EASE }}
                className="block whitespace-nowrap text-[13px] text-ink"
              >
                {title}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <NextUp now={now} onOpen={openNode} />
            <button
              type="button"
              onClick={(e) => openComposer(null, e.currentTarget)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-sage-active px-3 py-1 text-[12px] text-sage-deep transition-colors duration-slow ease-hath hover:bg-sage-line/50 [&>svg]:size-3.5"
            >
              <IconPlus />
              Add
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {notice ? (
            <motion.div key="notice" {...REVEAL} className="overflow-hidden">
              <div
                className={`mb-2 flex items-center gap-2 rounded-full px-3 py-1 text-[12px] ${
                  notice.tone === "error" ? "bg-error-fill text-error" : "bg-sage-fill text-sage-deep"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{notice.text}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="shrink-0 text-[11px] opacity-70 hover:opacity-100"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ) : null}
          {memoriesQuery.isError ? (
            <motion.p key="memories-error" {...REVEAL} className="mb-2 overflow-hidden text-[12px] text-error">
              Memories: {memoriesQuery.error.message}
            </motion.p>
          ) : null}
        </AnimatePresence>

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
              {view === "week" ? (
                <WeekView
                  days={weekDays(anchor)}
                  labels={labels}
                  today={today}
                  now={now}
                  plans={plans}
                  memories={memories}
                  loading={plansQuery.isPending}
                  fresh={fresh}
                  pending={pending}
                  onOpen={openNode}
                  onAdd={openComposer}
                />
              ) : (
                <MonthView
                  days={monthGridDays(anchor)}
                  anchor={anchor}
                  labels={labels}
                  today={today}
                  plans={plans}
                  memories={memories}
                  loading={plansQuery.isPending}
                  fresh={fresh}
                  onSelectDay={(day) => {
                    setAnchor(day);
                    setView("week");
                  }}
                  onAdd={openComposer}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!hideIdeas ? <SomedayRail onOpen={openNode} /> : null}

      {opened ? (
        <NodePopover
          open={opened.open}
          nodeId={opened.id}
          anchor={opened.anchor}
          onClose={closeNode}
          onSelect={(id) => setOpened((o) => (o ? { ...o, id } : o))}
          onDeleted={(result, deletedTitle) => {
            closeNode();
            const swept = result.orphans.length;
            setNotice({
              tone: "info",
              text: `Deleted “${deletedTitle}”${
                swept > 0 ? ` · cleared ${swept} unlinked ${swept === 1 ? "entry" : "entries"}` : ""
              }`,
            });
          }}
        />
      ) : null}

      {composer ? (
        <QuickAdd
          key={composer.key}
          open={composer.open}
          day={composer.day}
          anchor={composer.anchor}
          onClose={closeComposer}
          onSubmit={(text) => {
            addEntry.mutate({ key: composer.key, day: composer.day, text });
            closeComposer();
          }}
        />
      ) : null}
    </div>
  );
}
