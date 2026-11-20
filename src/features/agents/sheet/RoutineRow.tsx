import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Reminder, Routine } from "../../../types/hath";
import { Button } from "../../../shared/ui/Button";
import { Clamp, Truncate } from "../../../shared/ui/Truncate";
import { useContextActions } from "../../../shared/interaction/contextMenu";
import { FADE } from "../../../shared/motion";
import { routineActions } from "../actions";
import { cadenceOf, reminderWhen, runsLine } from "./routines";

export type RoutineRowProps = {
  /** A routine, or a reminder (a one-shot "check back at" that belongs to a job). */
  item: { kind: "routine"; routine: Routine } | { kind: "reminder"; reminder: Reminder };
  /** Cancels it; rejects with Hath's reason, which the row shows. */
  onCancel: (id: string) => Promise<void>;
  /** The time the row's relative words are measured from. */
  now: number;
};

/**
 * One routine or reminder of the agent. There is no editor: a routine is its agent's to change, so the one control is Cancel,
 * which asks once (the same way a helper task's Stop does). Right-click offers its actions.
 */
export function RoutineRow({ item, onCancel, now }: RoutineRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routine = item.kind === "routine";
  const id = routine ? item.routine.id : item.reminder.id;
  const title = routine ? item.routine.title : item.reminder.note;
  const context = useContextActions(() => routineActions(item, { onCancel: () => setConfirming(true) }));

  const cancel = async () => {
    setPending(true);
    setError(null);
    try {
      await onCancel(id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setConfirming(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <div {...context} className="flex flex-col gap-1.5 rounded-[12px] bg-sage-fill px-[11px] py-[9px]">
      <div className="flex items-center gap-2">
        <span className="ui-label flex-none" style={{ fontSize: 11 }}>
          {routine ? "Routine" : "Check back"}
        </span>
        <Truncate text={title} className="min-w-0 flex-1 text-[13px] font-semibold" />
        {confirming ? null : (
          <Button tone="quiet" size="sm" aria-label={`Cancel ${title}`} onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        )}
      </div>
      {routine ? (
        <span data-selectable className="text-[13px]">
          <Clamp text={item.routine.procedure} lines={2} />
        </span>
      ) : null}
      {routine ? (
        <div className="flex flex-col text-[13px] text-ink-muted">
          <span>{cadenceOf(item.routine)}</span>
          <span>{runsLine(item.routine, now)}</span>
        </div>
      ) : (
        <span className="text-[13px] text-ink-muted">{reminderWhen(item.reminder)}</span>
      )}
      <AnimatePresence initial={false}>
        {confirming ? (
          <motion.div key="confirm" {...FADE} className="flex items-center gap-2">
            <span className="mr-auto text-[12.5px] text-ink-muted">{routine ? "It will not run again." : "The agent will not be woken for it."}</span>
            <Button tone="danger" size="sm" disabled={pending} onClick={() => void cancel()}>
              {routine ? "Cancel routine" : "Cancel reminder"}
            </Button>
            <Button tone="quiet" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </motion.div>
        ) : null}
        {error === null ? null : (
          <motion.span key="error" {...FADE} data-selectable className="text-[12.5px] text-error">
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
