import type { Action, ActionList } from "../../shared/interaction/actions";
import type { GharDevice } from "../../types/ghar";
import { isOn, isSwitchable } from "./model";

/** What {@link deviceActions} needs from the page to run a device's actions. */
export type DeviceActionDeps = {
  /** Ghar is unreachable: the actions that change the house show why they cannot run. */
  disabled: boolean;
  /** The tag whose devices the page is showing; absent when it shows all of them or the untagged. */
  inTag?: string;
  /** Switch the device on or off. */
  onToggle: (on: boolean) => void;
  /** Make the device show itself (blink or beep). */
  onIdentify: () => void;
  /** Open the inspector on the device with its name ready to type over. */
  onRename: () => void;
  /** Take the device out from under the tag the page is showing. */
  onRemoveFromTag: () => void;
  /** Open the inspector on the device. */
  onInspect: () => void;
};

/**
 * What a person can do with a device: open it in the inspector, switch it, identify it, rename it, and, in a tag's view, take it
 * out from under that tag. One list, drawn by the right-click menu on its tile and by any `...` menu.
 */
export function deviceActions(device: GharDevice, { disabled, inTag, onToggle, onIdentify, onRename, onRemoveFromTag, onInspect }: DeviceActionDeps): ActionList {
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
  if (inTag !== undefined) {
    list.push("separator", { id: "remove-tag", label: `Remove from ${inTag}`, icon: "close", disabledReason: disabled ? "Ghar is unreachable" : undefined, run: onRemoveFromTag });
  }
  return list;
}
