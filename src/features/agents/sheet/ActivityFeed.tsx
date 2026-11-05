import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Lane } from "../../../types/hath";
import { FADE, REVEAL, RISE } from "../../../shared/motion";
import { Button } from "../../../shared/ui/Button";
import { Segmented } from "../../../shared/ui/Segmented";
import { Truncate } from "../../../shared/ui/Truncate";
import { formatToolSignature } from "../../../shared/lib/content/toolSignature";
import { LANE_LABEL } from "../../../shared/lib/ux/lanes";
import { countNoun } from "../../../shared/lib/ux/plural";
import { formatRelative, formatSpan } from "../../../shared/lib/ux/time";
import type { ActivityStep, ActivityTool, ActivityWake, MessageStep, TurnStep } from "./activity";
import { Expand, Rich } from "./Rich";
import { feedKeys, foldedCount, hiddenWakes, lastReadingRow, laneFilterOf, shownWakes, STEP_HEAD, STEP_TAIL, WAKE_PAGE, wakeTitle, type LaneFilter } from "./feed";

/** The lane filter's choices, by the word on its control. */
const FILTERS: ReadonlyArray<readonly [word: string, filter: LaneFilter]> = [
  ["All", "all"],
  ["Processing", "process"],
  ["Working", "work"],
];

/** A lane's mark on the rail: a filled dot for processing, a ring for working. */
function LaneDot({ lane, className = "" }: { lane: Lane; className?: string }) {
  return <span className={`dot size-[7px] ${lane === "process" ? "bg-sage" : "bg-bone shadow-[inset_0_0_0_1px_rgba(92,107,82,0.6)]"} ${className}`} />;
}

/** A tool parameter as display text: strings as-is, anything structured as indented JSON. */
function prettyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value, null, 2);
}

/** A tool result indented for reading when it is JSON; any other text as logged. */
function prettyResult(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return content;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return content;
  }
}

/** What the feed holds open: the controls a person has used, kept by the key of the thing they opened. */
type OpenState = { wakes: Record<string, boolean>; unfolded: Set<string>; tools: Set<string>; thoughts: Set<string>; expanded: Set<string> };

/** `set` with `key` added, or removed when it is in. */
function flipped(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}

const MONO_TEXT = "block font-numeric text-[12px] leading-4 whitespace-pre-wrap [overflow-wrap:anywhere]";

type ToolRowProps = {
  tool: ActivityTool;
  partKey: string;
  /** True while the tool's wake is live, so a missing result reads as running rather than lost. */
  live: boolean;
  /** When the model call that made the tool call was logged; a running tool counts from here. */
  calledAt: string;
  open: OpenState;
  flip: (kind: keyof Omit<OpenState, "wakes">, key: string) => void;
};

