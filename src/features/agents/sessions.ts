import type { AgentSessions } from "../../types/hath";
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
  /** Ankur has taken it over and its helper is paused. */
  paused: boolean;
};

/** A page address as the preview's bar shows it: without its scheme and a lone trailing slash. */
export function pageAddress(url: string | undefined): string {
  return (url ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/$/, "");
}

/**
 * The newest live browser and terminal among an agent's tasks, for the thread's pin. A browser's caption is the address
 * of the page in front, as Nas reports it, not what the agent last said it was doing.
 * `sessions.tasks` is most recently active first.
 */
export function pickLiveTasks(
  sessions: AgentSessions,
  nasTasks: NasTask[],
): { browser: PinnedTask | null; terminal: PinnedTask | null } {
  const byId = new Map(nasTasks.map((t) => [t.task, t]));
  let browser: PinnedTask | null = null;
  let terminal: PinnedTask | null = null;
  for (const row of sessions.tasks) {
    const view = taskLiveView(byId.get(row.id));
    if (view?.kind === "browser" && browser === null) {
      browser = { task: row.id, resource: String(view.browserId), caption: pageAddress(byId.get(row.id)?.active_url), paused: byId.get(row.id)?.status === "paused" };
    }
    if (view?.kind === "terminal" && terminal === null) {
      terminal = { task: row.id, resource: view.terminalId, caption: `${row.id.replace(/^task\//, "")} · ${view.terminalId}`, paused: byId.get(row.id)?.status === "paused" };
    }
  }
  return { browser, terminal };
}
