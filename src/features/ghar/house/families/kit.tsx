/**
 * What every family's form and controls are built from: typed reads of a device's state and
 * capability config, and the inspector's control rows (power, slider, choices, actions, readouts).
 * Controls show the last confirmed value until Ghar accepts a command.
 */

import { useRef, useState, type ComponentType, type CSSProperties } from "react";
import type { GharCapabilityName, GharChoice, GharCommand, GharDevice } from "../../../../types/ghar";

/** A state value Ghar reported, or null when it has not. */
export function num(device: GharDevice, key: string): number | null {
  const value = device.state[key]?.value;
  return typeof value === "number" ? value : null;
}

export function bool(device: GharDevice, key: string): boolean | null {
  const value = device.state[key]?.value;
  return typeof value === "boolean" ? value : null;
}

export function str(device: GharDevice, key: string): string | null {
  const value = device.state[key]?.value;
  return typeof value === "string" ? value : null;
}

/** When `key` last changed, or null when Ghar has no reading. */
export function changedAt(device: GharDevice, key: string): Date | null {
  const at = device.state[key]?.changed_at;
  return at ? new Date(at) : null;
}

/** The config of a capability the device has, or null when it lacks it. */
export function capability(device: GharDevice, name: GharCapabilityName): Record<string, unknown> | null {
  return device.capabilities.find((cap) => cap.capability === name)?.config ?? null;
}

export function has(device: GharDevice, name: GharCapabilityName): boolean {
  return device.capabilities.some((cap) => cap.capability === name);
}

/** A choice list (`modes`, `areas`, `inputs`) from a capability's config. */
export function choices(config: Record<string, unknown> | null, key: string): GharChoice[] {
  const list = config?.[key];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter(
    (entry): entry is GharChoice =>
      typeof entry === "object" && entry !== null && typeof entry.id === "number" && typeof entry.label === "string",
  );
}

/** A sentence-case label for a snake_case state value. */
export function words(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "12 min" or "2 h" since `at`, for clear-since readings. */
export function since(at: Date, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at.getTime()) / 60_000));
  return minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

/** How a tile reads at a glance; each flag is a modifier on the tile. */
export type Tone = {
  /** Lit, running, open, playing: doing its thing. */
  on?: boolean;
  /** A cycle is in progress (a vacuum cleaning, a washer washing, a thermostat working). */
  run?: boolean;
  /** Worth a look, in clay: unlocked, open, humid. */
  alert?: boolean;
  /** Needs attention now, in the error color: a leak, smoke. */
  danger?: boolean;
};

/**
 * A device family: how its kind is drawn as an abstract form, read in a few words, and
 * controlled. Families are chosen by device kind.
 */
export type Family = {
  /** What the inspector calls it, such as "Light · Color". */
  label: (device: GharDevice) => string;
  /** The abstract form at the heart of the tile. */
  Form: ComponentType<{ device: GharDevice }>;
  /** Custom properties the form animates, set on the tile so they transition. */
  style?: (device: GharDevice) => CSSProperties;
  /** The reading under the name, in a few words. */
  reading: (device: GharDevice) => string;
  tone: (device: GharDevice) => Tone;
  /** What a tap does; null means a tap opens the controls. */
  primary: (device: GharDevice) => GharCommand | null;
  Controls: ComponentType<ControlsProps>;
};

/** Props every family's controls take. */
export type ControlsProps = {
  device: GharDevice;
  /** A command for the device is in flight: controls wait. */
  pending: boolean;
  send: (command: GharCommand) => void;
};

const label = "text-[10px] font-medium tracking-[0.14em] text-ink-ghost uppercase";

const thumb =
  "h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-default disabled:opacity-50 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-sage [&::-webkit-slider-thumb]:bg-bone [&::-webkit-slider-thumb]:shadow-[var(--shadow)]";

export type PowerRowProps = {
  /** What the switch is for, read by screen readers. */
  name: string;
  on: boolean;
  /** The state shown beside the switch. */
  status: string;
  disabled: boolean;
  onToggle: () => void;
};

/** A status line with the house switch beside it. */
export function PowerRow({ name, on, status, disabled, onToggle }: PowerRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink-muted">{status}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={name}
        disabled={disabled}
        onClick={onToggle}
        className={`ghar-switch ${on ? "ghar-switch--on" : ""} ${disabled ? "opacity-60" : ""}`}
      >
        <span className="ghar-switch__knob" />
      </button>
    </div>
  );
}

