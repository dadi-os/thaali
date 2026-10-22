/**
 * A tile's controls in a glass sheet, as on the phone: a tall Control Center–style
 * brightness pill beside the power button, then warmth and color as gradient sliders. Other
 * devices show their family's own controls. Values follow the pointer while dragging and are
 * sent on release; the last confirmed reading shows otherwise.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import type { GharCommand, GharDevice } from "../../../types/ghar";
import { IconPower } from "../../../shared/components/IconButton";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import { roomTitle } from "../commission";
import { familyOf } from "../house/families";
import { capability, has, num } from "../house/families/kit";
import { kelvinRgb } from "../house/light";
import { IconSun } from "./icons";
import { pillLevel, tileGlow, tileOn, trackValue } from "./style";

/** Matter mireds a white light spans, coolest to warmest. */
const MIREDS = { min: 153, max: 500 } as const;

/** Matter hue range (0–254). */
const HUE = { min: 0, max: 254 } as const;

/** Saturation sent with a new hue before the lamp has reported its own: full color. */
const FULL_SATURATION = 254;

/** The color modes a light advertises. */
function colorModes(device: GharDevice): string[] {
  const modes = capability(device, "color")?.modes;
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === "string") : [];
}

function white(kelvin: number): string {
  const [r, g, b] = kelvinRgb(kelvin);
  return `rgb(${r} ${g} ${b})`;
}

export interface DeviceSheetProps {
  device: GharDevice;
  /** A command for the device is in flight. */
  pending: boolean;
  /** Ghar's last refusal for this device, shown under the controls. */
  error: string | null;
  send: (command: GharCommand) => void;
  onClose: () => void;
}

/** The glass sheet over the tiles; the backdrop, Escape and Done close it. */
export function DeviceSheet({ device, pending, error, send, onClose }: DeviceSheetProps) {
  const lamp = device.kind === "light";
  const on = tileOn(device);
  const modes = colorModes(device);
  const disabled = pending || !device.online;
  const { Controls } = familyOf(device);
  const subtitle = [roomTitle(device.room.name), device.product_name].filter(Boolean).join(" · ");

  return (
    <motion.div
      className="frost-scrim absolute inset-0 z-30 flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${device.name} controls`}
        className="glass-card flex max-h-full w-[min(24rem,100%)] flex-col items-stretch gap-6 overflow-y-auto px-7 py-6"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", bounce: 0, duration: 0.32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="m-0 text-[18px] font-semibold text-ink">{device.name}</h2>
          {subtitle ? <p className="m-0 text-[12.5px] text-ink-muted">{subtitle}</p> : null}
        </div>

        {lamp ? (
          <>
            <div className="flex items-end justify-center gap-7">
              {has(device, "level") ? (
                <BrightnessPill
                  value={num(device, "brightness")}
                  glow={tileGlow(device)}
                  on={on}
                  disabled={disabled}
                  onCommit={(level) => send({ capability: "level", command: "move_to", params: { level } })}
                />
              ) : null}
              {has(device, "on_off") ? (
                <button
                  type="button"
                  autoFocus
                  disabled={disabled}
                  aria-pressed={on}
                  aria-label={`${device.name} power`}
                  onClick={() => send({ capability: "on_off", command: "toggle" })}
                  className={`flex size-16 items-center justify-center rounded-full transition-colors duration-[var(--slow)] disabled:opacity-50 ${
                    on ? "bg-sage-deep text-bone" : "border border-sage-line bg-bone/60 text-ink-muted"
                  }`}
                >
                  <span className="size-7 [&_svg]:size-full">
                    <IconPower />
                  </span>
                </button>
              ) : null}
            </div>
            {modes.includes("color_temp") ? (
              <GradientSlider
                label="Warmth"
                value={num(device, "color_temp")}
                min={MIREDS.min}
                max={MIREDS.max}
                track={`linear-gradient(90deg, ${white(6500)}, ${white(2000)})`}
                disabled={disabled}
                format={(mireds) => `${Math.round(1_000_000 / mireds)} K`}
                onCommit={(mireds) => send({ capability: "color", command: "temperature", params: { mireds } })}
              />
            ) : null}
            {modes.includes("hue_sat") ? (
              <GradientSlider
                label="Color"
                value={num(device, "hue")}
                min={HUE.min}
                max={HUE.max}
                track="linear-gradient(90deg, #ff4d4d, #ffd60a, #34c759, #32ade6, #7a5cff, #e34dff, #ff4d4d)"
                disabled={disabled}
                format={(hue) => `${Math.round((hue / 254) * 360)}°`}
                onCommit={(hue) =>
                  send({
                    capability: "color",
                    command: "hue_saturation",
                    params: { hue, saturation: Math.round(num(device, "saturation") ?? FULL_SATURATION) },
                  })
                }
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <Controls device={device} pending={pending} send={send} />
          </div>
        )}

        {error ? (
          <p role="alert" className="m-0 text-center text-[12.5px] leading-relaxed text-error select-text">
            {error}
          </p>
        ) : null}

        <button type="button" className="glass-button self-center" onClick={onClose}>
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}

/**
 * A value that follows the pointer while dragging and falls back to the device's reading
 * once the reading changes, so a sent value does not snap back before Ghar confirms it.
 */
function useDraft(confirmed: number | null): [number | null, (next: number | null) => void] {
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [confirmed]);
  return [draft ?? confirmed, setDraft];
}

type BrightnessPillProps = {
  /** Brightness 1–100, or null before the lamp has reported one. */
  value: number | null;
  glow: string;
  on: boolean;
  disabled: boolean;
  onCommit: (level: number) => void;
};

/** A tall pill that fills with the lamp's light as you drag it; arrow keys step by 10. */
function BrightnessPill({ value, glow, on, disabled, onCommit }: BrightnessPillProps) {
  const [shown, setShown] = useDraft(value);
  const dragging = useRef(false);
  const level = shown ?? 0;

  const at = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return pillLevel(e.clientY, rect.top, rect.height);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowUp" || e.key === "ArrowRight" ? 10 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -10 : 0;
    if (step === 0 || disabled) {
      return;
    }
    e.preventDefault();
    const next = Math.min(100, Math.max(1, level + step));
    setShown(next);
    onCommit(next);
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Brightness"
      aria-valuemin={1}
      aria-valuemax={100}
      aria-valuenow={Math.round(level)}
      aria-valuetext={`${Math.round(level)} percent`}
      aria-disabled={disabled}
      className={`ghar-pill ${disabled ? "opacity-60" : ""}`}
      style={{ "--glow": glow } as CSSProperties}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) {
          return;
        }
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setShown(at(e));
      }}
      onPointerMove={(e) => {
        if (dragging.current) {
          setShown(at(e));
        }
      }}
      onPointerUp={(e) => {
        if (!dragging.current) {
          return;
        }
        dragging.current = false;
        const next = at(e);
        setShown(next);
        onCommit(next);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setShown(null);
      }}
    >
      <span className={`ghar-pill__fill ${on ? "ghar-pill__fill--on" : ""}`} style={{ height: `${level}%` }} />
      <span className="ghar-pill__sun">
        <IconSun />
      </span>
      <span className="ghar-pill__value">{shown === null ? "–" : `${Math.round(level)}%`}</span>
    </div>
  );
}

