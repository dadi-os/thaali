import type { Action, ActionList } from "../../shared/interaction/actions";
import type { GharDevice, GharRoom } from "../../types/ghar";
import { isOn, isSwitchable, roomTitle } from "./model";

/** What {@link deviceActions} needs from the page to run a device's actions. */
export type DeviceActionDeps = {
  /** Every room, for moving the device. */
  rooms: GharRoom[];
  /** Ghar is unreachable: the actions that change the house show why they cannot run. */
  disabled: boolean;
  /** Switch the device on or off. */
  onToggle: (on: boolean) => void;
  /** Make the device show itself (blink or beep). */
  onIdentify: () => void;
  /** Open the inspector on the device with its name ready to type over. */
  onRename: () => void;
  /** Move the device to a room. */
  onMove: (room: GharRoom) => void;
  /** Open the inspector on the device. */
  onInspect: () => void;
};

/**
 * What a person can do with a device: open it in the inspector, switch it, identify it, rename it, and move it to
 * another room. One list, drawn by the right-click menu on its tile and by any `...` menu.
 */
export function deviceActions(device: GharDevice, { rooms, disabled, onToggle, onIdentify, onRename, onMove, onInspect }: DeviceActionDeps): ActionList {
  const unreachable = disabled ? "Ghar is unreachable" : !device.online ? "The device is offline" : undefined;
  const list: Array<Action | "separator"> = [{ id: "inspect", label: "Open in inspector", icon: "info", run: onInspect }];
  if (isSwitchable(device)) {
    const on = isOn(device);
    list.push({ id: "power", label: on ? "Turn off" : "Turn on", icon: "power", disabledReason: unreachable, run: () => onToggle(!on) });
  }
  list.push(
    { id: "identify", label: "Identify", icon: "bolt", disabledReason: unreachable, run: onIdentify },
    { id: "rename", label: "Rename", icon: "pencil", disabledReason: disabled ? "Ghar is unreachable" : undefined, run: onRename },
  );
  const elsewhere = rooms.filter((room) => room.id !== device.room.id);
  if (elsewhere.length > 0) {
    list.push("separator");
    for (const room of elsewhere) {
      list.push({ id: `move:${room.id}`, label: `Move to ${roomTitle(room.name)}`, icon: "folder", disabledReason: disabled ? "Ghar is unreachable" : undefined, run: () => onMove(room) });
    }
  }
  return list;
}
