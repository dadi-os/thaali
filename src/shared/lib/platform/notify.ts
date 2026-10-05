import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { isTauriRuntime } from "../../api/runtime";

/**
 * Raise a native notification for an agent's message to you while the dadi window is
 * hidden or unfocused, so a reply that lands while you are elsewhere is not missed.
 * Desktop only: the plain-browser dev build has no notification plugin. Permission is
 * asked for the first time it is needed.
 * @throws When permission is refused or the OS rejects the notification.
 */
export async function notifyAgentMessage(agentName: string, content: string): Promise<void> {
  if (!isTauriRuntime() || document.hasFocus()) {
    return;
  }
  const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
  if (!granted) {
    throw new Error(`notification permission not granted; ${agentName}'s message was not shown`);
  }
  sendNotification({ title: agentName, body: content.replace(/\s+/g, " ").trim() });
}