type GradientSliderProps = {
  label: string;
  value: number | null;
  min: number;
  max: number;
  /** The CSS gradient drawn as the track. */
  track: string;
  disabled: boolean;
  format: (value: number) => string;
  onCommit: (value: number) => void;
};

/** A slider drawn as a gradient track with a glass thumb; arrow keys step a tenth. */
function GradientSlider({ label, value, min, max, track, disabled, format, onCommit }: GradientSliderProps) {
  const [shown, setShown] = useDraft(value);
  const dragging = useRef(false);
  const current = shown ?? min;
  const fraction = (current - min) / (max - min);

  const at = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return trackValue(e.clientX, rect.left + 15, rect.width - 30, min, max);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (direction === 0 || disabled) {
      return;
    }
    e.preventDefault();
    const next = Math.round(Math.min(max, Math.max(min, current + (direction * (max - min)) / 10)));
    setShown(next);
    onCommit(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] font-semibold text-ink-muted">{label}</span>
        <span className="font-numeric text-[11.5px] text-ink-ghost">{shown === null ? "–" : format(current)}</span>
      </div>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(current)}
        aria-valuetext={shown === null ? undefined : format(current)}
        aria-disabled={disabled}
        className={`ghar-track ${disabled ? "opacity-60" : ""}`}
        style={{ background: track }}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) {
            return;
          }
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setShown(at(e));
        }}
        onPointerMove={(e) => {
          if (dragging.current) {
            setShown(at(e));
          }
        }}
        onPointerUp={(e) => {
          if (!dragging.current) {
            return;
          }
          dragging.current = false;
          const next = at(e);
          setShown(next);
          onCommit(next);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setShown(null);
        }}
      >
        <span
          className="ghar-track__thumb"
          style={{ left: `calc(${shown === null ? 0.5 : fraction} * (100% - 30px))`, opacity: shown === null ? 0.5 : 1 }}
        />
      </div>
    </div>
  );
}
