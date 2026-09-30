import { isTauriRuntime } from "./shared/api/runtime";

/** Desktop OS family for chrome layout (null in the browser). */
export type DesktopOs = "macos" | "windows" | "linux";

let tauriPlatform: string | null = null;

/**
 * Resolve Tauri OS platform once at boot so {@link detectDesktopOs} stays sync.
 * No-op outside Tauri (avoids loading `@tauri-apps/plugin-os` in the browser).
 */
export async function prepareTarget(): Promise<void> {
  if (!isTauriRuntime()) {
    tauriPlatform = null;
    return;
  }
  const { platform } = await import("@tauri-apps/plugin-os");
  tauriPlatform = platform();
}

/** Desktop host OS for window chrome. Null outside Tauri (browser). */
export function detectDesktopOs(): DesktopOs | null {
  if (!isTauriRuntime()) {
    return null;
  }
  if (tauriPlatform === "macos") {
    return "macos";
  }
  if (tauriPlatform === "windows") {
    return "windows";
  }
  if (tauriPlatform === "linux") {
    return "linux";
  }
  return null;
}
