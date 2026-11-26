import { useState } from "react";
import type { AgentRecord } from "../../../types/hath";
import { Expandable } from "../../../shared/ui/Expandable";
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

/** Props of {@link Charter}. */
export type CharterProps = {
  agent: AgentRecord;
};

/** The agent's charter as a shared-expandable row at the foot of the popover: shut it says how long it is, open it is the whole text. */
export function Charter({ agent }: CharterProps) {
  const [open, setOpen] = useState(false);
  return (
    <Expandable title="Charter" secondary={`${compact(Math.round(agent.system_prompt.length / CHARS_PER_TOKEN))} tokens of instructions`} open={open} onToggle={() => setOpen(!open)}>
      <CharterText source={agent.system_prompt} />
    </Expandable>
  );
}
