import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { REVEAL } from "../../../shared/motion";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { formatToolSignature } from "../../../shared/lib/content/toolSignature";
import { formatClock, formatDay } from "../../../shared/lib/ux/time";
import { NEAR_BOTTOM_PX } from "../../chat/constants";
import type { MessageStep } from "./activity";
import { Expand, Rich } from "./Rich";
import type { ThreadEntry, ThreadItem } from "./laneThread";

const MONO_TEXT = "block font-numeric text-[12px] leading-4 whitespace-pre-wrap [overflow-wrap:anywhere]";

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

/** The "Show all" state of the cut texts of one row, by the name of the text. */
function useExpanded(): [(name: string) => boolean, (name: string) => void] {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(name)) {
        next.add(name);
      }
      return next;
    });
  return [(name) => expanded.has(name), toggle];
}

/** A tool call as one compact row, expanding to its parameters and result. */
function ToolRow({ tool, running }: { tool: Extract<ThreadEntry, { kind: "tool" }>["tool"]; running: boolean }) {
  const [open, setOpen] = useState(false);
  const [isExpanded, toggleExpanded] = useExpanded();
  const result = tool.result;
  const signature = formatToolSignature(tool.name, tool.input);
  const params = Object.entries(tool.input);
  return (
    <div className="flex flex-col">
      <button type="button" className="ui-trans flex w-full items-baseline gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex translate-y-[2px] flex-none text-ink-muted"><Icon name="chevron" size={11} /></span>
        <span className={`min-w-0 flex-1 font-numeric text-[12px] leading-[16px] [overflow-wrap:anywhere] ${result?.isError ? "text-ink-muted line-through" : "text-ink"}`}>
          {tool.name}
          <span className="text-ink-muted">{signature.slice(tool.name.length)}</span>
        </span>
        {result === null ? (
          <span role={running ? "status" : undefined} className={`flex-none text-[11px] ${running ? "text-sage-text" : "text-ink-muted"}`}>
            {running ? "running" : "no result"}
          </span>
        ) : result.isError ? (
          <span className="flex-none text-[11px] text-error">error</span>
        ) : (
          <span className="flex-none text-[11px] text-ink-muted">ok</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="tool" {...REVEAL} className="overflow-hidden">
            <div className="my-2 ml-4 flex flex-col gap-2 border-l border-rule pl-3">
              {params.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {params.map(([name, value]) => (
                    <div key={name} className="flex items-start overflow-hidden rounded-[6px] bg-[var(--bone-70)]">
                      <span className="flex-none bg-[rgba(44,48,42,0.06)] px-2 py-1 font-numeric text-[11px] leading-4 text-ink-muted">{name}</span>
                      <div className="min-w-0 flex-1 px-2 py-1 text-ink">
                        <Expand lines={5} lineHeight={16} open={isExpanded(name)} onToggle={() => toggleExpanded(name)}>
                          <span data-selectable className={MONO_TEXT}>{prettyValue(value)}</span>
                        </Expand>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[12px] text-ink-muted italic">no parameters</span>
              )}
              {result !== null && result.content.trim() !== "" ? (
                <Expand lines={8} lineHeight={16} open={isExpanded("result")} onToggle={() => toggleExpanded("result")}>
                  <span data-selectable className={`${MONO_TEXT} ${result.isError ? "text-error" : "text-ink-muted"}`}>{prettyResult(result.content)}</span>
                </Expand>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** A message as a small bubble: Ankur's side on the right, an agent's on the left, with the time. */
function Bubble({ step }: { step: MessageStep }) {
  const [isExpanded, toggleExpanded] = useExpanded();
  const ankur = step.peer === null;
  const word = step.direction === "receive" ? `from ${step.peer ?? "Ankur"}` : `to ${step.peer ?? "Ankur"}`;
  return (
    <div className={`flex ${ankur ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[88%] flex-col gap-1 rounded-[12px] px-3 py-2 ${ankur ? "bg-sage-fill" : "border border-rule"}`}>
        <Expand lines={6} lineHeight={18} open={isExpanded("body")} onToggle={() => toggleExpanded("body")}>
          <Rich source={step.content} />
        </Expand>
        <span className="text-[11px] text-ink-muted">{`${step.scheduled ? "scheduled · " : ""}${word} · ${formatClock(step.at)}`}</span>
      </div>
    </div>
  );
}

/** One row of the thread. */
function ItemView({ item, running }: { item: ThreadItem; running: boolean }) {
  switch (item.kind) {
    case "thought":
      return <p data-selectable className="m-0 text-[13px] leading-5 whitespace-pre-wrap text-ink-muted [overflow-wrap:anywhere]">{item.text}</p>;
    case "tool":
      return <ToolRow tool={item.tool} running={running} />;
    case "message":
      return <Bubble step={item.step} />;
    case "notice":
      return <p data-selectable className="m-0 text-center text-[12px] text-ink-muted">{item.step.content}</p>;
    case "separator":
      return <p className="m-0 text-center text-[11px] text-ink-muted">{item.day ? `${formatDay(item.at)} · ${formatClock(item.at)}` : formatClock(item.at)}</p>;
  }
}

/** Props of {@link Thread}. */
export type ThreadProps = {
  /** The lane's rows, oldest first, with their separators. */
  items: ThreadItem[];
  /** Whether the lane is running, so its last tool without a result reads as running. */
  live: boolean;
  /** What the thread says when it has no rows. */
  empty: string;
  /** Whether earlier wakes can still be asked for. */
  canLoadEarlier: boolean;
  /** Asks for more wakes. */
  onLoadEarlier: () => void;
};

/**
 * One lane as a single thread, oldest at the top: it opens scrolled to the bottom and keeps there as rows arrive unless the
 * person scrolled up, and rows loaded above hold the reader's place.
 */
export function Thread({ items, live, empty, canLoadEarlier, onLoadEarlier }: ThreadProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const loadedFrom = useRef<number | null>(null);
  const lastTool = [...items].reverse().find((item) => item.kind === "tool")?.key;

  useLayoutEffect(() => {
    const node = scroll.current;
    if (node === null) {
      return;
    }
    if (loadedFrom.current !== null) {
      node.scrollTop += node.scrollHeight - loadedFrom.current;
      loadedFrom.current = null;
    } else if (stick.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [items]);

  const onScroll = () => {
    const node = scroll.current;
    if (node !== null) {
      stick.current = node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM_PX;
    }
  };
  const loadEarlier = () => {
    loadedFrom.current = scroll.current?.scrollHeight ?? null;
    onLoadEarlier();
  };

  return (
    <div ref={scroll} className="scroll flex min-h-0 flex-1 flex-col gap-3 px-5 pt-3 pb-5" onScroll={onScroll}>
      {canLoadEarlier ? (
        <div className="flex justify-center">
          <Button tone="quiet" size="sm" onClick={loadEarlier}>
            Load earlier
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? <span className="text-[13px] text-ink-muted">{empty}</span> : null}
      {items.map((item) => (
        <ItemView key={item.key} item={item} running={live && item.key === lastTool} />
      ))}
    </div>
  );
}
