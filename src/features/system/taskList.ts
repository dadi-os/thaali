import type { NasTask } from "../../shared/api/nas";

/** The filters over the task list, in the order their chips are drawn. */
export const TASK_FILTERS = ["All", "Working", "Waiting", "Idle", "Asleep"] as const;

/** One of {@link TASK_FILTERS}. */
export type TaskFilter = (typeof TASK_FILTERS)[number];

/** The status each filter other than All keeps; a paused task is a working one its owner is driving, so it is listed with them. */
const KEEPS: Record<Exclude<TaskFilter, "All">, readonly NasTask["status"][]> = {
  Working: ["working", "paused"],
  Waiting: ["asking"],
  Idle: ["idle"],
  Asleep: ["asleep"],
};

/** Whether a filter keeps a task. */
export function keeps(filter: TaskFilter, task: NasTask): boolean {
  return filter === "All" || KEEPS[filter].includes(task.status);
}

/** How many tasks each filter keeps. */
export function filterCounts(tasks: NasTask[]): Record<TaskFilter, number> {
  return Object.fromEntries(TASK_FILTERS.map((filter) => [filter, tasks.filter((task) => keeps(filter, task)).length])) as Record<TaskFilter, number>;
}

/** The tasks a filter keeps, those waiting on their agent first and then the newest activity first. */
export function listedTasks(tasks: NasTask[], filter: TaskFilter): NasTask[] {
  return tasks
    .filter((task) => keeps(filter, task))
    .sort((a, b) => Number(b.status === "asking") - Number(a.status === "asking") || Date.parse(b.last_activity) - Date.parse(a.last_activity));
}

/** The browser slot a task holds, such as `slot 2`; null for a terminal and for a task that holds nothing. */
export function slotLabel(task: NasTask): string | null {
  return task.kind === "browser" && task.resource !== undefined ? `slot ${task.resource}` : null;
}
