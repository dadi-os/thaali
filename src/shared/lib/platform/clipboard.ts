/** Copy text to the system clipboard and read it back. */

import { isTauriRuntime } from "../../api/runtime";

/**
 * Write `text` to the clipboard.
 * Tauri uses the clipboard plugin; the browser uses `navigator.clipboard`.
 * Failures propagate — callers must surface them.
 */
export async function copyText(text: string): Promise<void> {
  if (isTauriRuntime()) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Read the clipboard's text, which a secret's clearing timer compares with what it copied.
 * Tauri uses the clipboard plugin; the browser uses `navigator.clipboard`. Failures propagate.
 */
export async function readText(): Promise<string> {
  if (isTauriRuntime()) {
    const { readText: read } = await import("@tauri-apps/plugin-clipboard-manager");
    return read();
  }
  return navigator.clipboard.readText();
}
