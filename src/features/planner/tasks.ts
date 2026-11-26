/** Checklist logic: what a day's tasks group into, how they sort, what their close reads as, and the optimistic tick. */
import type { QueryClient } from "@tanstack/react-query";
import type { Task } from "../../types/planner";
import { dateKey, endOfDay, formatUntil, isSameDay, startOfDay } from "./dates";
import { formatClock } from "../../shared/lib/ux/time";

/** Query key prefix of every cached task list, so one write reaches the day, week, month and someday lists. */
export const TASKS_KEY = ["yaad", "planner", "tasks"] as const;

/** Query key of the checklist for one local day. */
export function dayTasksKey(day: Date) {
  return [...TASKS_KEY, "day", dateKey(day)] as const;
}

/** Query key of the tasks with no window. */
export const SOMEDAY_KEY = [...TASKS_KEY, "someday"] as const;

/** A close within this many hours of now reads as a countdown ("in 3h"). */
const COUNTDOWN_HOURS = 6;

/** A day's checklist in its three groups. */
export type TaskGroups = {
  /** Not done and closed before the day, or flagged past due: shown on top until done. */
  pastDue: Task[];
  /** Not done and open on the day, soonest close first. */
  open: Task[];
  /** Done, struck through and collapsed. */
  done: Task[];
};

/** A task with no close date belongs to Someday, whether or not it has an opening day: it is never on a day's list. */
export function isSomeday(task: Pick<Task, "closes_at">): boolean {
  return task.closes_at === null;
}

/** The local day a task closes, or null when it is open-ended. */
export function closeDay(task: Task): Date | null {
  return task.closes_at === null ? null : startOfDay(new Date(task.closes_at));
}

/** Earliest close first, open-ended last, then by title. */
export function byClose(a: Task, b: Task): number {
  if (a.closes_at !== b.closes_at) {
    if (a.closes_at === null) return 1;
    if (b.closes_at === null) return -1;
    return Date.parse(a.closes_at) - Date.parse(b.closes_at);
  }
  return a.title.localeCompare(b.title);
}

/**
 * `tasks` as `day` groups them. A task with no close date belongs to Someday and is left out (even one that has an opening day);
 * a task that opens after `day` is not on the list yet.
 */
export function groupTasks(tasks: Task[], day: Date): TaskGroups {
  const key = dateKey(day);
  const groups: TaskGroups = { pastDue: [], open: [], done: [] };
  for (const task of tasks) {
    const closes = closeDay(task);
    if (isSomeday(task)) continue;
    if (task.done) {
      groups.done.push(task);
    } else if (task.past_due || (closes !== null && closes.getTime() < startOfDay(day).getTime())) {
      groups.pastDue.push(task);
    } else if (task.opens_on === null || task.opens_on <= key) {
      groups.open.push(task);
    }
  }
  groups.pastDue.sort(byClose);
  groups.open.sort(byClose);
  groups.done.sort(byClose);
  return groups;
}

/** How many of a day's tasks are ticked, out of every task the list shows. */
export function progressOf(groups: TaskGroups): { done: number; total: number } {
  return { done: groups.done.length, total: groups.pastDue.length + groups.open.length + groups.done.length };
}

/** The day a close falls on, in words: Today, Tomorrow, a weekday within the week, else month and day. */
function whenLabel(close: Date, now: Date): string {
  const days = Math.round((startOfDay(close).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(close);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(close);
}

/**
 * The close hint on a checklist row: a countdown ("in 3h") when it closes later today within six hours,
 * otherwise the day and time ("Fri 11:59 PM"), "Was due" first when it has passed. Null for an open-ended or done task.
 */
export function closeHint(task: Task, now: Date): string | null {
  if (task.closes_at === null || task.done) return null;
  const close = new Date(task.closes_at);
  const ahead = close.getTime() - now.getTime();
  if (ahead > 0 && ahead < COUNTDOWN_HOURS * 3_600_000 && isSameDay(close, now)) return formatUntil(now, close);
  const time = formatClock(task.closes_at);
  if (ahead <= 0) return isSameDay(close, now) ? `Was due ${time}` : `Was due ${whenLabel(close, now)} ${time}`;
  return `${whenLabel(close, now)} ${time}`;
}

/** True when a task not done closes within six hours or has already closed: its hint is drawn in clay. */
export function isUrgent(task: Task, now: Date): boolean {
  return !task.done && task.closes_at !== null && Date.parse(task.closes_at) - now.getTime() < COUNTDOWN_HOURS * 3_600_000;
}

/** `tasks` with one task's done flag set. */
export function withDone(tasks: Task[], id: string, done: boolean): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done } : task));
}

