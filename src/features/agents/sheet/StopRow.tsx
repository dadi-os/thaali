import { AnimatePresence, motion } from "motion/react";
import { REVEAL } from "../../../shared/motion";
import { Button } from "../../../shared/ui/Button";

/** The Stop control's state: the call in flight, what hath answered, and why it failed. */
export type StopState = {
  pending: boolean;
  /** Hath's answer to the last stop of this agent; its `halt_failed` is never hidden. */
  result: { halt_failed: { task: string; error: string }[] } | null;
  error: string | null;
};

/** Props of {@link StopButton}. */
export type StopButtonProps = {
  agentId: string;
  stop: StopState;
  /** Whether there is anything to stop: the loop runs, or a job is open. */
  stoppable: boolean;
  /** Called when Stop is confirmed. */
  onStop: () => void;
  /** The confirmation's state and message, for the line that opens under the actions row. */
  confirming: boolean;
  setConfirming: (confirming: boolean) => void;
};

/** The Stop button of the actions row: a quiet button that opens {@link StopConfirm} under the row. */
export function StopButton({ agentId, stop, stoppable, confirming, setConfirming }: Pick<StopButtonProps, "agentId" | "stop" | "stoppable" | "confirming" | "setConfirming">) {
  if (!stoppable && !stop.pending) {
    return null;
  }
  return (
    <Button tone="quiet" aria-label={`Stop ${agentId}`} aria-expanded={confirming} disabled={stop.pending} onClick={() => setConfirming(!confirming)}>
      {stop.pending ? "Stopping…" : "Stop"}
    </Button>
  );
}

/** The line that eases open under the actions row: what Stop does, Stop and Keep; and, once it ran, what hath could not halt. */
export function StopConfirm({ stop, confirming, setConfirming, onStop }: Pick<StopButtonProps, "stop" | "confirming" | "setConfirming" | "onStop">) {
  return (
    <AnimatePresence initial={false}>
      {confirming ? (
        <motion.div key="confirm" {...REVEAL} className="overflow-hidden">
          <div className="flex items-center gap-2 rounded-[12px] bg-sage-fill px-3 py-2">
            <span className="mr-auto text-[13px] text-ink-muted">Ends the run and its helper tasks.</span>
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
            <Button tone="quiet" size="sm" onClick={() => setConfirming(false)}>
              Keep going
            </Button>
          </div>
        </motion.div>
      ) : null}
      {stop.result !== null && stop.result.halt_failed.length > 0 ? (
        <motion.div key="halt-failed" {...REVEAL} role="alert" className="overflow-hidden">
          <div data-selectable className="flex flex-col gap-0.5 text-[12.5px] text-error">
            {stop.result.halt_failed.map((failed) => (
              <span key={failed.task} className="[overflow-wrap:anywhere]">{`Could not halt ${failed.task.replace(/^task\//, "")}: ${failed.error}`}</span>
            ))}
          </div>
        </motion.div>
      ) : null}
      {stop.error === null ? null : (
        <motion.div key="stop-error" {...REVEAL} role="alert" className="overflow-hidden">
          <span data-selectable className="text-[12.5px] text-error">{stop.error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
