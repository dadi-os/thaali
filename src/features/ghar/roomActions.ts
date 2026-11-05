import type { Action, ActionList } from "../../shared/interaction/actions";

/** What {@link roomActions} needs from the section to run a room's actions. */
export type RoomActionDeps = {
  /** Ghar is unreachable: the actions that change the house show why they cannot run. */
  disabled: boolean;
  /** The room holds lights, so it has a brightness to set. */
  hasLights: boolean;
  /** The room's options panel is showing. */
  opened: boolean;
  /** Show or hide the options panel, where the room's brightness is. */
  onToggleOptions: () => void;
  /** Turn the room's name into a field. */
  onRename: () => void;
  /** Open the list of devices that can be moved into the room. */
  onMoveHere: () => void;
  /** Add a device to the room. */
  onAddHere: () => void;
  /** Ask whether to delete the room. */
  onDelete: () => void;
};

/**
 * What a person can do with a room: set the brightness of its lights, rename it, move lights into it, add a device to it
 * and delete it. One list, drawn by the click menu on the room's name and by a right-click on its header.
 */
export function roomActions({ disabled, hasLights, opened, onToggleOptions, onRename, onMoveHere, onAddHere, onDelete }: RoomActionDeps): ActionList {
  const unreachable = disabled ? "Ghar is unreachable" : undefined;
  const list: Array<Action | "separator"> = [];
  if (hasLights) {
    list.push({ id: "brightness", label: opened ? "Hide brightness" : "Brightness", icon: "sun", disabledReason: unreachable, run: onToggleOptions });
  }
  list.push(
    { id: "rename", label: "Rename room", icon: "pencil", disabledReason: unreachable, run: onRename },
    { id: "move-here", label: "Move lights here", icon: "folder", disabledReason: unreachable, run: onMoveHere },
    { id: "add-here", label: "Add device here", icon: "plus", disabledReason: unreachable, run: onAddHere },
    "separator",
    { id: "delete", label: "Delete room", icon: "trash", destructive: true, disabledReason: unreachable, run: onDelete },
  );
  return list;
}
