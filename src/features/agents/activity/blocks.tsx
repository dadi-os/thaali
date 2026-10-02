/** Rendering for the blocks of one model turn in the agent popover's activity feed. */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { InlineMarkdown, MarkdownBody } from "../../../shared/components/Markdown";
import { formatToolSignature } from "../../../chrome/chatSidebar/toolStatus";
import type { ActivityBlock } from "./runs";

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

/** Model thinking: a muted one-line preview, expanding to the full thought. */
function ThoughtBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-baseline gap-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="shrink-0 text-[10px] tracking-wide text-ink-ghost">
          {open ? "▾" : "▸"} thought
        </span>
        {open ? null : (
          <span className="min-w-0 flex-1 truncate text-[11px] italic leading-snug text-ink-ghost">
            <InlineMarkdown content={text} />
          </span>
        )}
      </button>
      {open ? (
        <Clamp
          maxEm={14}
          className="mt-1 border-l border-rule pl-2.5 text-[11px] italic leading-snug text-ink-ghost"
        >
          <MarkdownBody content={text} compact />
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

type ToolBlockProps = {
  block: Extract<ActivityBlock, { kind: "tool" }>;
  /** True while this tool's run is live, so a missing result reads as running rather than lost. */
  live: boolean;
};

/**
 * A tool call as its wrapping `name(args)` signature with its status, expanding to the
 * full parameters and result.
 */
function ToolBlock({ block, live }: ToolBlockProps) {
  const [open, setOpen] = useState(false);
  const result = block.result;
  const signature = formatToolSignature(block.name, block.input);
  const showResult =
    result !== null &&
    result.content.trim() !== "" &&
    !(block.name === "yield" && !result.isError && isRedundantYieldResult(result.content));

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
          {block.name}
          <span className="text-ink-ghost">{signature.slice(block.name.length)}</span>
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
        <div className="mt-1.5 flex flex-col gap-1.5 border-l border-rule pl-2.5">
          <ParamList input={block.input} />
          {showResult ? (
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

export type TurnBlockProps = {
  block: ActivityBlock;
  /** True while the block's run is live. */
  live: boolean;
};

/** Render one block of a model turn by kind. */
export function TurnBlock({ block, live }: TurnBlockProps) {
  switch (block.kind) {
    case "thinking":
      return <ThoughtBlock text={block.text} />;
    case "redacted":
      return <p className="text-[10px] tracking-wide text-ink-ghost">▸ thought · redacted</p>;
    case "text":
      return (
        <Clamp maxEm={5} className="text-[12px] leading-snug text-ink-muted">
          <MarkdownBody content={block.text} compact />
        </Clamp>
      );
    case "tool":
      return <ToolBlock block={block} live={live} />;
  }
}
