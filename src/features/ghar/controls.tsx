/**
 * The Ghar page's controls, drawn straight on the page: the switch, the horizontal brightness
 * bar (a room, a group, the widget), the inspector's tall brightness pill and its gradient
 * sliders. A drag follows the pointer and sends once on release; the dragged value stays
 * until the command settles, by which point Ghar's accepted state is in the cache.
 */

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { IconSun } from "./icons";
import { levelAt, trackFraction } from "./model";

type SwitchProps = {
  on: boolean;
  label: string;
  disabled: boolean;
  onChange: (on: boolean) => void;
};

/** A 54 × 32 switch; the knob slides with a small overshoot. */
export function Switch({ on, label, disabled, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!on);
      }}
      className={`ghar-switch ${on ? "ghar-switch--on" : ""}`}
    >
      <span className="ghar-switch__knob" />
    </button>
  );
}

/**
 * A fraction 0–1 that follows the pointer along `axis` while dragging and is sent on release
 * through `commit`; arrow keys step a tenth. Null while nothing is being dragged.
 */
function useDrag(axis: "x" | "y", inset: number, current: number, disabled: boolean, commit: (fraction: number) => Promise<void>) {
  const [draft, setDraft] = useState<number | null>(null);
  const dragging = useRef(false);

  const at = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return axis === "x"
      ? trackFraction(event.clientX, rect.left + inset, rect.width - inset * 2)
      : 1 - trackFraction(event.clientY, rect.top + inset, rect.height - inset * 2);
  };

  const send = (fraction: number) => {
    setDraft(fraction);
    void commit(fraction).finally(() => setDraft(null));
  };

  return {
    draft,
    handlers: {
      onClick: (event: MouseEvent) => event.stopPropagation(),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const step =
          event.key === "ArrowUp" || event.key === "ArrowRight" ? 0.1 : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -0.1 : 0;
        if (step === 0 || disabled) {
          return;
        }
        event.preventDefault();
        send(Math.min(1, Math.max(0, (draft ?? current) + step)));
      },
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (disabled || event.button !== 0) {
          return;
        }
        event.stopPropagation();
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraft(at(event));
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (dragging.current) {
          setDraft(at(event));
        }
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        if (!dragging.current) {
          return;
        }
        dragging.current = false;
        send(at(event));
      },
      onPointerCancel: () => {
        dragging.current = false;
        setDraft(null);
      },
    },
  };
}

type LevelBarProps = {
  /** What the bar sets, before the value: "Room brightness", "Brightness". */
  label: string;
  /** Brightness 0–100, or null when nothing it sets is lit. */
  value: number | null;
  /** The color the bar fills with: the lit lights' color. */
  color: string;
  disabled: boolean;
  /** Tailwind height and text size for where the bar sits. */
  className: string;
  onCommit: (level: number) => Promise<void>;
};

/** A rounded bar that fills with the lights' color to their brightness; dragging sets every light under it. */
export function LevelBar({ label, value, color, disabled, className, onCommit }: LevelBarProps) {
  const current = (value ?? 0) / 100;
  const { draft, handlers } = useDrag("x", 0, current, disabled, (fraction) => onCommit(levelAt(fraction)));
  const shown = draft ?? current;
  const percent = Math.round(shown * 100);
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-disabled={disabled}
      className={`ghar-bar ${disabled ? "ghar-bar--disabled" : ""} ${className}`}
      style={{ "--bar-color": color } as CSSProperties}
      {...handlers}
    >
      <span className="ghar-bar__fill" style={{ width: `${shown * 100}%` }} />
      <span className="ghar-bar__label">
        {label} · {value === null && draft === null ? "Off" : `${percent}%`}
      </span>
    </div>
  );
}

type PillProps = {
  /** Brightness 0–100, or null before the light has reported one. */
  value: number | null;
  color: string;
  on: boolean;
  disabled: boolean;
  onCommit: (level: number) => Promise<void>;
};

/** The inspector's tall brightness pill: it fills from the bottom with the light's color. */
export function Pill({ value, color, on, disabled, onCommit }: PillProps) {
  const current = (value ?? 0) / 100;
  const { draft, handlers } = useDrag("y", 0, current, disabled, (fraction) => onCommit(levelAt(fraction)));
  const shown = draft ?? current;
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Brightness"
      aria-valuemin={1}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-disabled={disabled}
      className={`ghar-pill ${on || draft !== null ? "ghar-pill--on" : ""} ${disabled ? "ghar-bar--disabled" : ""}`}
      style={{ "--bar-color": color } as CSSProperties}
      {...handlers}
    >
      <span className="ghar-pill__fill" style={{ height: `${shown * 100}%` }} />
      <span className="ghar-pill__value">
        <span className="size-5">
          <IconSun />
        </span>
        {value === null && draft === null ? "–" : `${Math.round(shown * 100)}%`}
      </span>
    </div>
  );
}

type TrackProps = {
  label: string;
  /** What the slider shows now, beside its label. */
  reading: string;
  /** Where the light sits on the track 0–1, or null when it is showing the other kind of color. */
  value: number | null;
  /** The CSS gradient the track is drawn with. */
  gradient: string;
  disabled: boolean;
  onCommit: (fraction: number) => Promise<void>;
};

/** A gradient slider with a white bead; a light showing the other kind of color leaves the bead faint. */
export function Track({ label, reading, value, gradient, disabled, onCommit }: TrackProps) {
  const { draft, handlers } = useDrag("x", 13, value ?? 0.5, disabled, onCommit);
  const shown = draft ?? value;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[13px] font-semibold text-sage-deep">
        <span>{label}</span>
        <span className="text-ink-muted">{reading}</span>
      </div>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown === null ? undefined : Math.round(shown * 100)}
        aria-valuetext={reading}
        aria-disabled={disabled}
        className={`ghar-track ${disabled ? "ghar-bar--disabled" : ""}`}
        style={{ background: gradient }}
        {...handlers}
      >
        <span
          className="ghar-track__bead"
          style={{ left: `calc(${shown ?? 0.5} * (100% - 26px) + 2px)`, opacity: shown === null ? 0.45 : 1 }}
        />
      </div>
    </div>
  );
}
