import type { PatchScheduleRequest, ScheduledMessage } from "../../../types/hath";

/** The repeat choices every schedule offers, as the minutes the select carries; `once` is a one-shot. */
export const REPEAT_PRESETS: ReadonlyArray<readonly [value: string, label: string]> = [
  ["once", "Once"],
  ["60", "Hourly"],
  ["1440", "Daily"],
  ["10080", "Weekly"],
];

/** A repeat interval in words: "Once", "Daily", "Every 3 days", "Every 2 h", "Every 45 min". */
export function repeatLabel(minutes: number | null): string {
  if (minutes === null) {
    return "Once";
  }
  const preset = REPEAT_PRESETS.find(([value]) => value === String(minutes));
  if (preset !== undefined) {
    return preset[1];
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
export function toLocalInput(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** What the editor holds: the run time as a datetime-local value, the repeat as a select value, and the message. */
export type ScheduleDraft = { runAt: string; repeat: string; content: string };

/** The draft that says what `schedule` already says. */
export function draftOf(schedule: ScheduledMessage): ScheduleDraft {
  return { runAt: toLocalInput(schedule.run_at), repeat: String(schedule.interval_minutes ?? "once"), content: schedule.content };
}

/** The fields of `draft` that differ from `schedule`, as the patch Hath takes; empty when nothing changed. */
export function changesOf(schedule: ScheduledMessage, draft: ScheduleDraft): PatchScheduleRequest {
  const original = draftOf(schedule);
  const changes: PatchScheduleRequest = {};
  if (draft.runAt.length > 0 && draft.runAt !== original.runAt) {
    changes.run_at = new Date(draft.runAt).toISOString();
  }
  if (draft.repeat !== original.repeat) {
    changes.interval_minutes = draft.repeat === "once" ? null : Number(draft.repeat);
  }
  if (draft.content.trim() !== schedule.content) {
    changes.content = draft.content.trim();
  }
  return changes;
}

/** Whether `draft` may be saved: something changed, and it still has a message and a run time. */
export function canSave(schedule: ScheduledMessage, draft: ScheduleDraft): boolean {
  return Object.keys(changesOf(schedule, draft)).length > 0 && draft.content.trim().length > 0 && draft.runAt.length > 0;
}
