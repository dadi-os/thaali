import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Reminder, Routine } from "../../../types/hath";
import { MarkdownBody } from "../../../shared/components/Markdown";
import { KeyValue } from "../../../shared/components/Module";
import { useContextActions } from "../../../shared/interaction/contextMenu";
import { FADE } from "../../../shared/motion";
import { formatDay } from "../../../shared/lib/ux/time";
import { Button } from "../../../shared/ui/Button";
import { Expandable } from "../../../shared/ui/Expandable";
import { routineActions } from "../actions";
import { relative } from "./facts";
import { cadenceOf, daysLabel, reminderWhen, runsLine } from "./routines";

export type RoutineRowProps = {
  /** A routine, or a reminder (a one-shot "check back at" that belongs to a job). */
  item: { kind: "routine"; routine: Routine } | { kind: "reminder"; reminder: Reminder };
  /** Cancels it; rejects with Hath's reason, which the card shows. */
  onCancel: (id: string) => Promise<void>;
  /** The time the card's relative words are measured from. */
  now: number;
};

/**
 * One routine or reminder as a card on the shared expandable. Shut it says what it is and when: the title, the cadence
 * ("Weekdays at 9:00 AM") and "Next Mon 9:00 AM · last ran 2 h ago". Open it shows the whole procedure as formatted text, the days
 * it runs, when it was made, and Cancel, which asks once. There is no editor: a routine is its agent's to change. Right-click offers
 * its actions.
 */
export function RoutineRow({ item, onCancel, now }: RoutineRowProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routine = item.kind === "routine";
  const id = routine ? item.routine.id : item.reminder.id;
  const title = routine ? item.routine.title : item.reminder.note;
  const context = useContextActions(() => routineActions(item, { onCancel: () => { setOpen(true); setConfirming(true); } }));

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
    <div {...context}>
      <Expandable
        open={open}
        onToggle={() => setOpen(!open)}
        title={routine ? title : <span className="[overflow-wrap:anywhere]">{title}</span>}
        secondary={
          routine ? (
            <>
              <span className="block">{cadenceOf(item.routine)}</span>
              <span className="block">{runsLine(item.routine, now)}</span>
            </>
          ) : (
            <span className="block">{`Check back ${reminderWhen(item.reminder)} · ${relative(item.reminder.run_at, now)}`}</span>
          )
        }
      >
        <div className="flex flex-col gap-2">
          {routine ? (
            <div data-selectable className="text-[13px] leading-[19px]">
              <MarkdownBody content={item.routine.procedure} compact />
            </div>
          ) : null}
          <div className="flex flex-col">
            {routine ? <KeyValue label="Runs">{daysLabel(item.routine.days)}</KeyValue> : null}
            <KeyValue label="Created">{formatDay(routine ? item.routine.created_at : item.reminder.run_at)}</KeyValue>
          </div>
          <div className="flex items-center gap-2">
            {confirming ? (
              <>
                <span className="mr-auto text-[12.5px] text-ink-muted">{routine ? "It will not run again." : "The agent will not be woken for it."}</span>
                <Button tone="danger" size="sm" disabled={pending} onClick={() => void cancel()}>
                  {routine ? "Cancel routine" : "Cancel reminder"}
                </Button>
                <Button tone="quiet" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button tone="quiet" size="sm" aria-label={`Cancel ${title}`} onClick={() => setConfirming(true)}>
                Cancel
              </Button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {error === null ? null : (
              <motion.span key="error" {...FADE} data-selectable className="text-[12.5px] text-error">
                {error}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </Expandable>
    </div>
  );
}
