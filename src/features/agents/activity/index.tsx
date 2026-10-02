import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Lane, LogRecord } from "../../../shared/api/types";
import { Glider } from "../../../shared/components/Glider";
import { InlineMarkdown } from "../../../shared/components/Markdown";
import { Tooltip } from "../../../shared/components/Tooltip";
import { LANE_LABEL } from "../../../shared/lib/ux/lanes";
import { EASE, REVEAL, SLOW_S } from "../../../shared/lib/ux/motion";
import { countNoun } from "../../../shared/lib/ux/plural";
import { formatAbsolute, formatRelative } from "../../../shared/lib/ux/time";
import { formatToolSignature } from "../../../chrome/chatSidebar/toolStatus";
import { TurnBlock } from "./blocks";
import { buildActivity, buildRuns, type ActivityRun } from "./runs";

/** Runs shown at first, and added per "show older". */
const RUN_PAGE = 6;

/** Which lanes the feed shows. */
type LaneFilter = Lane | "all";

const FILTER_OPTIONS: Array<{ value: LaneFilter; label: string }> = [
  { value: "all", label: "all" },
  { value: "conversation", label: LANE_LABEL.conversation },
  { value: "reasoning", label: LANE_LABEL.reasoning },
];

/** The newest thing a run wrote or called, as the one line of its collapsed row. */
function runPreview(run: ActivityRun): { kind: "text" | "tool"; text: string } | null {
  for (const turn of run.turns) {
    for (let i = turn.blocks.length - 1; i >= 0; i -= 1) {
      const block = turn.blocks[i];
      if (block.kind === "text") {
        return { kind: "text", text: block.text };
      }
      if (block.kind === "tool") {
        return { kind: "tool", text: formatToolSignature(block.name, block.input) };
      }
    }
  }
  return null;
}

type RunRowProps = {
  run: ActivityRun;
  /** True for the lane's newest run while that lane is running. */
  live: boolean;
  open: boolean;
  onToggle: () => void;
};

/**
 * One lane run on its rail: solid for thinking, dashed for working. The header names the
 * lane with its tool count, failures and time; open, it lists the run's turns newest
 * first, and closed, the newest thing the run wrote or called.
 */
