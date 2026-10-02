import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hath } from "../../shared/api";
import type { PatchScheduleRequest, ScheduledMessage } from "../../shared/api/types";
import { Glider } from "../../shared/components/Glider";
import { REVEAL } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";

/** Repeat choices in the editor, as minutes; "once" is a one-shot. */
const REPEAT_PRESETS: Array<{ value: string; label: string }> = [
  { value: "once", label: "Once" },
  { value: "60", label: "Hourly" },
  { value: "1440", label: "Daily" },
  { value: "10080", label: "Weekly" },
];

const FIELD =
  "w-full rounded-[6px] bg-sage-fill px-2.5 py-1.5 text-[13px] leading-snug text-ink outline-none ring-1 ring-sage-line/60 placeholder:text-ink-ghost focus:ring-sage-line";
const LABEL = "mb-1 block text-[11px] tracking-wide text-ink-ghost";

/** A repeat interval in words: "Once", "Daily", "Every 3 days", "Every 2 h", "Every 45 min". */
function repeatLabel(minutes: number | null): string {
  if (minutes === null) {
    return "Once";
  }
  const preset = REPEAT_PRESETS.find((p) => p.value === String(minutes));
  if (preset) {
    return preset.label;
  }
  if (minutes % 1440 === 0) {
    return `Every ${minutes / 1440} days`;
  }
  if (minutes % 60 === 0) {
    return `Every ${minutes / 60} h`;
  }
  return `Every ${minutes} min`;
}

/** `iso` as the local `YYYY-MM-DDTHH:mm` a datetime-local input takes. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type ScheduleSectionProps = {
  agentId: string;
  /** Fetch only while the popover is open and the mesh is up. */
  enabled: boolean;
  /** A schedule is being edited, so the popover should stay open when the pointer drifts off it. */
  onEditingChange: (editing: boolean) => void;
};

/**
 * The agent's scheduled messages, both the ones it sends and the ones it receives, each
 * with its next run, repeat, and message, editable in place. The section is absent when
 * the agent has none, and shows the real error if they fail to load.
 */
