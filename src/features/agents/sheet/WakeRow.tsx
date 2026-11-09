import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { WakeOutcome, WakeSummary } from "../../../types/hath";
import { REVEAL } from "../../../shared/motion";
import { formatRelative } from "../../../shared/lib/ux/time";
import { Chip } from "../../../shared/ui/Chip";
import { Icon } from "../../../shared/ui/Icon";
import { Segmented } from "../../../shared/ui/Segmented";
import { Clamp } from "../../../shared/ui/Truncate";
import { StateView } from "../../../shared/states/ModuleState";
import { AgentLink } from "./AgentLink";
import { Arrive } from "./Arrive";
import { WakeEntryList } from "./WakeEntries";
import { countsLine, filterEntries, OUTCOME_LABEL, reasonLine, usageChip, wakeDuration, type LaneFilter } from "./wakes";
import { useWake } from "./useWakes";

const LANE_FILTERS: readonly LaneFilter[] = ["All", "Process", "Work"];

/** The most entry blocks the loading skeleton draws. */
const SKELETON_ENTRIES = 4;

/** Props of {@link OutcomeChip}. */
type OutcomeChipProps = { outcome: WakeOutcome };

/** A wake's outcome as a chip: running pulses in sage, waiting in tide, yielded stays quiet and failed takes the error tone. */
function OutcomeChip({ outcome }: OutcomeChipProps) {
  const pulse = (color: string) => <span className="dot dot-pulse" style={{ width: 6, height: 6, background: color }} />;
  if (outcome === "failed") {
    return (
      <span className="inline-flex h-5 flex-none items-center rounded-full bg-error-fill px-2 text-[11.5px] font-semibold text-error">{OUTCOME_LABEL[outcome]}</span>
    );
  }
  if (outcome === "yielded") {
    return (
      <span className="inline-flex h-5 flex-none items-center rounded-full border border-dashed border-sage-line px-2 text-[11.5px] font-semibold text-ink-muted">{OUTCOME_LABEL[outcome]}</span>
    );
  }
  return (
    <span className="inline-flex flex-none items-center gap-1.5">
      <Chip tone={outcome === "running" ? "sage" : "tide"}>
        <span className="inline-flex items-center gap-1.5">
          {pulse(outcome === "running" ? "var(--sage)" : "var(--tide)")}
          {OUTCOME_LABEL[outcome]}
        </span>
      </Chip>
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
  /** Selects the agent a wake's reason names. */
  onSelectAgent: (agentId: string) => void;
  /** The time the row's relative words are measured from. */
  now: number;
};

/**
 * One wake of the timeline: why it began, when and for how long, its outcome (with the error of a failed one), what it did
 * and what it cost. Opened, it reads the wake and lists its entries under a lane filter.
 */
export function WakeRow({ wake, open, onToggle, nameOf, onSelectAgent, now }: WakeRowProps) {
  const reason = reasonLine(wake.reason);
  const counts = countsLine(wake.counts);
  return (
    <div className={`flex flex-col rounded-[14px] border ${wake.outcome === "failed" ? "border-error-line" : open ? "border-glass-border bg-sage-fill" : "border-transparent"}`}>
      <div className="ui-trans flex cursor-pointer flex-col gap-1 rounded-[14px] px-3 py-2.5" onClick={onToggle}>
        <div className="flex items-center gap-2">
          <span className={`flex flex-none text-ink-muted ui-trans ${open ? "rotate-90" : ""}`}><Icon name="chevron" size={12} /></span>
          <span className="min-w-0 flex-1 text-[13.5px] font-semibold [overflow-wrap:anywhere]">
            {reason.lead}
            {reason.name === null ? null : (
              <>
                {" "}
                <AgentLink agentId={reason.agentId} name={reason.agentId === null ? reason.name : nameOf(reason.agentId)} onSelect={onSelectAgent} />
              </>
            )}
          </span>
          <OutcomeChip outcome={wake.outcome} />
          <button type="button" className="sr-only" aria-expanded={open} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
            {open ? "Collapse wake" : "Expand wake"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 text-[12px] text-ink-muted">
          <span>{formatRelative(wake.started_at, now)}</span>
          <span>{wakeDuration(wake, now)}</span>
          {counts === "" ? null : <span>{counts}</span>}
          {wake.usage.calls > 0 ? <span className="font-numeric">{usageChip(wake.usage)}</span> : null}
        </div>
        {wake.opened_by === null ? null : (
          <div className="pl-5 text-[12.5px] leading-[17px] text-ink-muted">
            <Clamp text={wake.opened_by.content} lines={open ? 3 : 1} />
          </div>
        )}
        {wake.error === null ? null : (
          <span data-selectable className="pl-5 text-[12.5px] leading-[17px] text-error [overflow-wrap:anywhere]">{wake.error}</span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="body" {...REVEAL} className="overflow-hidden">
            <WakeBody wake={wake} nameOf={nameOf} onSelectAgent={onSelectAgent} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The loading stand-in of an open wake, shaped like it: the lane filter, then a block per entry the wake counted (at most {@link SKELETON_ENTRIES}). */
function WakeSkeleton({ wake }: { wake: WakeSummary }) {
  const entries = Math.min(SKELETON_ENTRIES, Math.max(1, wake.counts.tool_calls + wake.counts.messages_received + wake.counts.messages_sent));
  return (
    <div className="flex flex-col gap-3 px-3 pb-3 pl-8" aria-label="Loading wake">
      <span className="sk h-6 w-[170px] rounded-[8px]" />
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

/** The entries of an open wake under the lane filter, or why they are not there: loading, failed, or aged out. The whole wake is read first and then revealed at once. */
function WakeBody({ wake, nameOf, onSelectAgent }: { wake: WakeSummary; nameOf: WakeRowProps["nameOf"]; onSelectAgent: WakeRowProps["onSelectAgent"] }) {
  const [filter, setFilter] = useState<LaneFilter>("All");
  const detail = useWake(wake.agent_id, wake.id, true);
  const entries = useMemo(() => (detail.data === undefined ? [] : filterEntries(detail.data.entries, filter)), [detail.data, filter]);
  if (detail.error !== null && detail.data === undefined) {
    return (
      <div className="px-3 pb-3">
        <StateView kind="error" compact title="Could not read this wake" detail={detail.error.message} onRetry={() => void detail.refetch()} />
      </div>
    );
  }
  return (
    <Arrive ready={detail.data !== undefined} skeleton={<WakeSkeleton wake={wake} />}>
      <div className="flex flex-col gap-3 px-3 pb-3 pl-8">
        {wake.activity_trimmed ? (
          <span className="text-[12.5px] text-ink-muted">Details expired</span>
        ) : (
          <div className="flex self-start">
            <Segmented size="sm" label="Lane" options={LANE_FILTERS} value={filter} onChange={setFilter} />
          </div>
        )}
        {entries.length === 0 ? (
          <span className="text-[12.5px] text-ink-muted">{wake.activity_trimmed ? "No messages were kept." : "Nothing recorded yet."}</span>
        ) : (
          <WakeEntryList entries={entries} agentId={wake.agent_id} nameOf={nameOf} onSelectAgent={onSelectAgent} />
        )}
      </div>
    </Arrive>
  );
}
