import type { AgentRecord } from "../../../types/hath";
import { formatClock } from "../../../shared/lib/ux/time";
import { Chip } from "../../../shared/ui/Chip";
import { Icon } from "../../../shared/ui/Icon";
import { Clamp } from "../../../shared/ui/Truncate";
import { laneState } from "../laneState";

/** Props of {@link StateStrip}. */
export type StateStripProps = {
  agent: AgentRecord;
};

/** One chip per lane the agent is running or the wait it is in, read from the one derivation of its state; and the job it was given. */
export function StateStrip({ agent }: StateStripProps) {
  const { waiting_on: waiting, status } = agent.running;
  const state = laneState(agent, undefined);
  const chips = [
    state === "working" || state === "both" ? { key: "work", tone: "sage" as const, text: "Working" } : null,
    state === "processing" || state === "both" ? { key: "process", tone: "tide" as const, text: "Processing" } : null,
    state !== "waiting" || waiting === null ? null : { key: "waiting", tone: "tide" as const, text: `Waiting on ${waiting.targets.join(", ")}` },
  ].filter((chip) => chip !== null);
  if (chips.length === 0 && !status?.job) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      {chips.length === 0 ? null : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip.key} tone={chip.tone}>
              {chip.text}
            </Chip>
          ))}
        </div>
      )}
      {status?.job ? (
        <div className="flex items-start gap-2 text-[13px] leading-[20px] text-ink-muted">
          <span className="mt-1 flex"><Icon name="user" size={13} /></span>
          <span data-selectable className="min-w-0 flex-1">
            <Clamp text={`${status.job.from ?? "Ankur"} asked at ${formatClock(status.job.at)}: ${status.job.content}`} lines={2} />
          </span>
        </div>
      ) : null}
    </div>
  );
}
