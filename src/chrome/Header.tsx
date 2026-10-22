import { useNavigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../shared/api/runtime";
import { Wordmark } from "../shared/components/Wordmark";
import { useConnection } from "../shared/hooks/useConnection";
import { detectDesktopOs } from "../target";
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

export interface HeaderProps {
  /** Show the centered દાદી; onboarding hides it while its own wordmark is on screen. */
  wordmark: boolean;
}

/**
 * Short desktop title bar — centered wordmark, drag regions, window chrome. The wordmark
 * breathes while the mesh is reconnecting, as it does on the phone while dadi is out of reach.
 */
export function Header({ wordmark }: HeaderProps) {
  const navigate = useNavigate();
  const { state } = useConnection();
  const desktopOs = detectDesktopOs();
  const frameless = desktopOs === "windows" || desktopOs === "linux";
  const pad =
    desktopOs === "macos"
      ? "pl-[80px] pr-3"
      : frameless
        ? "pl-3 pr-0"
        : "px-4";
  /** Only bind custom zoom on frameless shells; macOS uses native zoom. */
  const onTitleDoubleClick = frameless ? toggleMaximize : undefined;

  return (
    <header
      className={`titlebar relative flex h-8 shrink-0 items-stretch select-none ${pad}`}
    >
      <div
        className="titlebar-drag min-h-0 min-w-[24px] flex-1"
        data-tauri-drag-region
        onDoubleClick={onTitleDoubleClick}
      />
      <button
        type="button"
        onClick={() => navigate("/")}
        className={`absolute inset-y-0 left-1/2 z-10 flex -translate-x-1/2 items-center transition-opacity duration-[var(--slower)] ${
          wordmark ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label={state === "reconnecting" ? "Dadi home, reconnecting" : "Dadi home"}
        tabIndex={wordmark ? undefined : -1}
      >
        <Wordmark size={18} breathe={state === "reconnecting"} className="text-sage-text" />
      </button>
      <div
        className="titlebar-drag min-h-0 min-w-[24px] flex-1"
        data-tauri-drag-region
        onDoubleClick={onTitleDoubleClick}
      />
      {frameless ? <WindowControls /> : null}
    </header>
  );
}
