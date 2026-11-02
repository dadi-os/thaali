import type { AgentSessions, AgentTask } from "../../types/hath";
import type { NasTask } from "../../shared/api/nas";

/** The live thing a task holds in Nas, which a view can show. */
export type TaskLiveView =
  | { kind: "browser"; browserId: number }
  | { kind: "terminal"; terminalId: string };

/**
 * The live view of a task: its browser slot or terminal. A sleeping task holds no
 * resource, so it has none and shows its state summary instead.
 */
export function taskLiveView(task: NasTask | undefined): TaskLiveView | null {
  if (!task || task.status === "asleep" || task.resource === undefined) {
    return null;
  }
  return task.kind === "browser"
    ? { kind: "browser", browserId: Number(task.resource) }
    : { kind: "terminal", terminalId: task.resource };
}

/**
 * The newest live browser and terminal among an agent's tasks, for the thread's host strip.
 * `sessions.tasks` is most recently active first.
 */
export function pickLiveViews(
  sessions: AgentSessions,
  nasTasks: NasTask[],
): { browserId: number | null; terminalId: string | null } {
  const byId = new Map(nasTasks.map((t) => [t.task, t]));
  let browserId: number | null = null;
  let terminalId: string | null = null;
  for (const row of sessions.tasks) {
    const view = taskLiveView(byId.get(row.id));
    if (view?.kind === "browser" && browserId === null) {
      browserId = view.browserId;
    }
    if (view?.kind === "terminal" && terminalId === null) {
      terminalId = view.terminalId;
    }
  }
  return { browserId, terminalId };
}

/**
 * The one task whose live view the agent sheet shows without being asked: the most recently active
 * task that is working. Every other task shows its status line and loads its view on expand.
 */
export function autoLiveTaskId(tasks: AgentTask[]): string | null {
  let newest: AgentTask | null = null;
  for (const task of tasks) {
    if (task.status === "working" && (newest === null || Date.parse(task.last_activity) > Date.parse(newest.last_activity))) {
      newest = task;
    }
  }
  return newest === null ? null : newest.id;
}

/**
 * Whether a task's live view is mounted (a mounted view holds a capture on the box): the
 * viewer's own expand or collapse wins, else only the auto-shown task has one.
 */
export function showsLiveView(taskId: string, autoId: string | null, overrides: Readonly<Record<string, boolean>>): boolean {
  return overrides[taskId] ?? taskId === autoId;
}
