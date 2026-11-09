import type { ActionList } from "../../../shared/interaction/actions";
import type { TaskStatus } from "../../../types/hath";
import type { ControlState } from "./control";

/** The shared wording for the Pause row's tooltip; Khisso uses the same text. */
export const PAUSE_DETAIL = "The helper waits where it is until you resume";
/** The shared wording for the Stop confirmation; Khisso uses the same text. */
export const STOP_DETAIL = "Ends the task for good; its agent is told";

/** What {@link taskMenu} needs: where the task stands and what each row does. */
export type TaskMenuProps = {
  status: TaskStatus;
  state: ControlState;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  /** Opens the confirmation before the task is ended. */
  onStop: () => void;
};

/**
 * The menu behind the header's split-button arrow: Pause while the task is working, asking or idle, Resume while it is paused and Ankur is not driving it,
 * and Stop task always. A task Ankur is driving shows neither Pause nor Resume: Return hands it back.
 */
export function taskMenu({ status, state, onPause, onResume, onStop }: TaskMenuProps): ActionList {
  const rows: Array<ActionList[number]> = [];
  const driving = state === "in-control" || state === "pausing" || state === "returning";
  if (!driving && (status === "working" || status === "asking" || status === "idle")) {
    rows.push({ id: "task.pause", label: "Pause", detail: PAUSE_DETAIL, icon: "pause", run: onPause });
  }
  if (!driving && status === "paused") {
    rows.push({ id: "task.resume", label: "Resume", icon: "play", run: onResume });
  }
  if (rows.length > 0) {
    rows.push("separator");
  }
  rows.push({ id: "task.stop", label: "Stop task", icon: "power", destructive: true, run: onStop });
  return rows;
}
