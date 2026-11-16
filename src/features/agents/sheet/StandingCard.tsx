import { SectionHeader } from "../../../shared/components/Module";
import { formatRelative } from "../../../shared/lib/ux/time";
import { Button } from "../../../shared/ui/Button";
import { Clamp } from "../../../shared/ui/Truncate";
import type { Standing } from "./brief";

/** Props of {@link StandingCard}. */
export type StandingCardProps = {
  standing: Standing;
  agentName: string;
  /** Opens the agent's thread, where Ankur answers. */
  onOpenThread: () => void;
  /** The time the relative words are measured from. */
  now: number;
};

/**
 * What the agent's newest message to Ankur leaves open, above everything else: it is parked on his answer, or blocked. A
 * card for one message, not a count of what needs him.
 */
export function StandingCard({ standing, agentName, onOpenThread, now }: StandingCardProps) {
  const blocked = standing.status === "blocked";
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-[14px] border px-4 py-2.5 ${blocked ? "border-[var(--late-line)] bg-[var(--late-fill)]" : "border-tide-line bg-tide-wash"}`}>
      <SectionHeader title={blocked ? `${agentName} is blocked` : `${agentName} needs your input`} />
      <span data-selectable className="text-[13.5px] leading-[19px]">
        <Clamp text={standing.content} lines={4} />
      </span>
      <div className="flex items-center gap-2 pt-1">
        <span className="flex-1 text-[12px] text-ink-muted">{formatRelative(standing.at, now)}</span>
        <Button tone="fill" size="sm" onClick={onOpenThread}>
          {blocked ? "Open thread" : "Reply"}
        </Button>
      </div>
    </div>
  );
}
