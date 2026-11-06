import type { ReactNode } from "react";
import { detectDesktopOs } from "../../desktop/os";
import { toggleMaximize } from "../../desktop/window";
import { WindowControls } from "./WindowControls";

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
 * add their own window controls after it. macOS overlay titlebars already zoom on a native
 * double-click, so only the frameless bars toggle maximize here.
 */
export function TitleBar({ wordmark, notice, onHome }: TitleBarProps) {
  const frameless = detectDesktopOs() !== "macos";

  return (
    <div className="titlebar" data-tauri-drag-region onDoubleClick={frameless ? () => void toggleMaximize() : undefined}>
      {wordmark ? (
        <button type="button" aria-label="Dadi home" onClick={onHome} className="flex h-full items-center px-4">
          <span aria-hidden="true" className="titlebar-mark">
            દાદી
          </span>
        </button>
      ) : null}
      <div className={`absolute inset-y-1 flex items-center gap-2 ${frameless ? "right-[156px]" : "right-3"}`}>{notice}</div>
      {frameless ? <WindowControls /> : null}
    </div>
  );
}
