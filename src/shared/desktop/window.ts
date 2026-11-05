/** The desktop window's own controls: the only place the Tauri window API is imported. */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./runtime";

/** Maximize the window, or restore it when it is already maximized. Does nothing outside Tauri. */
export async function toggleMaximize(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().toggleMaximize();
  }
}

/** Minimize the window. Does nothing outside Tauri. */
export async function minimizeWindow(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().minimize();
  }
}

/** Close the window. Does nothing outside Tauri. */
export async function closeWindow(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().close();
  }
}

/**
 * Call `onChange` with whether the window is maximized now and after every resize.
 * Returns the function that stops listening; outside Tauri nothing is reported.
 */
export function watchMaximized(onChange: (maximized: boolean) => void): () => void {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const win = getCurrentWindow();
  let stopped = false;
  let unlisten: (() => void) | undefined;
  const report = () => {
    void win.isMaximized().then((maximized) => {
      if (!stopped) {
        onChange(maximized);
      }
    });
  };
  report();
  void win.onResized(report).then((fn) => {
    if (stopped) {
      fn();
    } else {
      unlisten = fn;
    }
  });
  return () => {
    stopped = true;
    unlisten?.();
  };
}
