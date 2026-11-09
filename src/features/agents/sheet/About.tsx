import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AgentRecord } from "../../../types/hath";
import { KeyValue, SectionHeader } from "../../../shared/components/Module";
import { RISE } from "../../../shared/motion";
import { formatDay, formatRelative } from "../../../shared/lib/ux/time";
import { Disclosure } from "../../../shared/ui/Disclosure";
import { Clamp } from "../../../shared/ui/Truncate";
import { compact } from "./wakes";

/** Characters per token Hath measured for the model's text; a charter's size in tokens is its characters over this. */
const CHARS_PER_TOKEN = 2.37;

/** A markdown charter as the sheet draws it: `##` headings, `-` bullets and paragraphs, with nothing else interpreted. */
function CharterText({ source }: { source: string }) {
  return (
    <div data-selectable className="flex flex-col gap-0.5">
      {source.split("\n").flatMap((line, index) => {
        if (line.startsWith("## ")) {
          return [
            <span key={index} className="mt-3 mb-1 block text-[13px] font-semibold">
              {line.slice(3)}
            </span>,
          ];
        }
        if (line.startsWith("- ")) {
          return [
            <div key={index} className="flex items-start gap-2 text-[13px] leading-[20px] text-ink">
              <span className="dot mt-2 size-1 bg-sage" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{line.slice(2)}</span>
            </div>,
          ];
        }
        return line.trim() === "" ? [] : [<span key={index} className="block text-[13px] leading-[20px] [overflow-wrap:anywhere] text-ink">{line}</span>];
      })}
    </div>
  );
}

/** Props of {@link About}. */
export type AboutProps = {
  agent: AgentRecord;
  /** The agent's parent when it is one of the agents on the page; its name is a link. */
  parent: AgentRecord | null;
  /** Selects the parent agent. */
  onSelectParent: (id: string) => void;
  /** The time the relative words are measured from. */
  now: number;
};

/** What the agent is: its parent, when it was made and last active, its current step, the messages queued to send, and its charter behind a disclosure. */
export function About({ agent, parent, onSelectParent, now }: AboutProps) {
  const [charterOpen, setCharterOpen] = useState(false);
  const pending = agent.running.status?.pending ?? [];
  const step = agent.running.status?.step ?? null;
  const who = (id: string | null) => (id === null ? "Ankur" : id);
  return (
    <div className="flex flex-col">
      <SectionHeader title="About" />
      <KeyValue label="Parent">
        {agent.parent_agent_id === null ? (
          "None"
        ) : parent === null ? (
          agent.parent_agent_id
        ) : (
          <button type="button" className="ui-trans font-semibold text-sage-text hover:underline" title={`Show ${parent.name}`} onClick={() => onSelectParent(parent.id)}>
            {parent.name}
          </button>
        )}
      </KeyValue>
      <KeyValue label="Created">{formatDay(agent.created_at)}</KeyValue>
      <KeyValue label="Last active">{formatRelative(agent.updated_at, now)}</KeyValue>
      {step === null ? null : (
        <KeyValue label="Step" selectable>
          {step}
        </KeyValue>
      )}
      {pending.length > 0 ? (
        <div className="flex flex-col gap-1.5 py-2">
          <span className="ui-label">{`Queued to send · ${pending.length}`}</span>
          <AnimatePresence initial={false}>
            {pending.map((message) => (
              <motion.span key={message.id} {...RISE} layout="position" data-selectable className="text-[13px] text-ink-muted">
                <Clamp text={`To ${who(message.to)}${message.expects_reply ? " (expects a reply)" : ""}: ${message.preview}`} lines={2} />
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      ) : null}
      <Disclosure
        title="Charter"
        summary={`~${compact(Math.round(agent.system_prompt.length / CHARS_PER_TOKEN))} tokens · ${compact(agent.system_prompt.length)} chars`}
        open={charterOpen}
        onToggle={() => setCharterOpen(!charterOpen)}
      >
        <CharterText source={agent.system_prompt} />
      </Disclosure>
    </div>
  );
}
