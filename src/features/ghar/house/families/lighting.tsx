/** Lights: a pool of each lamp's own color, as wide and strong as its brightness, around its fixture. */

import type { GharDevice } from "../../../../types/ghar";
import { isLit, kelvinRgb, lampColor, lampLevel, PLAIN_LAMP } from "../light";
import { capability, has, num, PowerRow, Slider, vars, type ControlsProps, type Family } from "./kit";

/** Matter hue and saturation (0–254) as CSS degrees and percent. */
const hueDeg = (hue: number) => Math.round((hue / 254) * 360);
const satPct = (saturation: number) => Math.round((saturation / 254) * 100);

/** Saturation sent with a new hue before the lamp has reported its own: full color. */
const FULL_SATURATION = 254;

/** The CSS color of a white at `kelvin`. */
function white(kelvin: number): string {
  const [r, g, b] = kelvinRgb(kelvin);
  return `rgb(${r} ${g} ${b})`;
}

/** The color modes a light advertises. */
function colorModes(device: GharDevice): string[] {
  const modes = capability(device, "color")?.modes;
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === "string") : [];
}

function LampForm({ device }: { device: GharDevice }) {
  return (
    <>
      <span aria-hidden className="ghar-tile__pool" />
      <LampFixture device={device} size="bulb" />
    </>
  );
}

export type LampFixtureProps = {
  device: GharDevice;
  /** `dot` in a home tile row, `bulb` at the heart of a light's pool. */
  size: "dot" | "bulb";
  /** A command for it is in flight: it keeps its last reading and breathes. */
  pending?: boolean;
};

/** A light's fixture: a ring when off, a glowing bead of its own color when on, dashed when offline. */
export function LampFixture({ device, size, pending = false }: LampFixtureProps) {
  const lit = isLit(device);
  return (
    <span
      aria-hidden
      className={`ghar-fixture ghar-fixture--${size} ${lit ? "ghar-fixture--lit" : ""} ${
        device.online ? "" : "ghar-fixture--offline"
      } ${pending ? "animate-breath" : ""}`}
      style={lit ? lampVars(device) : undefined}
    />
  );
}

/** The custom properties a lit lamp draws with: its color and its level, 0–1. */
export function lampVars(device: GharDevice) {
  return vars({ "--lamp": lampColor(device) ?? PLAIN_LAMP, "--lamp-level": lampLevel(device), "--ghar-level": lampLevel(device) });
}

function LightControls({ device, pending, send }: ControlsProps) {
  const on = device.state.on?.value === true;
  const modes = colorModes(device);
  const hue = num(device, "hue");
  const saturation = num(device, "saturation");
  const disabled = pending || !device.online;
  return (
    <>
      <PowerRow
        name={`${device.name} power`}
        on={on}
        status={on ? "On" : "Off"}
        disabled={disabled}
        onToggle={() => send({ capability: "on_off", command: "toggle" })}
      />
      {has(device, "level") ? (
        <Slider
          label="Brightness"
          min={1}
          max={100}
          value={num(device, "brightness")}
          format={(value) => `${Math.round(value)}%`}
          disabled={disabled}
          track="linear-gradient(90deg, var(--bone), var(--sage))"
          onCommit={(level) => send({ capability: "level", command: "move_to", params: { level: Math.round(level) } })}
        />
      ) : null}
      {modes.includes("color_temp") ? (
        <Slider
          label="White"
          min={153}
          max={500}
          value={num(device, "color_temp")}
          format={(mireds) => `${Math.round(1_000_000 / mireds)}K`}
          disabled={disabled}
          track={`linear-gradient(90deg, ${white(6500)}, ${white(2000)})`}
          onCommit={(mireds) => send({ capability: "color", command: "temperature", params: { mireds: Math.round(mireds) } })}
        />
      ) : null}
      {modes.includes("hue_sat") ? (
        <>
          <Slider
            label="Color"
            min={0}
            max={254}
            value={hue}
            format={(value) => `${hueDeg(value)}°`}
            disabled={disabled}
            track="linear-gradient(90deg, #ff4d4d, #ffd60a, #34c759, #32ade6, #7a5cff, #ff4d4d)"
            onCommit={(next) =>
              send({
                capability: "color",
                command: "hue_saturation",
                params: { hue: Math.round(next), saturation: Math.round(saturation ?? FULL_SATURATION) },
              })
            }
          />
          <Slider
            label="Saturation"
            min={0}
            max={254}
            value={saturation}
            format={(value) => `${satPct(value)}%`}
            disabled={disabled}
            track={`linear-gradient(90deg, #c8c2b8, hsl(${hueDeg(hue ?? 0)} 90% 55%))`}
            onCommit={(next) =>
              send({
                capability: "color",
                command: "hue_saturation",
                params: { hue: Math.round(hue ?? 0), saturation: Math.round(next) },
              })
            }
          />
        </>
      ) : null}
    </>
  );
}

export const light: Family = {
  label: (device) => {
    const modes = colorModes(device);
    return `Light · ${
      modes.includes("hue_sat") ? "Color" : modes.includes("color_temp") ? "White tones" : has(device, "level") ? "Dimmable" : "On/off"
    }`;
  },
  Form: LampForm,
  style: lampVars,
  reading: (device) => {
    if (!isLit(device)) {
      return "Off";
    }
    const brightness = num(device, "brightness");
    return has(device, "level") && brightness !== null ? `${Math.round(brightness)}%` : "On";
  },
  tone: (device) => ({ on: isLit(device) }),
  primary: () => ({ capability: "on_off", command: "toggle" }),
  Controls: LightControls,
};
