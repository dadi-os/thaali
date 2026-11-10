import type { NasTask } from "../../shared/api/nas";

/** The filters over the task list, in the order their chips are drawn. */
export const TASK_FILTERS = ["All", "Working", "Waiting", "Idle", "Asleep", "Stopped"] as const;

/** One of {@link TASK_FILTERS}. */
export type TaskFilter = (typeof TASK_FILTERS)[number];

/** The status each filter other than All keeps; a paused task is a working one its owner is driving, so it is listed with them. */
const KEEPS: Record<Exclude<TaskFilter, "All">, readonly NasTask["status"][]> = {
  Working: ["working", "paused"],
  Waiting: ["asking"],
  Idle: ["idle"],
  Asleep: ["asleep"],
  Stopped: ["stopped"],
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

/** The tasks a tile's task region shows, and what the header should call them. */
export type TileTasks = {
  /** The header over the list, naming which tasks it counts. */
  title: "Active tasks" | "Idle tasks" | "Asleep tasks";
  /** The tasks to list, in the order they should be drawn. */
  tasks: NasTask[];
};

/**
 * The tasks a tile shows: the active ones (working, asking, paused) when any exist; otherwise the idle ones; otherwise the
 * asleep ones with any stopped task last. Working comes before asking in the active list.
 */
export function tileTasks(tasks: NasTask[]): TileTasks {
  const active = tasks.filter((task) => task.status === "working" || task.status === "paused" || task.status === "asking");
  if (active.length > 0) {
    return { title: "Active tasks", tasks: active.sort((a, b) => Number(a.status === "asking") - Number(b.status === "asking")) };
  }
  const idle = tasks.filter((task) => task.status === "idle");
  if (idle.length > 0) {
    return { title: "Idle tasks", tasks: idle };
  }
  return { title: "Asleep tasks", tasks: [...tasks.filter((task) => task.status === "asleep"), ...tasks.filter((task) => task.status === "stopped")] };
}
