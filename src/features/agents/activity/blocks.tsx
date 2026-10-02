/** Rendering for the steps of a wake in the agent popover's activity feed. */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MarkdownBody } from "../../../shared/components/Markdown";
import { LANE_LABEL } from "../../../shared/lib/ux/lanes";
import { formatToolSignature } from "../../../chrome/chatSidebar/toolStatus";
import type { ActivityStep, ActivityTool, MessageStep, Thought, TurnStep } from "./wakes";

/** A tool parameter as display text: strings as-is, anything structured as indented JSON. */
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

type ClampProps = {
  children: ReactNode;
  /** Collapsed height in em of the clamp's own font size. */
  maxEm: number;
  className?: string;
};

/**
 * Caps tall content at `maxEm`, fading its last lines, with a show all / show less
 * toggle once it overflows. Used instead of inner scroll areas so the popover keeps
 * one scroll and the wheel never gets trapped.
 */
function Clamp({ children, maxEm, className = "" }: ClampProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) {
      return;
    }
    const measure = () => {
      const limit = parseFloat(getComputedStyle(outer).fontSize) * maxEm;
      setOverflows(inner.offsetHeight > limit + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [maxEm]);

  const clamped = overflows && !open;
  return (
    <div className={className}>
      <div
        ref={outerRef}
        className={
          clamped
            ? "overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
            : undefined
        }
        style={clamped ? { maxHeight: `${maxEm}em` } : undefined}
      >
        <div ref={innerRef}>{children}</div>
      </div>
      {overflows ? (
        <button
          type="button"
          className="mt-0.5 font-sans text-[11px] not-italic text-sage-deep"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "show less" : "show all"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The thinking behind a model call as one quiet italic line, its gist; clicking it opens
 * the whole thought beneath.
 */
function ThoughtLine({ thought }: { thought: Thought }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Hide thought" : "Show thought"}
        className={`block w-full text-left text-[11px] italic leading-snug text-ink-ghost transition-colors duration-slow ease-dadi hover:text-ink-faint ${
          open ? "" : "truncate"
        }`}
      >
        {thought.gist}
      </button>
      {open ? (
        <Clamp
          maxEm={16}
          className="mt-1 mb-0.5 border-l border-rule pl-2.5 text-[11px] italic leading-snug text-ink-ghost"
        >
          <MarkdownBody content={thought.text} compact />
        </Clamp>
      ) : null}
    </div>
  );
}

/** Two-tone parameter rows: muted name chip, ink value that wraps and clamps. */
function ParamList({ input }: { input: Record<string, unknown> }) {
  const entries = Object.entries(input);
  if (entries.length === 0) {
    return <p className="text-[11px] italic text-ink-ghost">no parameters</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {entries.map(([key, value]) => (
        <li
          key={key}
          className="flex min-w-0 items-start overflow-hidden rounded-[4px] bg-rule/55"
        >
          <span className="shrink-0 bg-ink/[0.06] px-1.5 py-1 font-mono text-[10px] tracking-wide text-ink-ghost">
            {key}
          </span>
          <Clamp
            maxEm={7}
            className="min-w-0 flex-1 px-1.5 py-1 font-mono text-[11px] leading-snug whitespace-pre-wrap text-ink [overflow-wrap:anywhere]"
          >
            {prettyValue(value)}
          </Clamp>
        </li>
      ))}
    </ul>
  );
}

type ToolRowProps = {
  tool: ActivityTool;
  /** True while the tool's wake is live, so a missing result reads as running rather than lost. */
  live: boolean;
};

/**
 * A tool call as its wrapping `name(args)` signature with its status, expanding to the
 * full parameters and result.
 */
function ToolRow({ tool, live }: ToolRowProps) {
  const [open, setOpen] = useState(false);
  const result = tool.result;
  const signature = formatToolSignature(tool.name, tool.input);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-baseline gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className={`min-w-0 flex-1 font-mono text-[12px] leading-snug [overflow-wrap:anywhere] ${
            result?.isError ? "text-ink-muted line-through decoration-ink-ghost/60" : "text-ink"
          }`}
        >
          {tool.name}
          <span className="text-ink-ghost">{signature.slice(tool.name.length)}</span>
        </span>
        {result === null ? (
          live ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-sage-deep">
              <span aria-hidden className="inline-block size-1.5 animate-breath rounded-full bg-sage-deep" />
              running
            </span>
          ) : (
            <span className="shrink-0 text-[10px] text-ink-ghost">no result</span>
          )
        ) : result.isError ? (
          <span className="shrink-0 text-[10px] text-error">error</span>
        ) : null}
      </button>
      {open ? (
        <div className="mt-1.5 mb-1 flex flex-col gap-1.5 border-l border-rule pl-2.5">
          <ParamList input={tool.input} />
          {result !== null && result.content.trim() !== "" ? (
            <Clamp
              maxEm={10}
              className={`font-mono text-[11px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere] ${
                result.isError ? "text-error" : "text-ink-muted"
              }`}
            >
              {prettyResult(result.content)}
            </Clamp>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A received message as a filled bubble, a sent one as an outlined bubble, and the
 * runtime's report of a dead reasoning lane in the error tone.
 */
function MessageBubble({ step }: { step: MessageStep }) {
  const peer = step.peer ?? "you";
  const label = step.direction === "receive" ? `from ${peer}` : `to ${peer}`;
  const tone = step.laneFailure
    ? "border border-error-line bg-error-fill"
    : step.direction === "receive"
      ? "bg-sage-fill"
      : "border border-sage-line/70";
  return (
    <div className={`rounded-[8px] px-2.5 py-1.5 ${tone}`}>
      <p
        className={`mb-0.5 text-[10px] tracking-wide ${
          step.laneFailure ? "text-error" : "text-ink-ghost"
        }`}
      >
        {step.laneFailure
          ? `${LANE_LABEL.reasoning} failed · ${label}`
          : step.scheduled
            ? `scheduled · ${label}`
            : label}
      </p>
      <Clamp maxEm={4.5} className="text-[12px] leading-snug text-ink">
        <MarkdownBody content={step.content} compact />
      </Clamp>
    </div>
  );
}

/** A model call: its thought line, then what it wrote and the tools it called, in order. */
function TurnBody({ step, live }: { step: TurnStep; live: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {step.thought ? <ThoughtLine thought={step.thought} /> : null}
      {step.parts.map((part) =>
        part.kind === "text" ? (
          <Clamp key={part.key} maxEm={5} className="text-[12px] leading-snug text-ink-muted">
            <MarkdownBody content={part.text} compact />
          </Clamp>
        ) : (
          <ToolRow key={part.key} tool={part.tool} live={live} />
        ),
      )}
    </div>
  );
}

export type StepProps = {
  step: ActivityStep;
  /** True while the step's wake is live. */
  live: boolean;
};

/** One timeline entry of a wake, by kind. */
export function Step({ step, live }: StepProps) {
  return step.kind === "message" ? (
    <MessageBubble step={step} />
  ) : (
    <TurnBody step={step} live={live} />
  );
}
