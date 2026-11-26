/** Open a link in the person's own browser. */

import { BOX_SCHEME } from "../lib/content/boxLink";
import { isTauriRuntime } from "./runtime";

/**
 * Open `url` outside the app: Tauri hands it to the system's default browser, a browser tab opens it
 * in a new tab. Failures propagate — callers must surface them.
 * @throws For a `box://` link, which names a file on the box and opens in the explorer, never outside the app.
 */
export async function openExternal(url: string): Promise<void> {
  if (url.startsWith(BOX_SCHEME)) {
    throw new Error(`${url} is a file on the box; it opens in the file explorer, not outside the app`);
  }
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noreferrer");
}
