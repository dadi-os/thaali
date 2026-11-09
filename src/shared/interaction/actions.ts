import type { IconName } from "../ui/Icon";

/** One thing a person can do to an object, declared once and drawn as a context menu row, a `...` menu row or a shortcut. */
export type Action = {
  /** Stable id, so a shortcut or a test can name the action. */
  id: string;
  /** What the row says, as a verb: "Mark done", "Open thread". */
  label: string;
  /** One line that explains the row, shown as its tooltip. */
  detail?: string;
  /** The row's icon. */
  icon?: IconName;
  /** The key combination that runs it, such as "mod+k"; shown at the row's end. */
  shortcut?: string;
  /** Drawn in the error tone and kept apart from the safe actions. */
  destructive?: boolean;
  /** When set, the row is shown but cannot run, and this says why. */
  disabledReason?: string;
  /** The row shows a check: the current choice of a few. */
  selected?: boolean;
  /** The menu stays open after the row is chosen, for a menu of toggles. */
  keepOpen?: boolean;
  /** Runs the action. A rejected promise reaches the person as a toast. */
  run: () => void | Promise<void>;
};

/** A menu's contents: actions in order, with `"separator"` between groups. */
export type ActionList = ReadonlyArray<Action | "separator">;

/** Drop separators that open the list, close it or repeat, so a group that came out empty leaves no stray line. */
export function tidyActions(list: ActionList): ActionList {
  const out: Array<Action | "separator"> = [];
  for (const entry of list) {
    if (entry === "separator" && (out.length === 0 || out[out.length - 1] === "separator")) {
      continue;
    }
    out.push(entry);
  }
  if (out[out.length - 1] === "separator") {
    out.pop();
  }
  return out;
}
