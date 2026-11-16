import type { Reminder, Routine, Weekday } from "../../../types/hath";
import { formatClock, formatDay, formatRelative } from "../../../shared/lib/ux/time";

const ORDER: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const NAME: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/** A routine's days in words: `Every day`, `Weekdays`, `Weekends`, or the named days in week order. */
export function daysLabel(days: Weekday[] | null): string {
  if (days === null || days.length === 0 || days.length === ORDER.length) {
    return "Every day";
  }
  const kept = ORDER.filter((day) => days.includes(day));
  if (kept.join() === "mon,tue,wed,thu,fri") {
    return "Weekdays";
  }
  if (kept.join() === "sat,sun") {
    return "Weekends";
  }
  return kept.map((day) => NAME[day]).join(", ");
}

/** A routine's `HH:MM` (the box's local time) with its AM or PM mark: `07:30` reads `7:30 AM`. */
export function timeLabel(at: string): string {
  const [hour, minute] = at.split(":").map(Number);
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`a routine time is HH:MM, got ${at}`);
  }
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** The routine's cadence: `Weekdays at 7:30 AM`. */
export function cadenceOf(routine: Pick<Routine, "days" | "at">): string {
  return `${daysLabel(routine.days)} at ${timeLabel(routine.at)}`;
}

/** When it runs next and when it last did: `Next Tue, Nov 17, 7:30 AM · last ran 2 hours ago`, or `never ran`. */
export function runsLine(routine: Pick<Routine, "next_run_at" | "last_run_at">, now: number): string {
  const next = `Next ${formatDay(routine.next_run_at)}, ${formatClock(routine.next_run_at)}`;
  return `${next} · ${routine.last_run_at === null ? "never ran" : `last ran ${formatRelative(routine.last_run_at, now)}`}`;
}

/** A reminder's time: `Tue, Nov 17, 4:00 PM`. */
export function reminderWhen(reminder: Pick<Reminder, "run_at">): string {
  return `${formatDay(reminder.run_at)}, ${formatClock(reminder.run_at)}`;
}

/** The routines Ankur can still act on: an ended one has nothing to cancel. */
export function activeRoutines(routines: Routine[]): Routine[] {
  return routines.filter((routine) => routine.active);
}
