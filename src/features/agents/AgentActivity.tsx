import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Lane, LogRecord } from "../../shared/api/types";
import { Tooltip } from "../../shared/components/Tooltip";
import { REVEAL } from "../../shared/lib/ux/motion";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { buildActivity, type ActivityBlock, type ActivityTurn } from "./activity";

export type AgentActivityProps = {
  /** The agent's recent logs, newest first; the popover owns and polls this query. */
  logs: UseQueryResult<LogRecord[], Error>;
};

function truncate(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) {
    return one;
  }
  return `${one.slice(0, max - 1)}…`;
}

function prettyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Yield's tool_result is just `{"yielded":true}` — redundant next to the
 * tool name. Hide empty / trivial success payloads for yield only.
 */
function isRedundantYieldResult(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return true;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 1 &&
      (parsed as { yielded?: unknown }).yielded === true
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function LaneMark({ lane }: { lane: Lane }) {
  const label = lane === "reasoning" ? "Reasoning" : "Conversation";
  const fill = lane === "reasoning" ? "bg-sage/40" : "bg-sage";
  return (
    <span
      aria-label={label}
      title={label}
      className={`mt-[5px] inline-block size-1.5 shrink-0 rounded-full ${fill}`}
    />
  );
}

/** Model thinking: one muted italic line, expanding to the full reasoning. */
function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-start gap-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="shrink-0 text-[10px] tracking-wide text-ink-ghost">
          {open ? "▾" : "▸"} thinking
        </span>
        {open ? null : (
          <span className="min-w-0 flex-1 truncate text-[11px] italic leading-snug text-ink-ghost">
            {truncate(text, 80)}
          </span>
        )}
      </button>
      {open ? (
        <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words border-l border-rule pl-2 text-[11px] italic leading-snug text-ink-ghost">
          {text}
        </p>
      ) : null}
    </div>
  );
}

/** What the model wrote alongside (or instead of) its tool calls. */
function TextBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const expandable = text.length > 90 || text.includes("\n");
  return (
    <button
      type="button"
      className="block w-full text-left"
      onClick={() => {
        if (expandable) {
          setOpen((v) => !v);
        }
      }}
    >
      <p
        className={`text-[12px] leading-snug text-ink-muted ${
          open ? "whitespace-pre-wrap break-words" : "truncate"
        }`}
      >
        {open ? text : truncate(text, 90)}
      </p>
    </button>
  );
}