/**
 * Sets a task done (or not) in every cached task list at once, then writes it. A failed write puts every list back
 * as it was and rethrows, so the caller can say so. Lists refetch afterwards either way.
 */
export async function tickTask(
  client: QueryClient,
  write: (taskId: string, done: boolean) => Promise<unknown>,
  taskId: string,
  done: boolean,
): Promise<void> {
  await client.cancelQueries({ queryKey: TASKS_KEY });
  const before = client.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
  client.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (tasks) => (tasks === undefined ? tasks : withDone(tasks, taskId, done)));
  try {
    await write(taskId, done);
  } catch (error) {
    for (const [key, tasks] of before) client.setQueryData(key, tasks);
    throw error;
  } finally {
    void client.invalidateQueries({ queryKey: TASKS_KEY });
  }
}

/** Open tasks on `day` for a week badge, and whether any are urgent. */
export type DayBadge = {
  /** Tasks not done whose window holds the day (past due ones too, on today). */
  open: number;
  /** Some counted task closes that day or is past due: drawn in clay. */
  urgent: boolean;
  /** Tasks exist for the day and every one is done. */
  allDone: boolean;
};

/** The week badge for `day` from that day's task list. */
export function dayBadge(tasks: Task[], day: Date, now: Date): DayBadge {
  const key = dateKey(day);
  const today = isSameDay(day, now);
  const counted = tasks.filter((task) => {
    if (task.done || isSomeday(task)) return false;
    const closes = closeDay(task)!;
    const inWindow = (task.opens_on === null || task.opens_on <= key) && closes.getTime() >= startOfDay(day).getTime();
    return inWindow || (today && task.past_due);
  });
  const urgent = counted.some((task) => task.past_due || (task.closes_at !== null && isSameDay(new Date(task.closes_at), day)));
  return { open: counted.length, urgent, allDone: counted.length === 0 && tasks.some((task) => task.done) };
}

/** The month tile badge: tasks closing on `day`, whether one is past due, and whether all are done. */
export type MonthBadge = { closing: number; pastDue: boolean; allDone: boolean };

/** The month badge for `day` from that day's task list. */
export function monthBadge(tasks: Task[], day: Date): MonthBadge {
  const closing = tasks.filter((task) => task.closes_at !== null && new Date(task.closes_at) <= endOfDay(day) && new Date(task.closes_at) >= startOfDay(day));
  return {
    closing: closing.length,
    pastDue: closing.some((task) => !task.done && task.past_due),
    allDone: closing.length > 0 && closing.every((task) => task.done),
  };
}

/** Items whose titles match once case, digits and punctuation are ignored: "Weigh-in 3" and "weigh in 12". */
export type TitleGroup<T> = { key: string; label: string; items: T[] };

/** The title with case, digits and punctuation removed, the key repeated items share. */
function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** `items` grouped by near-identical title, so forty repeats read as one row; groups sort by label, a group's label is its first title without a trailing number. */
export function groupByTitle<T extends { title: string }>(items: T[]): Array<TitleGroup<T>> {
  const groups = new Map<string, TitleGroup<T>>();
  for (const item of items) {
    const key = titleKey(item.title) || item.title;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { key, label: item.title, items: [item] });
    else group.items.push(item);
  }
  for (const group of groups.values()) {
    if (group.items.length > 1) group.label = group.label.replace(/[\s#:–-]*\d+\s*$/, "").trim() || group.label;
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The course a task row names after its status, or null when the title already says it: a title that starts with the hub's
 * course code ("IBIO 150 — …" under "IBIO 150 class") or contains the hub's whole title needs no second mention.
 */
export function courseLabel(task: Pick<Task, "title" | "hub">): string | null {
  if (task.hub === null) return null;
  const hub = task.hub.title.trim();
  const code = hub.replace(/\s+(class|course|lecture|lab|section)$/i, "");
  const title = task.title.toLowerCase();
  if (title.includes(hub.toLowerCase()) || title.startsWith(code.toLowerCase())) return null;
  return hub;
}
