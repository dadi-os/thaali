import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { planner } from "../../shared/api";
import { failureTarget, pushToast } from "../../contexts/toasts";
import type { Task } from "../../types/planner";
import { TASKS_KEY, tickTask } from "./tasks";

/**
 * Ticks a task or takes the tick back. The tick shows at once in every list; a failed write puts it back with a
 * toast, and a tick offers Undo for the length of a toast.
 */
export function useTaskTick(): (task: Pick<Task, "id" | "title">, done: boolean) => void {
  const client = useQueryClient();
  return useCallback(
    function tick(task, done) {
      tickTask(client, (id, value) => planner.setDone({ task_id: id, done: value }), task.id, done).then(
        () => {
          if (done) {
            pushToast({ key: `planner:done:${task.id}`, tone: "ok", title: "Checked off", body: task.title, action: { label: "Undo", run: () => tick(task, false) } });
          }
        },
        (error: unknown) =>
          pushToast({
            key: "planner:done-failed",
            tone: "error",
            title: "Couldn’t update the task",
            body: error instanceof Error ? error.message : String(error),
            target: failureTarget(error),
          }),
      );
    },
    [client],
  );
}

/** The freshest copy of `task` any cached task list holds, so a card left open shows a tick written from its own button or a row. */
export function useLiveTask(task: Task): Task {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  return useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => {
      for (const [, tasks] of client.getQueriesData<Task[]>({ queryKey: TASKS_KEY })) {
        const found = Array.isArray(tasks) ? tasks.find((candidate) => candidate.id === task.id) : undefined;
        if (found !== undefined) return found;
      }
      return task;
    },
  );
}
