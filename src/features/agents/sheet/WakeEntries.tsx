import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { hath } from "../../../shared/api";
import type { WakeEntry, WakeToolCall } from "../../../types/hath";
import { REVEAL } from "../../../shared/motion";
import { formatClock } from "../../../shared/lib/ux/time";
import { Icon } from "../../../shared/ui/Icon";
import { Truncate } from "../../../shared/ui/Truncate";
import { Expand, Rich } from "./Rich";
import { callTarget, prettyJson, rawContent } from "./wakes";

const MONO_TEXT = "block font-numeric text-[12px] leading-4 whitespace-pre-wrap [overflow-wrap:anywhere]";

/** Props of {@link WakeEntryList}. */
export type WakeEntryListProps = {
  /** The entries to draw, oldest first. */
  entries: WakeEntry[];
  /** The agent whose wake it is; a truncated result is fetched under its id. */
  agentId: string;
  /** An agent's display name by id; null is Ankur. */
  nameOf: (id: string | null) => string;
};

/** The entries of an open wake, oldest to newest: messages as bubbles aligned by direction, model turns as quiet blocks. */
export function WakeEntryList({ entries, agentId, nameOf }: WakeEntryListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) =>
        entry.type === "message" ? <MessageBubble key={entry.ord} entry={entry} nameOf={nameOf} /> : <TurnBlock key={entry.ord} entry={entry} agentId={agentId} />,
      )}
    </div>
  );
}

/** One message of the wake: received at the left, sent at the right, under its counterpart's name and the time. */
function MessageBubble({ entry, nameOf }: { entry: Extract<WakeEntry, { type: "message" }>; nameOf: WakeEntryListProps["nameOf"] }) {
  const [open, setOpen] = useState(false);
  const received = entry.direction === "received";
  const counterpart = nameOf(received ? entry.message.from_agent_id : entry.message.to_agent_id);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${received ? "items-start" : "items-end"}`}>
      <span className="max-w-full text-[11.5px] text-ink-muted">
        {received ? "From " : "To "}
        <span data-selectable className="font-semibold [overflow-wrap:anywhere]">{counterpart}</span>
        {` · ${formatClock(entry.at)}`}
      </span>
      <div data-selectable className={`max-w-[92%] min-w-0 rounded-[12px] border px-3 py-2 text-[13px] leading-[18px] ${received ? "border-transparent bg-sage-fill" : "border-glass-border bg-bone-raised"}`}>
        <Expand lines={5} lineHeight={18} open={open} onToggle={() => setOpen(!open)}>
          <span className="block whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.message.content}</span>
        </Expand>
      </div>
    </div>
  );
}

/** One model turn: its lane and time, what it said, its thinking behind a disclosure, and a line per tool call. */
function TurnBlock({ entry, agentId }: { entry: Extract<WakeEntry, { type: "turn" }>; agentId: string }) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const firstLine = entry.thinking?.split("\n").find((line) => line.trim() !== "") ?? "";
  return (
    <div className="flex flex-col gap-1.5 border-l border-rule pl-3">
      <span className="flex items-center gap-2 text-[11.5px] text-ink-muted">
        <span className="ui-label text-[11px]">{entry.lane === "work" ? "Work" : "Process"}</span>
        {formatClock(entry.at)}
      </span>
      {entry.text === null ? null : <Rich source={entry.text} size={13} lineHeight={19} />}
      {entry.thinking === null ? null : (
        <div className="flex flex-col gap-1">
          <button type="button" className="ui-trans flex min-w-0 items-center gap-1.5 py-1 text-left text-[12px] text-ink-muted" aria-expanded={thinkingOpen} onClick={() => setThinkingOpen(!thinkingOpen)}>
            <span className={`flex flex-none ${thinkingOpen ? "rotate-90" : ""}`}><Icon name="chevron" size={11} /></span>
            <span className="flex-none font-semibold">Thinking</span>
            {thinkingOpen ? null : <Truncate text={firstLine} className="min-w-0 flex-1 italic" />}
          </button>
          {thinkingOpen ? <span data-selectable className="block pl-4 text-[12px] leading-[17px] whitespace-pre-wrap text-ink-muted [overflow-wrap:anywhere]">{entry.thinking}</span> : null}
        </div>
      )}
      {entry.calls.map((call) => (
        <CallRow key={call.id} call={call} agentId={agentId} />
      ))}
    </div>
  );
}

/** One tool call as a line (state dot, name, target, a cut-short mark) that opens to its input and result. */
function CallRow({ call, agentId }: { call: WakeToolCall; agentId: string }) {
  const [open, setOpen] = useState(false);
  const [wantFull, setWantFull] = useState(false);
  const { result } = call;
  const full = useQuery({
    queryKey: ["agent-log", agentId, call.log_id],
    queryFn: () => hath.getLog(agentId, call.log_id!),
    enabled: wantFull && call.log_id !== null,
  });
  const target = callTarget(call.input);
  const dot = result === null ? "bg-sage dot-pulse" : result.is_error ? "bg-error" : "bg-sage";
  return (
    <div className="flex flex-col">
      <button type="button" className="ui-trans flex w-full items-center gap-2 py-1 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden className={`dot size-1.5 ${dot}`} />
        <span className={`flex-none font-numeric text-[12px] leading-[16px] ${result?.is_error ? "text-error" : "text-ink"}`}>{call.name}</span>
        <Truncate text={target} className="ui-mono min-w-0 flex-1" />
        {result === null ? <span role="status" className="flex-none text-[11px] text-sage-text">running</span> : null}
        {result?.is_error ? <span className="flex-none text-[11px] text-error">error</span> : null}
        {result?.truncated ? <span className="flex-none rounded-full border border-dashed border-sage-line px-1.5 text-[10.5px] text-ink-muted">cut</span> : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="call" {...REVEAL} className="overflow-hidden">
            <div className="my-2 ml-3 flex flex-col gap-2 border-l border-rule pl-3">
              <div className="flex flex-col gap-0.5">
                <span className="ui-label text-[11px]">Input</span>
                <span data-selectable className={MONO_TEXT}>{prettyJson(call.input)}</span>
              </div>
              {result === null ? null : (
                <div className="flex flex-col gap-0.5">
                  <span className="ui-label text-[11px]">{result.truncated ? `Result (first ${result.content.length} of ${result.chars} characters)` : "Result"}</span>
                  <span data-selectable className={`${MONO_TEXT} ${result.is_error ? "text-error" : ""}`}>{prettyJson(result.content)}</span>
                  {result.truncated && call.log_id !== null && !wantFull ? (
                    <button type="button" className="ui-trans self-start text-[12px] font-semibold text-sage-text" onClick={() => setWantFull(true)}>
                      Show full result
                    </button>
                  ) : null}
                </div>
              )}
              {wantFull ? (
                <div className="flex flex-col gap-0.5">
                  <span className="ui-label text-[11px]">Full result</span>
                  {full.error !== null ? <span data-selectable className="text-[12px] text-error">{full.error.message}</span> : null}
                  {full.data === undefined ? (full.error === null ? <span className="sk h-3 w-full" /> : null) : <span data-selectable className={MONO_TEXT}>{prettyJson(rawContent(full.data.log))}</span>}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
