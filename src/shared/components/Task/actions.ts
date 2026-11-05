import type { ActionList } from "../../interaction/actions";
import { copyText } from "../../desktop/clipboard";
import { setTakeover } from "../../../store/takeover";

/** What the task actions need to know about a task. */
export type TaskActionTarget = {
  /** The task's address, such as `task/browser/3f2a91`. */
  id: string;
  /** Whether it holds a live screen that can be opened. */
  live: boolean;
};

/** The actions on a helper task, declared once for its right-click menu: open its live screen and copy its id. */
export function taskActions(task: TaskActionTarget): ActionList {
  return [
    { id: "task.open", label: "Open live view", icon: "expand", disabledReason: task.live ? undefined : "This task holds no live screen", run: () => setTakeover(task.id) },
    { id: "task.copy-id", label: "Copy task id", icon: "copy", run: () => copyText(task.id) },
  ];
}
