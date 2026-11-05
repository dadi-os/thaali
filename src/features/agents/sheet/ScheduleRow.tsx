import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PatchScheduleRequest, ScheduledMessage } from "../../../types/hath";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { AgentName } from "../../../shared/ui/AgentName";
import { Clamp } from "../../../shared/ui/Truncate";
import { useContextActions } from "../../../shared/interaction/contextMenu";
import { FADE, REVEAL } from "../../../shared/motion";
import { formatClock, formatDay } from "../../../shared/lib/ux/time";
import { scheduleActions } from "../actions";
import { canSave, changesOf, draftOf, REPEAT_PRESETS, repeatLabel, type ScheduleDraft } from "./schedule";

/** A labelled field of the editor: a caps label over a sage box. */
function Field({ name, tall = false, children }: { name: string; tall?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="ui-label" style={{ fontSize: 11 }}>
        {name}
      </span>
      <div className={`flex gap-2 rounded-[10px] border border-glass-border bg-sage-fill px-3 ${tall ? "items-start py-2" : "h-9 items-center"}`}>{children}</div>
    </div>
  );
}

export type ScheduleRowProps = {
  schedule: ScheduledMessage;
  /** The sheet's agent: decides whether the row reads "To" or "From" the other end. */
  agentId: string;
  /** 1-based position among the agent's schedules, for the Edit control's name. */
  position: number;
  /** Saves the changes; rejects with Hath's reason, which the editor shows. */
  onSave: (id: string, changes: PatchScheduleRequest) => Promise<void>;
  /** Cancels the schedule; rejects with Hath's reason. */
  onCancel: (id: string) => Promise<void>;
};

/** One schedule: who it goes to or comes from, its message, when it next runs and how it repeats, with an Edit that opens the editor in place. Right-click offers its actions. */
export function ScheduleRow({ schedule, agentId, position, onSave, onCancel }: ScheduleRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ScheduleDraft>(() => draftOf(schedule));
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outgoing = schedule.from_agent_id === agentId;
  const other = outgoing ? schedule.to_agent_id : schedule.from_agent_id;

  const close = () => {
    setEditing(false);
    setConfirm(false);
    setError(null);
  };
  const edit = () => {
    setDraft(draftOf(schedule));
    setEditing(true);
  };
  const context = useContextActions(() =>
    scheduleActions(schedule, {
      other,
      onEdit: edit,
      onCancel: () => {
        edit();
        setConfirm(true);
      },
    }),
  );
  const run = async (action: () => Promise<void>, done: () => void) => {
    setPending(true);
    setError(null);
    try {
      await action();
      done();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(false);
    }
  };

  const head = (
    <div className="flex items-start gap-2">
      <span className="text-[13px] text-ink-muted">{outgoing ? "To" : "From"}</span>
      <AgentName name={other} className="flex-1 text-[13px] font-semibold" />
      {editing ? null : (
        <Button tone="quiet" size="sm" aria-label={`Edit schedule ${position}`} onClick={edit}>
          Edit
        </Button>
      )}
    </div>
  );
  const options = REPEAT_PRESETS.some(([value]) => value === String(schedule.interval_minutes ?? "once")) ? REPEAT_PRESETS : [...REPEAT_PRESETS, [String(schedule.interval_minutes), repeatLabel(schedule.interval_minutes)] as const];
  const savable = canSave(schedule, draft) && !pending;
  return (
    <div {...context} className={`flex flex-col gap-2 rounded-[12px] border px-[11px] py-[9px] transition-colors duration-slow ease-dadi ${editing ? "border-sage-line bg-bone" : "border-transparent bg-sage-fill"}`}>
      {head}
      <AnimatePresence initial={false}>
        {editing ? (
          <motion.div key="edit" {...REVEAL} className="overflow-hidden">
            <div className="flex flex-col gap-2">
              <Field name="Next run">
                <input className="cinp text-[14px] text-ink tabular-nums" type="datetime-local" aria-label="Next run" value={draft.runAt} onChange={(event) => setDraft({ ...draft, runAt: event.target.value })} />
              </Field>
              <Field name="Repeat">
                <select className="cinp appearance-none text-[14px] text-ink" aria-label="Repeat" value={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.value })}>
                  {options.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
                <Icon name="chevDown" size={14} />
              </Field>
              <Field name="Message" tall>
                <textarea className="cinp resize-none text-[14px] leading-[19px] text-ink" aria-label="Message" rows={3} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
              </Field>
              <AnimatePresence initial={false}>
                {confirm ? (
                  <motion.span key="confirm" {...FADE} className="text-[13px] text-ink-muted">
                    This schedule will not run again.
                  </motion.span>
                ) : null}
                {error === null ? null : (
                  <motion.span key="error" {...FADE} data-selectable className="text-[13px] text-error">
                    {error}
                  </motion.span>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-2">
                <Button tone="danger" size="sm" disabled={pending} onClick={() => (confirm ? void run(() => onCancel(schedule.id), close) : setConfirm(true))}>
                  {confirm ? "Confirm cancel" : "Cancel schedule"}
                </Button>
                <div className="flex-1" />
                <Button tone="outline" size="sm" onClick={close}>
                  Discard
                </Button>
                <Button tone="fill" size="sm" disabled={!savable} onClick={() => void run(() => onSave(schedule.id, changesOf(schedule, draft)), close)}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="read" {...FADE} className="flex flex-col gap-2">
            <span data-selectable className="text-[13px]">
              <Clamp text={schedule.content} lines={2} />
            </span>
            <span className="text-[13px] text-ink-muted">{`${formatDay(schedule.run_at)}, ${formatClock(schedule.run_at)} · ${repeatLabel(schedule.interval_minutes)}`}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
