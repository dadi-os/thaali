import type { AgentSessions, TaskStatus } from "../../types/hath";
import type { NasTask } from "../../shared/api/nas";
import { POLL_MS } from "../../shared/lib/ux/poll";

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
 * How often to read the task list again: every {@link POLL_MS} while a browser is awake, because its page in front changes
 * with no event announcing it, and never while none is (the event stream covers the rest).
 */
export function tasksRefetchInterval(tasks: NasTask[] | undefined): number | false {
  return tasks?.some((task) => task.kind === "browser" && task.resource !== undefined) ? POLL_MS : false;
}

/** A live task the chat rail pins above an agent's thread. */
export type PinnedTask = {
  /** The task's address, such as `task/browser/3`. */
  task: string;
  /** The browser slot or terminal id it holds in Nas. */
  resource: string;
  /** What the preview's bar says: the address of the page in front in a browser, or a terminal's id and slot. */
  caption: string;
};

/** A page address as the preview's bar shows it: without its scheme and a lone trailing slash. */
export function pageAddress(url: string | undefined): string {
  return (url ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/$/, "");
}

/** Whether a task is doing something: working, asking its agent, or paused with Ankur at the controls. Idle, asleep and stopped tasks are not. */
export function isActiveTask(status: TaskStatus): boolean {
  return status === "working" || status === "asking" || status === "paused";
}

/**
 * The active browser and terminal among an agent's tasks, for the thread's pin; an idle, asleep or stopped task is not pinned.
 * A browser's caption is the address of the page in front, as Nas reports it, not what the agent last said it was doing.
 * `sessions.tasks` is most recently active first; a task in `pinned` (what the pin shows now) wins over a newer one,
 * so two awake browsers trading the lead do not swap the preview back and forth.
 */
export function pickLiveTasks(
  sessions: AgentSessions,
  nasTasks: NasTask[],
  pinned: ReadonlySet<string> = new Set(),
): { browser: PinnedTask | null; terminal: PinnedTask | null } {
  const byId = new Map(nasTasks.map((t) => [t.task, t]));
  const best: { browser: PinnedTask | null; terminal: PinnedTask | null } = { browser: null, terminal: null };
  for (const row of sessions.tasks) {
    const nasTask = byId.get(row.id);
    const view = nasTask !== undefined && isActiveTask(nasTask.status) ? taskLiveView(nasTask) : null;
    if (view === null || nasTask === undefined) {
      continue;
    }
    const candidate: PinnedTask =
      view.kind === "browser"
        ? { task: row.id, resource: String(view.browserId), caption: pageAddress(nasTask.active_url) }
        : { task: row.id, resource: view.terminalId, caption: `${row.id.replace(/^task\//, "")} · ${view.terminalId}` };
    const current = best[view.kind];
    if (current === null || (pinned.has(candidate.task) && !pinned.has(current.task))) {
      best[view.kind] = candidate;
    }
  }
  return best;
}
