/** Open a link in the person's own browser. */

import { isTauriRuntime } from "./runtime";

/**
 * Open `url` outside the app: Tauri hands it to the system's default browser, a browser tab opens it
 * in a new tab. Failures propagate — callers must surface them.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noreferrer");
}