/** A tool call: name with running/error status, expanding to its input and result. */
function ToolBlock({ block }: { block: Extract<ActivityBlock, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const hasParams = Object.keys(block.input).length > 0;
  const result = block.result;
  const showResult =
    result !== null &&
    !(block.name === "yield" && !result.isError && isRedundantYieldResult(result.content));
  const status =
    result === null ? "running" : result.isError ? "error" : null;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-baseline gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className={`min-w-0 flex-1 truncate font-mono text-[12px] leading-snug ${
            result?.isError ? "text-ink-muted line-through decoration-ink-ghost/60" : "text-ink"
          }`}
        >
          {block.name}
        </span>
        {status ? (
          <span className="shrink-0 text-[10px] text-ink-ghost">{status}</span>
        ) : null}
      </button>
      {open ? (
        <div className="mt-1">
          {hasParams ? <ParamList input={block.input} /> : null}
          {showResult && result.content ? (
            <p
              className={`mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-snug ${
                result.isError ? "text-ink-muted" : "text-ink-ghost"
              }`}
            >
              {result.content}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Render one block of a model turn by kind. */
function TurnBlock({ block }: { block: ActivityBlock }) {
  switch (block.kind) {
    case "thinking":
      return <ThinkingBlock text={block.text} />;
    case "redacted":
      return (
        <p className="text-[10px] tracking-wide text-ink-ghost">▸ thinking (redacted)</p>
      );
    case "text":
      return <TextBlock text={block.text} />;
    case "tool":
      return <ToolBlock block={block} />;
  }
}

/**
 * One model call: lane, time, then its thinking, text and tool calls in order. The row,
 * and each block that arrives while the turn is still streaming, eases open.
 */
function TurnRow({ turn }: { turn: ActivityTurn }) {
  return (
    <motion.li {...REVEAL} className="overflow-hidden">
      <div className="flex items-start gap-2 pb-2.5">
        <LaneMark lane={turn.lane} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence initial={false}>
            {turn.blocks.map((block) => (
              <motion.div key={block.key} {...REVEAL} className="overflow-hidden">
                <div className="pb-1">
                  <TurnBlock block={block} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <Tooltip content={formatAbsolute(turn.at)}>
          <span className="shrink-0 pt-px text-[10px] text-ink-ghost">
            {formatRelative(turn.at)}
          </span>
        </Tooltip>
      </div>
    </motion.li>
  );
}

/** Two-tone parameter rows: muted name chip, ink value. */
function ParamList({ input }: { input: Record<string, unknown> }) {
  const entries = Object.entries(input);
  if (entries.length === 0) {
    return (
      <p className="mt-1 text-[11px] italic text-ink-ghost">no parameters</p>
    );
  }
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {entries.map(([key, value]) => {
        const rendered = prettyValue(value);
        const multiline = rendered.includes("\n") || rendered.length > 72;
        return (
          <li
            key={key}
            className="flex min-w-0 items-start gap-0 overflow-hidden rounded-[4px] bg-rule/55"
          >
            <span className="shrink-0 bg-ink/[0.06] px-1.5 py-1 font-mono text-[10px] tracking-wide text-ink-ghost">
              {key}
            </span>
            <span
              className={`min-w-0 flex-1 px-1.5 py-1 font-mono text-[11px] leading-snug text-ink ${
                multiline
                  ? "max-h-24 overflow-y-auto whitespace-pre-wrap break-words"
                  : "truncate"
              }`}
              title={rendered}
            >
              {rendered}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Recent agent lane activity from durable logs, one entry per model call:
 * its thinking (collapsed), what it wrote, and each tool call with its result.
 * This is the log explorer slice for one agent, not the chat transcript. Rows that
 * arrive by polling, and the first load, ease in; cached rows show at once.
 */
export function AgentActivity({ logs: logsQuery }: AgentActivityProps) {
  const turns = useMemo(
    () => (logsQuery.data ? buildActivity(logsQuery.data) : []),
    [logsQuery.data],
  );
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? turns : turns.slice(0, 6);
  const hidden = turns.length - visible.length;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-[2px] text-ink-faint">
          ACTIVITY
        </h3>
        <p className="flex items-center gap-2 text-[10px] text-ink-ghost">
          <span className="inline-flex items-center gap-1" title="Reasoning">
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-sage/40" />
            work
          </span>
          <span className="inline-flex items-center gap-1" title="Conversation">
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-sage" />
            talk
          </span>
        </p>
      </div>

      <AnimatePresence initial={false}>
        {logsQuery.isLoading ? (
          <motion.div key="loading" {...REVEAL} className="overflow-hidden">
            <div aria-label="Loading activity" className="flex flex-col gap-2 pb-2">
              <span className="h-2.5 w-3/4 animate-pulse rounded-full bg-rule/50" />
              <span className="h-2.5 w-1/2 animate-pulse rounded-full bg-rule/50" />
            </div>
          </motion.div>
        ) : null}
        {logsQuery.isError ? (
          <motion.p key="error" {...REVEAL} className="overflow-hidden text-[13px] text-ink-muted">
            Could not load activity.
          </motion.p>
        ) : null}
        {logsQuery.isSuccess && turns.length === 0 ? (
          <motion.p key="empty" {...REVEAL} className="overflow-hidden text-[13px] text-ink-muted">
            No recent activity.
          </motion.p>
        ) : null}
      </AnimatePresence>

      <ol className="flex flex-col">
        <AnimatePresence initial={false}>
          {visible.map((turn) => (
            <TurnRow key={turn.key} turn={turn} />
          ))}
        </AnimatePresence>
      </ol>
      {hidden > 0 ? (
        <button
          type="button"
          className="mt-1 text-[11px] text-sage-deep"
          onClick={() => setShowAll(true)}
        >
          {hidden} more
        </button>
      ) : null}
    </section>
  );
}
