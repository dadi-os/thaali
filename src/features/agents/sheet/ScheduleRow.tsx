import { useState, type ReactNode } from "react";
import type { PatchScheduleRequest, ScheduledMessage } from "../../../types/hath";
import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { Clamp, Truncate } from "../../../shared/components/Truncate";
import { formatClock, formatDay } from "../../../shared/lib/ux/time";
import { canSave, changesOf, draftOf, REPEAT_PRESETS, repeatLabel, type ScheduleDraft } from "./schedule";

/** A labelled field of the editor: a caps label over a sage box. */
function Field({ name, tall = false, children }: { name: string; tall?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span className="ui-label" style={{ fontSize: 10.5 }}>
        {name}
      </span>
      <div style={{ display: "flex", alignItems: tall ? "flex-start" : "center", gap: 8, ...(tall ? { padding: "8px 12px" } : { height: 36, padding: "0 12px" }), borderRadius: 10, background: "var(--sage-fill)", border: "1px solid var(--glass-border)" }}>{children}</div>
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

/** One schedule: who it goes to or comes from, its message, when it next runs and how it repeats, with an Edit that opens the editor in place. */
export function ScheduleRow({ schedule, agentId, position, onSave, onCancel }: ScheduleRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ScheduleDraft>(() => draftOf(schedule));
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outgoing = schedule.from_agent_id === agentId;
  const other = outgoing ? schedule.to_agent_id : schedule.from_agent_id;
  const frame = { display: "flex", flexDirection: "column", gap: 8, padding: "9px 11px", borderRadius: 11, background: editing ? "var(--bone)" : "var(--sage-fill)", border: `1px solid ${editing ? "var(--sage-line)" : "transparent"}` } as const;

  const close = () => {
    setEditing(false);
    setConfirm(false);
    setError(null);
  };
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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{outgoing ? "To" : "From"}</span>
      <Truncate text={other} style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }} />
      {editing ? null : (
        <Button
          tone="quiet"
          size="sm"
          aria-label={`Edit schedule ${position}`}
          onClick={() => {
            setDraft(draftOf(schedule));
            setEditing(true);
          }}
        >
          Edit
        </Button>
      )}
    </div>
  );
  if (!editing) {
    return (
      <div style={frame}>
        {head}
        <Clamp text={schedule.content} lines={2} style={{ fontSize: 13 }} />
        <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{`${formatDay(schedule.run_at)}, ${formatClock(schedule.run_at)} · ${repeatLabel(schedule.interval_minutes)}`}</span>
      </div>
    );
  }
  const options = REPEAT_PRESETS.some(([value]) => value === String(schedule.interval_minutes ?? "once")) ? REPEAT_PRESETS : [...REPEAT_PRESETS, [String(schedule.interval_minutes), repeatLabel(schedule.interval_minutes)] as const];
  const savable = canSave(schedule, draft) && !pending;
  return (
    <div style={frame}>
      {head}
      <Field name="Next run">
        <input className="cinp" type="datetime-local" aria-label="Next run" value={draft.runAt} onChange={(event) => setDraft({ ...draft, runAt: event.target.value })} style={{ fontSize: 13.5, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }} />
      </Field>
      <Field name="Repeat">
        <select className="cinp" aria-label="Repeat" value={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.value })} style={{ fontSize: 13.5, color: "var(--ink)", appearance: "none" }}>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <Icon name="chevDown" size={14} />
      </Field>
      <Field name="Message" tall>
        <textarea className="cinp" aria-label="Message" rows={3} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} style={{ fontSize: 13.5, color: "var(--ink)", resize: "none", lineHeight: "19px" }} />
      </Field>
      {confirm ? <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>This schedule will not run again.</span> : null}
      {error === null ? null : <span style={{ fontSize: 12.5, color: "var(--error)" }}>{error}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button tone="danger" size="sm" disabled={pending} onClick={() => (confirm ? void run(() => onCancel(schedule.id), close) : setConfirm(true))}>
          {confirm ? "Confirm cancel" : "Cancel schedule"}
        </Button>
        <div style={{ flex: 1 }} />
        <Button tone="outline" size="sm" onClick={close}>
          Discard
        </Button>
        <Button tone="fill" size="sm" disabled={!savable} onClick={() => void run(() => onSave(schedule.id, changesOf(schedule, draft)), close)}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