/** A tool call as its wrapping `name(args)` signature with its status, expanding to the parameters and the result. */
function ToolRow({ tool, partKey, live, calledAt, open, flip }: ToolRowProps) {
  const result = tool.result;
  const signature = formatToolSignature(tool.name, tool.input);
  const running = result === null && live;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const isOpen = open.tools.has(partKey);
  const params = Object.entries(tool.input);
  return (
    <div className={`flex flex-col ${running ? "-mx-2 rounded-[6px] bg-sage-active px-2 py-1" : ""}`}>
      <button type="button" className="ui-trans flex w-full items-baseline gap-2 text-left" aria-expanded={isOpen} onClick={() => flip("tools", partKey)}>
        <span className={`min-w-0 flex-1 font-numeric text-[12px] leading-[16px] [overflow-wrap:anywhere] ${result?.isError ? "text-ink-muted line-through" : "text-ink"}`}>
          {tool.name}
          <span className="text-ink-muted">{signature.slice(tool.name.length)}</span>
        </span>
        {result === null ? (
          <span role={running ? "status" : undefined} className={`flex-none text-[11px] tabular-nums ${running ? "text-sage-text" : "text-ink-muted"}`}>
            {running ? `running · ${formatSpan(Math.max(0, now - Date.parse(calledAt)))}` : "no result"}
          </span>
        ) : result.isError ? (
          <span className="flex-none text-[11px] text-error">error</span>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div key="tool" {...REVEAL} className="overflow-hidden">
            <div className="my-2 flex flex-col gap-2 border-l border-rule pl-3">
              {params.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {params.map(([name, value]) => {
                    const key = `${partKey}:${name}`;
                    return (
                      <div key={name} className="flex items-start overflow-hidden rounded-[6px] bg-[rgba(250,250,247,0.7)]">
                        <span className="flex-none bg-[rgba(44,48,42,0.06)] px-2 py-1 font-numeric text-[11px] leading-4 text-ink-muted">{name}</span>
                        <div className="min-w-0 flex-1 px-2 py-1 text-ink">
                          <Expand lines={5} lineHeight={16} open={open.expanded.has(key)} onToggle={() => flip("expanded", key)}>
                            <span data-selectable className={MONO_TEXT}>
                              {prettyValue(value)}
                            </span>
                          </Expand>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[12px] text-ink-muted italic">no parameters</span>
              )}
              {result !== null && result.content.trim() !== "" ? (
                <Expand lines={8} lineHeight={16} open={open.expanded.has(`${partKey}:result`)} onToggle={() => flip("expanded", `${partKey}:result`)}>
                  <span data-selectable className={`${MONO_TEXT} ${result.isError ? "text-error" : "text-ink-muted"}`}>
                    {prettyResult(result.content)}
                  </span>
                </Expand>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type StepViewProps = {
  step: ActivityStep;
  live: boolean;
  open: OpenState;
  flip: ToolRowProps["flip"];
};

/** A received message as a light bubble, a sent one as an outlined bubble, and the runtime's report of a stopped wake in the error tone. */
function Bubble({ step, open, flip }: { step: MessageStep; open: OpenState; flip: ToolRowProps["flip"] }) {
  const peer = step.peer ?? "you";
  const word = step.direction === "receive" ? `from ${peer}` : `to ${peer}`;
  const tone = step.wakeStopped ? "border-error-line bg-error-fill" : step.direction === "receive" ? "border-transparent bg-[rgba(250,250,247,0.8)]" : "border-sage-line";
  return (
    <div className={`flex flex-col gap-1 rounded-[10px] border px-3 py-2 ${tone}`}>
      <span className={`text-[11px] font-medium ${step.wakeStopped ? "text-error" : "text-ink-muted"}`}>{step.wakeStopped ? `wake stopped · ${word}` : step.scheduled ? `scheduled · ${word}` : word}</span>
      <Expand lines={4} lineHeight={18} open={open.expanded.has(step.key)} onToggle={() => flip("expanded", step.key)}>
        <Rich source={step.content} />
      </Expand>
    </div>
  );
}

/** A model call: its thought line, then what it wrote and the tools it called, in order. */
function Turn({ step, live, open, flip }: { step: TurnStep } & Omit<StepViewProps, "step">) {
  const thought = step.thought;
  const thoughtOpen = thought !== null && open.thoughts.has(step.key);
  return (
    <div className="flex flex-col gap-1">
      {thought === null ? null : (
        <div className="flex flex-col">
          <button
            type="button"
            className={`ui-trans block w-full text-left text-[12px] leading-[16px] text-ink-muted italic ${thoughtOpen ? "" : "truncate"}`}
            aria-expanded={thoughtOpen}
            title={thoughtOpen ? "Hide thought" : "Show thought"}
            onClick={() => flip("thoughts", step.key)}
          >
            {thought.gist}
          </button>
          <AnimatePresence initial={false}>
            {thoughtOpen ? (
              <motion.div key="thought" {...REVEAL} className="overflow-hidden">
                <div className="my-1 border-l border-rule pl-3 italic">
                  <Expand lines={12} lineHeight={16} open={open.expanded.has(`${step.key}:thought`)} onToggle={() => flip("expanded", `${step.key}:thought`)}>
                    <Rich source={thought.text} lineHeight={16} color="var(--ink-muted)" />
                  </Expand>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
      {step.parts.map((part) =>
        part.kind === "text" ? (
          <Expand key={part.key} lines={4} lineHeight={18} open={open.expanded.has(part.key)} onToggle={() => flip("expanded", part.key)}>
            <Rich source={part.text} color="var(--ink-muted)" />
          </Expand>
        ) : (
          <ToolRow key={part.key} tool={part.tool} partKey={part.key} live={live} calledAt={step.at} open={open} flip={flip} />
        ),
      )}
    </div>
  );
}

/** The wake's opening step as one line for its closed card. */
function preview(step: ActivityStep): { mono: boolean; text: string } {
  if (step.kind === "message") {
    return { mono: false, text: step.content.replace(/\s*\n+\s*/g, " ") };
  }
  const part = step.parts[0]!;
  return part.kind === "text"
    ? { mono: false, text: part.text.replace(/\s*\n+\s*/g, " ").replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1") }
    : { mono: true, text: formatToolSignature(part.tool.name, part.tool.input) };
}

type WakeCardProps = {
  wake: ActivityWake;
  /** The steps shown, after the lane filter. */
  steps: ActivityStep[];
  live: boolean;
  open: OpenState;
  isOpen: boolean;
  onToggle: () => void;
  flip: ToolRowProps["flip"];
  now: number;
};

/** One wake as a card: what set it off, its lanes, tool calls and span; open, its steps run oldest first down a rail with the middle of a long wake folded. */
function WakeCard({ wake, steps, live, open, isOpen, onToggle, flip, now }: WakeCardProps) {
  const folded = open.unfolded.has(wake.key) ? 0 : foldedCount(steps.length);
  const rows: Array<ActivityStep | "fold"> = folded > 0 ? [...steps.slice(0, STEP_HEAD), "fold", ...steps.slice(-STEP_TAIL)] : steps;
  const span = Date.parse(wake.at) - Date.parse(wake.startedAt);
  const meta = [wake.toolCount > 0 ? `${wake.toolCount} ${countNoun(wake.toolCount, "tool call")}` : null, span >= 1000 ? formatSpan(span) : null].filter((part) => part !== null);
  const line = isOpen ? null : preview(steps[0]!);
  return (
    <div className="flex flex-col rounded-[12px] bg-sage-fill px-3 py-3">
      <button type="button" className="ui-trans flex w-full flex-col gap-1 text-left" aria-expanded={isOpen} onClick={onToggle}>
        <div className="flex w-full items-center gap-2">
          <span className="flex flex-none gap-1">
            {wake.lanes.map((lane) => (
              <LaneDot key={lane} lane={lane} />
            ))}
          </span>
          <Truncate text={wakeTitle(wake)} className="min-w-0 flex-1 text-[13px] font-semibold" />
          <span className={`flex-none text-[12px] ${live ? "text-sage-text" : "text-ink-muted"}`}>{live ? "now" : formatRelative(wake.at, now)}</span>
        </div>
        {meta.length > 0 || wake.errorCount > 0 ? (
          <span className="text-[12px] text-ink-muted tabular-nums">
            {meta.join(" · ")}
            {wake.errorCount > 0 ? <span className="text-error">{`${meta.length > 0 ? " · " : ""}${wake.errorCount} failed`}</span> : null}
          </span>
        ) : null}
      </button>
      {line === null ? null : <Truncate text={line.text} className={`mt-1 text-[12px] text-ink-muted ${line.mono ? "font-numeric" : ""}`} />}
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div key="steps" {...REVEAL} className="overflow-hidden">
            <ol className="relative m-0 mt-2 list-none p-0">
              <div className="absolute top-2 bottom-3 left-[3px] border-l border-rule" />
              {rows.map((row, index) => {
                if (row === "fold") {
                  return (
                    <li key="fold">
                      <div className="relative pt-2 pl-4">
                        <span className="absolute top-3 left-px size-[5px] rounded-full bg-rule" />
                        <button type="button" className="ui-trans text-[12px] font-semibold text-sage-text" onClick={() => flip("unfolded", wake.key)}>
                          {`Show ${folded} earlier ${countNoun(folded, "step")}`}
                        </button>
                      </div>
                    </li>
                  );
                }
                const previous = rows[index - 1];
                return (
                  <li key={row.key}>
                    <div className="relative pt-2 pl-4">
                      <LaneDot lane={row.lane} className="absolute top-3 left-0" />
                      {previous === undefined || previous === "fold" || previous.lane !== row.lane ? <span className="mb-1 block text-[11px] font-medium text-ink-muted">{LANE_LABEL[row.lane]}</span> : null}
                      {row.kind === "message" ? <Bubble step={row} open={open} flip={flip} /> : <Turn step={row} live={live} open={open} flip={flip} />}
                    </div>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export type ActivityFeedProps = {
  /** The agent's wakes, newest first. */
  wakes: ActivityWake[];
  /** Which of the agent's lanes are running now; marks the newest wake live. */
  running: Record<Lane, boolean>;
  /** The sheet's scroll area: while it is scrolled past the feed's top, the row being read holds still as steps land above it. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The time the card's relative words are measured from. */
  now: number;
};

/**
 * The agent's wakes as cards under a lane filter: the newest opens when it first appears, steps ease in as logs land, and the paging shows five
 * more wakes at a time. While the reader is scrolled into the feed, the row they are on holds still and an "up N new" button counts what arrived.
 */
export function ActivityFeed({ wakes, running, scrollRef, now }: ActivityFeedProps) {
  const [filter, setFilter] = useState<LaneFilter>("all");
  const [limit, setLimit] = useState(WAKE_PAGE);
  const [open, setOpen] = useState<OpenState>({ wakes: {}, unfolded: new Set(), tools: new Set(), thoughts: new Set(), expanded: new Set() });
  const newest = wakes[0]?.key;
  if (newest !== undefined && open.wakes[newest] === undefined) {
    setOpen({ ...open, wakes: { ...open.wakes, [newest]: true } });
  }
  const flip: ToolRowProps["flip"] = (kind, key) => setOpen((current) => ({ ...current, [kind]: flipped(current[kind], key) }));

  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [away, setAway] = useState(false);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  if (away && seen === null) {
    setSeen(feedKeys(wakes));
  }
  if (!away && seen !== null) {
    setSeen(null);
  }

  useLayoutEffect(() => {
    const root = scrollRef.current;
    const header = headerRef.current;
    const list = listRef.current;
    if (root === null || header === null || list === null) {
      return undefined;
    }
    let anchor: { row: Element; top: number } | null = null;
    const pick = () => {
      const line = header.getBoundingClientRect().bottom;
      anchor = header.getBoundingClientRect().top < root.getBoundingClientRect().top ? lastReadingRow(list, line) : null;
    };
    const hold = () => {
      if (anchor !== null && anchor.row.isConnected) {
        const drift = anchor.row.getBoundingClientRect().top - anchor.top;
        if (drift !== 0) {
          root.scrollTop += drift;
        }
      }
      pick();
    };
    pick();
    root.addEventListener("scroll", pick, { passive: true });
    const observer = new ResizeObserver(hold);
    observer.observe(list);
    return () => {
      root.removeEventListener("scroll", pick);
      observer.disconnect();
    };
  }, [scrollRef]);

  useEffect(() => {
    const root = scrollRef.current;
    const header = headerRef.current;
    if (root === null || header === null) {
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setAway(entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < root.getBoundingClientRect().top), { root });
    observer.observe(header);
    return () => observer.disconnect();
  }, [scrollRef]);

  const shown = useMemo(() => shownWakes(wakes, filter), [wakes, filter]);
  const visible = shown.slice(0, limit);
  const older = hiddenWakes(shown.length, limit);
  const liveKey = wakes.length > 0 && (running.process || running.work) ? wakes[0]!.key : null;
  const newCount = seen === null ? 0 : shown.reduce((count, { steps }) => count + steps.filter((step) => !seen.has(step.key)).length, 0);
  return (
    <div className="flex flex-col gap-3">
      <div ref={headerRef} className="flex items-center gap-2">
        <Segmented
          options={FILTERS.map(([word]) => word)}
          value={FILTERS.find(([, value]) => value === filter)![0]}
          onChange={(word) => {
            setFilter(laneFilterOf(word));
            setLimit(WAKE_PAGE);
          }}
        />
        <AnimatePresence initial={false}>
          {newCount > 0 ? (
            <motion.span key="new" {...FADE} className="ml-auto">
              <Button tone="sage" size="sm" pill onClick={() => headerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })}>
                {`↑ ${newCount} new`}
              </Button>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {shown.length === 0 ? (
          <motion.span key="none" {...RISE} className="text-[13px] text-ink-muted">
            {filter === "all" ? "No recent activity." : `No recent ${LANE_LABEL[filter]}.`}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <ol ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0">
        <AnimatePresence initial={false}>
          {visible.map(({ wake, steps }, index) => (
            <motion.li key={wake.key} {...FADE} layout="position">
              <WakeCard wake={wake} steps={steps} live={wake.key === liveKey} open={open} isOpen={open.wakes[wake.key] ?? index === 0} onToggle={() => setOpen({ ...open, wakes: { ...open.wakes, [wake.key]: !(open.wakes[wake.key] ?? index === 0) } })} flip={flip} now={now} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <AnimatePresence initial={false}>
        {older > 0 || limit > WAKE_PAGE ? (
          <motion.div key="paging" {...REVEAL} className="overflow-hidden">
            <div className="flex items-center gap-2">
              {older > 0 ? (
                <Button tone="sage" size="sm" onClick={() => setLimit(limit + WAKE_PAGE)}>
                  {`Show ${Math.min(older, WAKE_PAGE)} older`}
                </Button>
              ) : null}
              {limit > WAKE_PAGE ? (
                <Button tone="quiet" size="sm" onClick={() => setLimit(WAKE_PAGE)}>
                  Show fewer
                </Button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
