import { useEffect, useState } from "react";
import { closeWindow, minimizeWindow, toggleMaximize, watchMaximized } from "../../desktop/window";
import { isTauriRuntime } from "../../desktop/runtime";
import { Icon, type IconName } from "../../ui/Icon";

/**
 * Frameless window controls for Windows/Linux, pinned to the right edge of the title bar for the bar's full height. Mac keeps
 * native traffic lights.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => watchMaximized(setMaximized), []);

  if (!isTauriRuntime()) {
    return null;
  }

  return (
    <div className="window-controls absolute inset-y-0 right-0 flex items-stretch">
      <ControlButton label="Minimize" icon="minimize" onClick={() => void minimizeWindow()} />
      <ControlButton label={maximized ? "Restore" : "Maximize"} icon={maximized ? "restore" : "maximize"} onClick={() => void toggleMaximize()} />
      <ControlButton label="Close" icon="close" danger onClick={() => void closeWindow()} />
    </div>
  );
}

type ControlButtonProps = {
  /** Accessible name for the control. */
  label: string;
  icon: IconName;
  /** Close-button styling (red hover). */
  danger?: boolean;
  onClick: () => void;
};

/** Single caption-button cell in the frameless window chrome: the bar's full height by 48 px wide. */
function ControlButton({ label, icon, danger, onClick }: ControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex w-12 items-center justify-center text-ink-muted ${danger ? "hover:bg-error hover:text-bone" : "hover:bg-sage-fill hover:text-ink"}`}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
