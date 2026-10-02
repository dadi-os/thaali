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
import { formatToolSignature } from "../../../shared/lib/content/toolSignature";
import { Step } from "./blocks";
import { buildActivity, type ActivityStep, type ActivityWake } from "./wakes";

/** Wakes shown at first, and added per "show older". */
const WAKE_PAGE = 5;

/**
 * A long wake shows its opening steps (what set it off) and its latest ones, with the
 * middle folded behind a "show N earlier steps" row.
 */
const STEP_HEAD = 2;
const STEP_TAIL = 8;

/** Which lanes' steps the feed shows. */
type LaneFilter = Lane | "all";

const FILTER_OPTIONS: Array<{ value: LaneFilter; label: string }> = [
  { value: "all", label: "all" },
  { value: "conversation", label: LANE_LABEL.conversation },
  { value: "reasoning", label: LANE_LABEL.reasoning },
];

/** A lane's mark on the timeline rail: a filled dot for thinking, a ring for working. */
const LANE_DOT: Record<Lane, string> = {
  conversation: "bg-sage",
  reasoning: "bg-bone ring-1 ring-inset ring-sage-deep/60",
};

/** How long a wake ran, at the coarsest unit that still says something. */
function formatSpan(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** What set a wake off: who messaged, or which lanes started on their own. */
function wakeTitle(wake: ActivityWake): string {
  const first = wake.steps[0];
  if (first.kind === "message" && first.direction === "receive") {
    const from = `from ${first.peer ?? "you"}`;
    return first.scheduled ? `scheduled ${from}` : from;
  }
  return wake.lanes.map((lane) => LANE_LABEL[lane]).join(" + ");
}

/** The wake's opening step as one line for its collapsed row. */
function wakePreview(step: ActivityStep): { mono: boolean; text: string } | null {
  if (step.kind === "message") {
    return { mono: false, text: step.content };
  }
  const part = step.parts[0];
  return part.kind === "text"
    ? { mono: false, text: part.text }
    : { mono: true, text: formatToolSignature(part.tool.name, part.tool.input) };
}

type WakeRowProps = {
  wake: ActivityWake;
  /** The steps to show, after the lane filter and any held-back new steps. */
  steps: ActivityStep[];
  /** True for the newest wake while one of the agent's lanes is running. */
  live: boolean;
  open: boolean;
  onToggle: () => void;
};

/**
 * One wake: what set it off, which lanes worked, its tool calls, failures and span.
 * Open, its steps run oldest first down a rail whose dots mark each step's lane, naming
 * the lane wherever it changes; closed, its opening step stands in as one line.
 */
function WakeRow({ wake, steps, live, open, onToggle }: WakeRowProps) {
  const [unfolded, setUnfolded] = useState(false);
  const folded =
    unfolded || steps.length <= STEP_HEAD + STEP_TAIL + 1 ? 0 : steps.length - STEP_HEAD - STEP_TAIL;
  const rows: Array<ActivityStep | "fold"> =
    folded > 0 ? [...steps.slice(0, STEP_HEAD), "fold", ...steps.slice(-STEP_TAIL)] : steps;
  const preview = open ? null : wakePreview(steps[0]);
  const span = Date.parse(wake.at) - Date.parse(wake.startedAt);
  const meta = [
    wake.toolCount > 0 ? `${wake.toolCount} ${countNoun(wake.toolCount, "tool call")}` : null,
    span >= 1000 ? formatSpan(span) : null,
  ].filter((part) => part !== null);

  return (
    <motion.li {...REVEAL} className="overflow-hidden">
      <div className="border-b border-rule/50 py-2.5">
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
          >
            <span aria-hidden className="flex shrink-0 gap-0.5 self-center">
              {wake.lanes.map((lane) => (
                <span
                  key={lane}
                  className={`inline-block size-[7px] rounded-full ${LANE_DOT[lane]} ${
                    live ? "animate-breath" : ""
                  }`}
                />
              ))}
            </span>
            <span className="truncate text-[12px] font-medium text-ink">{wakeTitle(wake)}</span>
            <span className="shrink-0 text-[11px] text-ink-ghost">
              {meta.join(" · ")}
              {wake.errorCount > 0 ? (
                <span className="text-error">
                  {meta.length > 0 ? " · " : ""}
                  {wake.errorCount} failed
                </span>
              ) : null}
            </span>
          </button>
          <Tooltip
            content={
              span >= 1000
                ? `${formatAbsolute(wake.startedAt)} – ${formatAbsolute(wake.at)}`
                : formatAbsolute(wake.at)
            }
          >
            <span className={`shrink-0 text-[10px] ${live ? "text-sage-deep" : "text-ink-ghost"}`}>
              {live ? "now" : formatRelative(wake.at)}
            </span>
          </Tooltip>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.ol
              key="steps"
              {...REVEAL}
              className="relative overflow-hidden before:absolute before:top-2 before:bottom-3 before:left-[3px] before:border-l before:border-rule"
            >
              <AnimatePresence initial={false}>
                {rows.map((row, index) => {
                  if (row === "fold") {
                    return (
                      <motion.li key="fold" {...REVEAL} className="overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setUnfolded(true)}
                          className="relative block pt-2 pl-4 text-[11px] text-sage-deep"
                        >
                          <span
                            aria-hidden
                            className="absolute top-[13px] left-[1px] size-[5px] rounded-full bg-rule"
                          />
                          show {folded} earlier {countNoun(folded, "step")}
                        </button>
                      </motion.li>
                    );
                  }
                  const previous = rows[index - 1];
                  return (
                    <motion.li key={row.key} {...REVEAL} className="overflow-hidden">
                      <div className="relative pt-2 pl-4">
                        <span
                          aria-hidden
                          className={`absolute top-[13px] left-0 size-[7px] rounded-full ${LANE_DOT[row.lane]}`}
                        />
                        {previous === undefined || previous === "fold" || previous.lane !== row.lane ? (
                          <p className="mb-0.5 text-[10px] tracking-wide text-ink-ghost">
                            {LANE_LABEL[row.lane]}
                          </p>
                        ) : null}
                        <Step step={row} live={live} />
                      </div>
                    </motion.li>
                  );
                })}
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
                  preview.mono ? "font-mono text-[11px]" : "text-[12px]"
                }`}
              >
                {preview.mono ? preview.text : <InlineMarkdown content={preview.text} />}
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
  /** Which of the agent's lanes are running now; marks the newest wake live. */
  running: Record<Lane, boolean>;
  /** The popover's scroll area: the header sticks to it, and new steps wait while it is scrolled past the feed's top. */
  scrollRef: RefObject<HTMLDivElement | null>;
};

/**
 * Recent agent activity from durable logs, as wakes: each stretch of work from the
 * message (or cold start) that set it off until both lanes yielded, its messages and
 * model calls in order with each call's thought, text and tool calls. The header filters
 * by lane and stays pinned while scrolling. New steps ease in; while the reader is
 * scrolled into the feed they wait behind an "↑ N new" pill instead of shifting the page.
 */
export function AgentActivity({ logs: logsQuery, running, scrollRef }: AgentActivityProps) {
  const wakes = useMemo(
    () => (logsQuery.data ? buildActivity(logsQuery.data) : []),
    [logsQuery.data],
  );
  const [filter, setFilter] = useState<LaneFilter>("all");
  const [limit, setLimit] = useState(WAKE_PAGE);
  const [openWakes, setOpenWakes] = useState<Record<string, boolean>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [held, setHeld] = useState<Set<string> | null>(null);
  if (away && held === null) {
    setHeld(new Set(wakes.flatMap((wake) => wake.steps.map((step) => step.key))));
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

  const liveKey =
    wakes.length > 0 && (running.conversation || running.reasoning) ? wakes[0].key : null;
  let newCount = 0;
  const shown: Array<{ wake: ActivityWake; steps: ActivityStep[] }> = [];
  for (const wake of wakes) {
    const steps = wake.steps.filter((step) => {
      if (filter !== "all" && step.lane !== filter) {
        return false;
      }
      if (held && !held.has(step.key)) {
        newCount += 1;
        return false;
      }
      return true;
    });
    if (steps.length > 0) {
      shown.push({ wake, steps });
    }
  }
  const visible = shown.slice(0, limit);
  const older = shown.length - visible.length;

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
              setLimit(WAKE_PAGE);
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
        {logsQuery.isSuccess && shown.length === 0 ? (
          <motion.p key="empty" {...REVEAL} className="overflow-hidden py-1 text-[13px] text-ink-muted">
            {filter === "all" ? "No recent activity." : `No recent ${LANE_LABEL[filter]}.`}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <ol className="flex flex-col">
        <AnimatePresence initial={false}>
          {visible.map(({ wake, steps }, index) => {
            const live = wake.key === liveKey;
            const open = openWakes[wake.key] ?? (index === 0 || live);
            return (
              <WakeRow
                key={wake.key}
                wake={wake}
                steps={steps}
                live={live}
                open={open}
                onToggle={() => setOpenWakes((prev) => ({ ...prev, [wake.key]: !open }))}
              />
            );
          })}
        </AnimatePresence>
      </ol>
      {older > 0 || limit > WAKE_PAGE ? (
        <div className="flex gap-3 pt-2 text-[11px] text-sage-deep">
          {older > 0 ? (
            <button type="button" onClick={() => setLimit((n) => n + WAKE_PAGE)}>
              show {Math.min(older, WAKE_PAGE)} older
            </button>
          ) : null}
          {limit > WAKE_PAGE ? (
            <button type="button" onClick={() => setLimit(WAKE_PAGE)}>
              show fewer
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
