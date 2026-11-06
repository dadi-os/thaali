import type { Action, ActionList } from "../../shared/interaction/actions";

/** What {@link tagActions} needs from the tag's header to run its actions. */
export type TagActionDeps = {
  /** Ghar is unreachable: the actions that change the house show why they cannot run. */
  disabled: boolean;
  /** Turn the tag's name into a field. */
  onRename: () => void;
  /** Open the list of devices that can be put under the tag. */
  onAddDevices: () => void;
  /** Ask whether to delete the tag. */
  onDelete: () => void;
};

/**
 * What a person can do with a tag: rename it, put more devices under it and delete it (the devices stay). One list, drawn by the
 * click menu on the tag's name and by a right-click on its header.
 */
export function tagActions({ disabled, onRename, onAddDevices, onDelete }: TagActionDeps): ActionList {
  const unreachable = disabled ? "Ghar is unreachable" : undefined;
  const list: Array<Action | "separator"> = [
    { id: "rename", label: "Rename tag", icon: "pencil", disabledReason: unreachable, run: onRename },
    { id: "add-devices", label: "Add devices", icon: "plus", disabledReason: unreachable, run: onAddDevices },
    "separator",
    { id: "delete", label: "Delete tag", icon: "trash", destructive: true, disabledReason: unreachable, run: onDelete },
  ];
  return list;
}