export type SliderProps = {
  label: string;
  min: number;
  max: number;
  step?: number;
  /** Last confirmed value, or null when the device has not reported one. */
  value: number | null;
  /** How a value reads, such as `42%` or `21.5°`. */
  format: (value: number) => string;
  disabled: boolean;
  /** Track background, such as the white-point gradient. */
  track?: string;
  onCommit: (value: number) => void;
};

/**
 * One slider. The thumb follows the pointer and the command fires on release, so a drag is
 * one command; the readout stays on the confirmed value until Ghar reports the new one. Before
 * the device reports a value the track has no thumb, and the first press places one.
 */
export function Slider({ label: name, min, max, step = 1, value, format, disabled, track, onCommit }: SliderProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const drafting = useRef(false);
  const shown = draft ?? value;

  function finish(next: number): void {
    if (!drafting.current) {
      return;
    }
    drafting.current = false;
    setDraft(null);
    if (next !== value) {
      onCommit(next);
    }
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className={`flex items-center justify-between ${label}`}>
        <span>{name}</span>
        <span className="font-numeric tracking-normal normal-case text-ink">
          {draft !== null ? <span className="text-ink-ghost">{format(draft)}</span> : value === null ? "—" : format(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown ?? min}
        disabled={disabled}
        aria-label={name}
        aria-valuetext={shown === null ? "No reading" : format(shown)}
        onPointerDown={() => {
          drafting.current = true;
          setDraft(value);
        }}
        onKeyDown={() => {
          drafting.current = true;
        }}
        onChange={(event) => {
          if (drafting.current) {
            setDraft(Number(event.target.value));
          }
        }}
        onPointerUp={(event) => finish(Number(event.currentTarget.value))}
        onKeyUp={(event) => finish(Number(event.currentTarget.value))}
        onBlur={(event) => {
          if (draft !== null) {
            finish(Number(event.currentTarget.value));
          }
        }}
        className={`${thumb} ${shown === null ? "[&::-webkit-slider-thumb]:opacity-0" : ""}`}
        style={{ background: track ?? "linear-gradient(90deg, var(--sage-fill), var(--sage))" }}
      />
    </label>
  );
}

export type ChoiceRowProps<T extends string | number> = {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  /** The confirmed choice, or null when none is reported. */
  current: T | null;
  disabled: boolean;
  onPick: (value: T) => void;
};

/** A row of chips; the confirmed one is pressed. */
export function ChoiceRow<T extends string | number>({ label: name, options, current, disabled, onPick }: ChoiceRowProps<T>) {
  if (options.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>{name}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = option.value === current;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => {
                if (!on) {
                  onPick(option.value);
                }
              }}
              className={`rounded-full border px-2.5 py-1 text-[12px] transition-[border-color,background-color,color] duration-slow ease-dadi disabled:cursor-default disabled:opacity-50 ${
                on ? "border-sage bg-sage-active text-sage-deep" : "border-[var(--glass-border)] text-ink-muted hover:border-sage-line"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type ActionsProps = {
  actions: ReadonlyArray<{ label: string; primary?: boolean; onPress: () => void }>;
  disabled: boolean;
};

/** A row of command buttons. */
export function Actions({ actions, disabled }: ActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={action.onPress}
          className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] transition-[border-color,background-color] duration-slow ease-dadi disabled:cursor-default disabled:opacity-45 ${
            action.primary
              ? "border-sage-deep bg-sage-deep text-bone hover:bg-sage"
              : "border-sage-line text-sage-deep hover:border-sage hover:bg-sage-active"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export type ReadoutsProps = {
  /** Label and value pairs; a null value is left out. */
  rows: ReadonlyArray<readonly [string, string | null]>;
};

/** Readings in a small grid, label over value. */
export function Readouts({ rows }: ReadoutsProps) {
  const shown = rows.filter((row): row is readonly [string, string] => row[1] !== null);
  if (shown.length === 0) {
    return null;
  }
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-3 gap-y-2.5">
      {shown.map(([name, value]) => (
        <div key={name} className="flex min-w-0 flex-col gap-0.5">
          <dt className={`truncate ${label}`}>{name}</dt>
          <dd className="m-0 truncate font-numeric text-[14px] font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A quiet note under the controls. */
export function Note({ children }: { children: string }) {
  return <p className="m-0 text-[11.5px] leading-snug text-ink-ghost">{children}</p>;
}

/** CSS custom properties for a form, typed for React's style prop. */
export function vars(values: Record<string, string | number>): CSSProperties {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) as CSSProperties;
}
