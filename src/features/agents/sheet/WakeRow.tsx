import type { WakeOutcome, WakeSummary } from "../../../types/hath";
import { formatRelative } from "../../../shared/lib/ux/time";
import { Expandable } from "../../../shared/ui/Expandable";
import { StateView } from "../../../shared/states/ModuleState";
import { AgentLink } from "./AgentLink";
import { Arrive } from "./Arrive";
import { WakeEntryList } from "./WakeEntries";
import { countsLine, OUTCOME_LABEL, reasonLine, wakeDuration, type ScheduleNames } from "./wakes";
import { useWake } from "./useWakes";

/** The most entry blocks the loading skeleton draws. */
const SKELETON_ENTRIES = 4;

/** Props of {@link Outcome}. */
type OutcomeProps = { outcome: WakeOutcome };

/** A wake's outcome as plain type with a dot: running pulses in sage, waiting is tide, yielded stays quiet and failed takes the error tone. */
function Outcome({ outcome }: OutcomeProps) {
  const dot = outcome === "running" ? "dot dot-pulse bg-sage" : outcome === "waiting" ? "bg-tide" : outcome === "failed" ? "bg-error" : "bg-ink-ghost";
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 text-[12px] font-medium ${outcome === "failed" ? "text-error" : "text-ink-muted"}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

/** Props of {@link WakeRow}. */
export type WakeRowProps = {
  wake: WakeSummary;
  /** Whether the wake shows its entries. */
  open: boolean;
  onToggle: () => void;
  /** An agent's display name by id; null is Ankur. */
  nameOf: (id: string | null) => string;
  /** The routines and reminders that wake the agent, to name a scheduled wake. */
  schedules: ScheduleNames;
  /** Selects the agent a wake's reason names. */
  onSelectAgent: (agentId: string) => void;
  /** The time the row's relative words are measured from. */
  now: number;
};

/**
 * One wake of the timeline: why it began, when and for how long, its outcome (with the error of a failed one), what it did
 * and what it cost. Opened, it reads the wake and lists its entries.
 */
export function WakeRow({ wake, open, onToggle, nameOf, schedules, onSelectAgent, now }: WakeRowProps) {
  const reason = reasonLine(wake.reason, schedules);
  const counts = countsLine(wake.counts);
  return (
    <Expandable
      open={open}
      onToggle={onToggle}
      tone={wake.outcome === "failed" ? "late" : undefined}
      title={
        <>
          {reason.lead}
          {reason.name === null ? null : (
            <>
              {" "}
              <AgentLink agentId={reason.agentId} name={reason.agentId === null ? reason.name : nameOf(reason.agentId)} onSelect={onSelectAgent} />
            </>
          )}
        </>
      }
      secondary={
        <>
          {[formatRelative(wake.started_at, now), wake.ended_at === null ? `running for ${wakeDuration(wake, now)}` : `ran ${wakeDuration(wake, now)}`, counts === "" ? null : counts].filter((part) => part !== null).join(" · ")}
          {wake.error === null ? null : (
            <span data-selectable className="mt-0.5 block text-[12.5px] leading-[17px] text-error [overflow-wrap:anywhere]">
              {wake.error}
            </span>
          )}
        </>
      }
      trailing={<Outcome outcome={wake.outcome} />}
    >
      <WakeBody wake={wake} nameOf={nameOf} onSelectAgent={onSelectAgent} />
    </Expandable>
  );
}

/** The loading stand-in of an open wake, shaped like it: a block per entry the wake counted (at most {@link SKELETON_ENTRIES}). */
function WakeSkeleton({ wake }: { wake: WakeSummary }) {
  const entries = Math.min(SKELETON_ENTRIES, Math.max(1, wake.counts.tool_calls + wake.counts.messages_received + wake.counts.messages_sent));
  return (
    <div className="flex flex-col gap-3 pt-1" aria-label="Loading wake">
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: entries }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5 border-l border-rule pl-3">
            <span className="sk h-3 w-[30%]" />
            <span className="sk h-3 w-full" />
            <span className="sk h-3 w-[70%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The entries of an open wake, or why they are not there: loading, failed, or aged out. The whole wake is read first and then revealed at once. */
function WakeBody({ wake, nameOf, onSelectAgent }: { wake: WakeSummary; nameOf: WakeRowProps["nameOf"]; onSelectAgent: WakeRowProps["onSelectAgent"] }) {
  const detail = useWake(wake.agent_id, wake.id, true);
  const entries = detail.data?.entries ?? [];
  if (detail.error !== null && detail.data === undefined) {
    return (
      <div className="pt-1">
        <StateView kind="error" compact title="Could not read this wake" detail={detail.error.message} onRetry={() => void detail.refetch()} />
      </div>
    );
  }
  return (
    <Arrive ready={detail.data !== undefined} skeleton={<WakeSkeleton wake={wake} />}>
      <div className="flex flex-col gap-3 pt-1">
        {wake.activity_trimmed ? <span className="text-[12.5px] text-ink-muted">Details expired</span> : null}
        {entries.length === 0 ? (
          <span className="text-[12.5px] text-ink-muted">{wake.activity_trimmed ? "No messages were kept." : "Nothing recorded yet."}</span>
        ) : (
          <WakeEntryList entries={entries} agentId={wake.agent_id} nameOf={nameOf} onSelectAgent={onSelectAgent} />
        )}
      </div>
    </Arrive>
  );
}
