/** Save a file Ankur downloads from the app. */

import { isTauriRuntime } from "../../api/runtime";

/**
 * Save `blob` as `filename`. Tauri writes it into the Downloads folder (numbering a taken
 * name) and shows it in the file manager; the browser hands it to its own download.
 * Failures propagate — callers must surface them.
 */
export async function saveFile(filename: string, blob: Blob): Promise<void> {
  if (isTauriRuntime()) {
    const [{ invoke }, { revealItemInDir }] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/plugin-opener"),
    ]);
    const name = btoa(String.fromCharCode(...new TextEncoder().encode(filename)));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const path = await invoke<string>("save_download", bytes, { headers: { filename: name } });
    await revealItemInDir(path);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