function RunRow({ run, live, open, onToggle }: RunRowProps) {
  const working = run.lane === "reasoning";
  const preview = open ? null : runPreview(run);
  const span =
    run.startedAt === run.at
      ? formatAbsolute(run.at)
      : `${formatAbsolute(run.startedAt)} – ${formatAbsolute(run.at)}`;

  return (
    <motion.li {...REVEAL} className="overflow-hidden">
      <div className="relative pb-3.5 pl-4">
        <span
          aria-hidden
          className={`absolute top-3.5 bottom-1.5 left-[3px] border-l ${
            working ? "border-dashed border-sage-deep/40" : "border-sage/70"
          }`}
        />
        <span
          aria-hidden
          className={`absolute top-[5px] left-0 size-[7px] rounded-full ${
            working
              ? `ring-1 ring-inset ${live ? "ring-sage-deep" : "ring-sage-deep/55"}`
              : live
                ? "bg-sage-deep"
                : "bg-sage"
          } ${live ? "animate-breath" : ""}`}
        />
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
          >
            <span className="text-[12px] font-medium text-ink">{LANE_LABEL[run.lane]}</span>
            {run.toolCount > 0 ? (
              <span className="text-[11px] text-ink-ghost">
                {run.toolCount} {countNoun(run.toolCount, "tool call")}
              </span>
            ) : null}
            {run.errorCount > 0 ? (
              <span className="text-[11px] text-error">{run.errorCount} failed</span>
            ) : null}
          </button>
          <Tooltip content={span}>
            <span className={`shrink-0 text-[10px] ${live ? "text-sage-deep" : "text-ink-ghost"}`}>
              {live ? "now" : formatRelative(run.at)}
            </span>
          </Tooltip>
        </div>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.ol key="turns" {...REVEAL} className="overflow-hidden">
              <AnimatePresence initial={false}>
                {run.turns.map((turn) => (
                  <motion.li key={turn.key} {...REVEAL} className="overflow-hidden">
                    <div className="flex flex-col gap-1.5 pt-2">
                      {turn.blocks.map((block) => (
                        <TurnBlock key={block.key} block={block} live={live} />
                      ))}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ol>
          ) : preview ? (
            <motion.button
              key="preview"
              {...REVEAL}
              type="button"
              onClick={onToggle}
              className="block w-full overflow-hidden text-left"
            >
              <span
                className={`mt-0.5 block truncate leading-snug text-ink-muted ${
                  preview.kind === "tool" ? "font-mono text-[11px]" : "text-[12px]"
                }`}
              >
                {preview.kind === "text" ? <InlineMarkdown content={preview.text} /> : preview.text}
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

export type AgentActivityProps = {
  /** The agent's recent logs, newest first; the popover owns and refreshes this query. */
  logs: UseQueryResult<LogRecord[], Error>;
  /** Which of the agent's lanes are running now; marks each lane's newest run live. */
  running: Record<Lane, boolean>;
  /** The popover's scroll area: the header sticks to it, and new turns wait while it is scrolled past the feed's top. */
  scrollRef: RefObject<HTMLDivElement | null>;
};

/**
 * Recent agent activity from durable logs, grouped into lane runs (thinking or working)
 * that open to each model call's thought, text and tool calls. The header filters by
 * lane and stays pinned while scrolling. New turns ease in on top; while the reader is
 * scrolled into the feed they wait behind an "↑ N new" pill instead of shifting the page.
 */
export function AgentActivity({ logs: logsQuery, running, scrollRef }: AgentActivityProps) {
  const turns = useMemo(
    () => (logsQuery.data ? buildActivity(logsQuery.data) : []),
    [logsQuery.data],
  );
  const [filter, setFilter] = useState<LaneFilter>("all");
  const [limit, setLimit] = useState(RUN_PAGE);
  const [openRuns, setOpenRuns] = useState<Record<string, boolean>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [held, setHeld] = useState<Set<string> | null>(null);
  if (away && held === null) {
    setHeld(new Set(turns.map((turn) => turn.key)));
  }
  if (!away && held !== null) {
    setHeld(null);
  }

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAway(
          !entry.isIntersecting &&
            entry.boundingClientRect.top < root.getBoundingClientRect().top,
        );
      },
      { root },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [scrollRef]);

  const shown = held ? turns.filter((turn) => held.has(turn.key)) : turns;
  const newCount = turns.length - shown.length;
  const runs = buildRuns(
    filter === "all" ? shown : shown.filter((turn) => turn.lane === filter),
  );
  const liveKeys = new Set<string>();
  for (const lane of ["conversation", "reasoning"] as const) {
    const newest = running[lane] ? runs.find((run) => run.lane === lane) : undefined;
    if (newest) {
      liveKeys.add(newest.key);
    }
  }
  const visible = runs.slice(0, limit);
  const older = runs.length - visible.length;

  return (
    <section>
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 bg-glass-sheet px-4 py-2 backdrop-blur-md">
        <h3 className="text-[11px] font-medium tracking-[2px] text-ink-faint">ACTIVITY</h3>
        <div className="flex items-center gap-2">
          <AnimatePresence initial={false}>
            {newCount > 0 ? (
              <motion.button
                key="new"
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: SLOW_S, ease: EASE }}
                onClick={() => sentinelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="rounded-full bg-sage-fill px-2 py-0.5 text-[10.5px] text-sage-deep"
              >
                ↑ {newCount} new
              </motion.button>
            ) : null}
          </AnimatePresence>
          <Glider
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setLimit(RUN_PAGE);
            }}
            label="Lane"
            size="sm"
          />
        </div>
      </div>
      <div ref={sentinelRef} aria-hidden className="h-px scroll-mt-12" />

      <AnimatePresence initial={false}>
        {logsQuery.isLoading ? (
          <motion.div key="loading" {...REVEAL} className="overflow-hidden">
            <div aria-label="Loading activity" className="flex flex-col gap-2 py-2">
              <span className="h-2.5 w-3/4 animate-pulse rounded-full bg-rule/50" />
              <span className="h-2.5 w-1/2 animate-pulse rounded-full bg-rule/50" />
            </div>
          </motion.div>
        ) : null}
        {logsQuery.isError ? (
          <motion.p key="error" {...REVEAL} className="overflow-hidden py-1 text-[13px] text-error">
            Could not load activity: {logsQuery.error.message}
          </motion.p>
        ) : null}
        {logsQuery.isSuccess && runs.length === 0 ? (
          <motion.p key="empty" {...REVEAL} className="overflow-hidden py-1 text-[13px] text-ink-muted">
            {filter === "all" ? "No recent activity." : `No recent ${LANE_LABEL[filter]}.`}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <ol className="flex flex-col pt-1.5">
        <AnimatePresence initial={false}>
          {visible.map((run, index) => {
            const live = liveKeys.has(run.key);
            const open = openRuns[run.key] ?? (index === 0 || live);
            return (
              <RunRow
                key={run.key}
                run={run}
                live={live}
                open={open}
                onToggle={() => setOpenRuns((prev) => ({ ...prev, [run.key]: !open }))}
              />
            );
          })}
        </AnimatePresence>
      </ol>
      {older > 0 || limit > RUN_PAGE ? (
        <div className="flex gap-3 pl-4 text-[11px] text-sage-deep">
          {older > 0 ? (
            <button type="button" onClick={() => setLimit((n) => n + RUN_PAGE)}>
              show {Math.min(older, RUN_PAGE)} older
            </button>
          ) : null}
          {limit > RUN_PAGE ? (
            <button type="button" onClick={() => setLimit(RUN_PAGE)}>
              show fewer
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