export function ScheduleSection({ agentId, enabled, onEditingChange }: ScheduleSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["agent-schedules", agentId],
    queryFn: async () => (await hath.listSchedules(agentId)).schedules,
    enabled,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    setEditingId(null);
  }, [agentId]);

  useEffect(() => {
    onEditingChange(editingId !== null);
  }, [editingId, onEditingChange]);

  const schedules = query.data ?? [];
  const show = query.isError || schedules.length > 0;

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.section key="schedules" {...REVEAL} className="overflow-hidden">
          <div className="mb-4">
            <h3 className="mb-1.5 text-[11px] font-medium tracking-[2px] text-ink-faint">SCHEDULED</h3>
            {query.isError ? (
              <p className="text-[13px] text-error">{query.error.message}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {schedules.map((schedule) => (
                    <motion.li key={schedule.id} {...REVEAL} className="overflow-hidden">
                      <ScheduleRow
                        schedule={schedule}
                        agentId={agentId}
                        editing={editingId === schedule.id}
                        onEdit={() => setEditingId(schedule.id)}
                        onDone={() => setEditingId(null)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

type ScheduleRowProps = {
  schedule: ScheduledMessage;
  /** The popover's agent: decides whether this row reads "to" or "from" the other end. */
  agentId: string;
  editing: boolean;
  onEdit: () => void;
  /** Leave edit mode, after a save, a cancel, or a discard. */
  onDone: () => void;
};

/** One schedule: who it goes to or comes from, when it next runs, how it repeats, and its message. */
function ScheduleRow({ schedule, agentId, editing, onEdit, onDone }: ScheduleRowProps) {
  const queryClient = useQueryClient();
  const [runAt, setRunAt] = useState(() => toLocalInput(schedule.run_at));
  const [repeat, setRepeat] = useState(() => String(schedule.interval_minutes ?? "once"));
  const [content, setContent] = useState(schedule.content);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (editing) {
      setRunAt(toLocalInput(schedule.run_at));
      setRepeat(String(schedule.interval_minutes ?? "once"));
      setContent(schedule.content);
      setConfirmCancel(false);
    }
  }, [editing, schedule.run_at, schedule.interval_minutes, schedule.content]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["agent-schedules"] });
  const save = useMutation({
    mutationFn: (body: PatchScheduleRequest) => hath.patchSchedule(schedule.id, body),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  const cancel = useMutation({
    mutationFn: () => hath.cancelSchedule(schedule.id),
    onSuccess: async () => {
      onDone();
      await refresh();
    },
  });

  const outgoing = schedule.from_agent_id === agentId;
  const other = outgoing ? schedule.to_agent_id : schedule.from_agent_id;
  const repeatOptions = REPEAT_PRESETS.some((p) => p.value === String(schedule.interval_minutes ?? "once"))
    ? REPEAT_PRESETS
    : [...REPEAT_PRESETS, { value: String(schedule.interval_minutes), label: repeatLabel(schedule.interval_minutes) }];

  const changes: PatchScheduleRequest = {};
  if (runAt.length > 0 && runAt !== toLocalInput(schedule.run_at)) {
    changes.run_at = new Date(runAt).toISOString();
  }
  const nextInterval = repeat === "once" ? null : Number(repeat);
  if (nextInterval !== schedule.interval_minutes) {
    changes.interval_minutes = nextInterval;
  }
  if (content.trim() !== schedule.content) {
    changes.content = content.trim();
  }
  const dirty = Object.keys(changes).length > 0;
  const error = save.error ?? cancel.error;

  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 transition-colors duration-slow ease-dadi ${
        editing ? "border-sage-line bg-sage-faint/40" : "border-rule/70"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] text-ink-muted">
          <span className="text-ink-ghost">{outgoing ? "To" : "From"}</span>{" "}
          <span className="font-medium text-ink">{other}</span>
        </p>
        {editing ? null : (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 text-[12px] text-sage-deep transition-opacity duration-slow ease-dadi hover:opacity-70"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <label>
            <span className={LABEL}>Next run</span>
            <input
              type="datetime-local"
              value={runAt}
              onChange={(e) => setRunAt(e.target.value)}
              className={`${FIELD} tabular-nums`}
            />
          </label>
          <div>
            <span className={LABEL}>Repeat</span>
            <Glider options={repeatOptions} value={repeat} onChange={setRepeat} label="Repeat" size="sm" />
          </div>
          <label>
            <span className={LABEL}>Message</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className={`${FIELD} resize-none`}
            />
          </label>
          {error ? <p className="text-[12px] text-error">{error.message}</p> : null}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => (confirmCancel ? cancel.mutate() : setConfirmCancel(true))}
              className="text-[12px] text-error transition-opacity duration-slow ease-dadi hover:opacity-70 disabled:opacity-40"
            >
              {confirmCancel ? "Confirm cancel" : "Cancel schedule"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="ml-auto rounded-full px-3 py-1 text-[12px] text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!dirty || content.trim().length === 0 || runAt.length === 0 || save.isPending}
              onClick={() => save.mutate(changes)}
              className="rounded-full bg-sage-active px-3 py-1 text-[12px] text-sage-deep transition-colors duration-slow ease-dadi enabled:hover:bg-sage-line/50 disabled:opacity-40"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12px]">
            <span className="text-ink tabular-nums">{formatAbsolute(schedule.run_at)}</span>
            <span className="text-ink-ghost">· {formatRelative(schedule.run_at)}</span>
            <span className="text-ink-ghost">· {repeatLabel(schedule.interval_minutes)}</span>
          </p>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-ink-muted" title={schedule.content}>
            {schedule.content}
          </p>
        </>
      )}
    </div>
  );
}
