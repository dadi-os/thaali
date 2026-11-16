import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AgentRecord } from "../../../types/hath";
import { KeyValue, SectionHeader } from "../../../shared/components/Module";
import { FADE } from "../../../shared/motion";
import { countNoun } from "../../../shared/lib/ux/plural";
import { formatClock, formatDay } from "../../../shared/lib/ux/time";
import type { LiveWake } from "../../../contexts/running";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Clamp } from "../../../shared/ui/Truncate";
import type { Brief } from "./brief";

/** The Stop control's state: the call in flight, what hath answered, and why it failed. */
export type StopState = {
  pending: boolean;
  /** Hath's answer to the last stop of this agent; its `halt_failed` is never hidden. */
  result: { halt_failed: { task: string; error: string }[] } | null;
  error: string | null;
};

/** The most things a ledger row names before it counts the rest. */
const LEDGER_NAMED = 2;

/** Props of {@link NowCard}. */
export type NowCardProps = {
  agent: Pick<AgentRecord, "id" | "running">;
  brief: Brief;
  /** The counts of the wake running now. */
  live: LiveWake | undefined;
  stop: StopState;
  /** Stops the agent's run and job; hath halts the job's helper tasks. */
  onStop: () => void;
};

/**
 * The answer to "what is this agent doing for this ask": the job ledger read as one card. The headline, the ask that opened the
 * job and its answer-by clock, what the agent asked, told, saved and will check back on, and Stop while there is anything to
 * stop (it asks first, like a helper task's Stop).
 */
export function NowCard({ agent, brief, live, stop, onStop }: NowCardProps) {
  const [confirming, setConfirming] = useState(false);
  const { job, working } = agent.running;
  const stoppable = working || (job !== null && job.stopped === null);
  const calls = live?.counts.tool_calls ?? 0;
  const sent = live?.counts.messages_sent ?? 0;
  const progress = [calls > 0 ? `${calls} ${countNoun(calls, "tool call")}` : null, sent > 0 ? `${sent} sent` : null].filter((part) => part !== null).join(" · ");
  const told = brief.told.slice(-LEDGER_NAMED);
  if (brief.tone === "idle" && job === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 rounded-[14px] bg-sage-fill px-4 py-2.5">
      <SectionHeader title="Now" />
      <span data-selectable className={`text-[14px] leading-[20px] ${brief.tone === "idle" ? "text-ink-muted" : "font-medium"}`}>{brief.headline}</span>
      {working && progress !== "" ? <span className="text-[12.5px] text-ink-muted">{progress}</span> : null}
      {brief.ask === null ? null : (
        <div className="flex items-start gap-2 pt-1 text-[13px] leading-[20px] text-ink-muted">
          <span className="mt-1 flex"><Icon name="user" size={13} /></span>
          <span data-selectable className="min-w-0 flex-1">
            <Clamp text={`${brief.ask.routine ? "Routine started" : `${brief.ask.who} asked`} at ${formatClock(brief.ask.at)}: ${brief.ask.text}`} lines={3} />
          </span>
        </div>
      )}
      {brief.answerBy === null ? null : (
        <div className={`flex items-center gap-2 text-[13px] ${brief.answerBy.overdue ? "font-medium text-[var(--late-ink)]" : "text-ink-muted"}`}>
          <Icon name="clock" size={13} />
          {brief.answerBy.label}
        </div>
      )}
      <div className="flex flex-col pt-1">
        {brief.asked.map((ask) => (
          <KeyValue key={ask.to} label={`Asked ${ask.to}`}>{ask.replied ? "replied" : "no reply yet"}</KeyValue>
        ))}
        {told.length === 0 ? null : (
          <KeyValue label={brief.ask?.routine === true ? "Sent" : "Told you"} selectable>
            {told[told.length - 1]}
          </KeyValue>
        )}
        {brief.stored.length === 0 ? null : (
          <KeyValue label="Saved to memory" selectable>
            {brief.stored.join(" · ")}
          </KeyValue>
        )}
        {brief.checkBacks.length === 0 ? null : <KeyValue label="Checks back">{brief.checkBacks.map((at) => `${formatDay(at)}, ${formatClock(at)}`).join(" · ")}</KeyValue>}
      </div>
      <AnimatePresence initial={false}>
        {stop.result !== null && stop.result.halt_failed.length > 0 ? (
          <motion.div key="halt-failed" {...FADE} role="alert" data-selectable className="flex flex-col gap-0.5 text-[12.5px] text-error">
            {stop.result.halt_failed.map((failed) => (
              <span key={failed.task} className="[overflow-wrap:anywhere]">{`Could not halt ${failed.task.replace(/^task\//, "")}: ${failed.error}`}</span>
            ))}
          </motion.div>
        ) : null}
        {stop.error === null ? null : (
          <motion.span key="stop-error" {...FADE} role="alert" data-selectable className="text-[12.5px] text-error">
            {stop.error}
          </motion.span>
        )}
      </AnimatePresence>
      {stoppable || stop.pending ? (
        <div className="flex items-center justify-end gap-2 pt-0.5">
          {confirming ? (
            <>
              <span className="mr-auto text-[12.5px] text-ink-muted">Stop this job and its helper tasks?</span>
              <Button
                tone="danger"
                size="sm"
                disabled={stop.pending}
                onClick={() => {
                  setConfirming(false);
                  onStop();
                }}
              >
                Stop
              </Button>
              <Button tone="quiet" size="sm" disabled={stop.pending} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button tone="quiet" size="sm" aria-label={`Stop ${agent.id}`} disabled={stop.pending} onClick={() => setConfirming(true)}>
              {stop.pending ? "Stopping…" : "Stop"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
