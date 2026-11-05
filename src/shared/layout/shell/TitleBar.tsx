import type { ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../../desktop/runtime";
import { detectDesktopOs } from "../../desktop/os";
import { WindowControls } from "./WindowControls";

/**
 * Toggle maximize on the current Tauri window.
 * macOS Overlay titlebars already zoom on native double-click — do not also
 * call `toggleMaximize` or the window maximizes then restores.
 */
function toggleMaximize() {
  if (!isTauriRuntime()) {
    return;
  }
  void getCurrentWindow().toggleMaximize();
}

export interface TitleBarProps {
  /** Show the centered દાદી; onboarding hides it while its own wordmark is on screen. */
  wordmark: boolean;
  /** The one notice for dadi being out of reach, at the bar's right edge. */
  notice: ReactNode;
  /** Go home: the wordmark is the way back. */
  onHome: () => void;
}

/**
 * The desktop title bar: a 40 px glass strip that drags the window, with the દાદી wordmark
 * centered (it takes you home) and the connection notice at its right edge. Windows and Linux
 * add their own window controls after it.
 */
export function TitleBar({ wordmark, notice, onHome }: TitleBarProps) {
  const frameless = detectDesktopOs() !== "macos";

  return (
    <div className="titlebar" data-tauri-drag-region onDoubleClick={frameless ? toggleMaximize : undefined}>
      {wordmark ? (
        <button type="button" aria-label="Dadi home" onClick={onHome} style={{ display: "flex", alignItems: "center", height: "100%", padding: "0 14px" }}>
          <span aria-hidden="true" className="titlebar-mark">
            દાદી
          </span>
        </button>
      ) : null}
      <div style={{ position: "absolute", right: 12, top: 4, bottom: 4, display: "flex", alignItems: "center", gap: 8 }}>{notice}</div>
      {frameless ? <WindowControls /> : null}
    </div>
  );
}
