/**
 * Sensors and buttons: a disc of the light a sensor reads, a capsule filled to the humidity and
 * tinted by the temperature, isobars, moving water, motes of air, and a bead per button.
 */

import type { GharDevice } from "../../../../types/ghar";
import { capability, changedAt, num, Readouts, since, str, vars, words, type ControlsProps, type Family } from "./kit";

/** Humidity at which a room is worth a look. */
export const HUMID_PERCENT = 70;

/** The concentrations an air monitor may report, with their labels. */
const CONCENTRATIONS = [
  ["pm25", "PM2.5"],
  ["pm10", "PM10"],
  ["pm1", "PM1"],
  ["co2", "CO₂"],
  ["co", "CO"],
  ["no2", "NO₂"],
  ["o3", "O₃"],
  ["tvoc", "VOC"],
  ["formaldehyde", "HCHO"],
  ["radon", "Radon"],
] as const;

/** Air quality tiers that are worth a look. */
const POOR_AIR = new Set(["poor", "very_poor", "extremely_poor"]);

/** How warm a reading draws, 0–1 from 16 °C to 26 °C; unreported reads cool. */
function warmth(celsius: number | null): number {
  return celsius === null ? 0 : Math.min(1, Math.max(0, (celsius - 16) / 10));
}

function SunForm() {
  return <span className="ghar-sun" />;
}

function CapsuleForm() {
  return (
    <span className="ghar-capsule">
      <span />
    </span>
  );
}

function IsobarForm() {
  return (
    <span className="ghar-isobars">
      <i />
      <i />
      <i />
    </span>
  );
}

function StreamForm() {
  return (
    <span className="ghar-stream">
      <i />
      <i />
      <i />
    </span>
  );
}

function MotesForm() {
  return (
    <span className="ghar-motes">
      {Array.from({ length: 18 }, (_, n) => {
        const angle = n * 2.399;
        const radius = 6 + (n % 6) * 4.4;
        return (
          <i
            key={n}
            style={vars({
              "--n": n,
              left: `${32 + Math.cos(angle) * radius - 2}px`,
              top: `${32 + Math.sin(angle) * radius - 2}px`,
            })}
          />
        );
      })}
    </span>
  );
}

/** The last press a button reported, from its `button` event. */
function lastPress(device: GharDevice): { action: string; position: number | null; count: number | null } | null {
  const value = device.state.button?.value;
  if (typeof value !== "object" || value === null || !("action" in value) || typeof value.action !== "string") {
    return null;
  }
  return {
    action: value.action,
    position: "position" in value && typeof value.position === "number" ? value.position : null,
    count: "count" in value && typeof value.count === "number" ? value.count : null,
  };
}

/** A press in words: "Double press · button 2". */
function pressWords(press: NonNullable<ReturnType<typeof lastPress>>): string {
  const what =
    press.action === "long_press"
      ? "Long press"
      : press.action === "multi_press" && press.count !== null && press.count > 1
        ? press.count === 2
          ? "Double press"
          : `${press.count} presses`
        : press.action === "latched"
          ? "Switched"
          : "Press";
  return press.position === null ? what : `${what} · button ${press.position + 1}`;
}

function KeysForm({ device }: { device: GharDevice }) {
  const positions = capability(device, "button")?.positions;
  const count = typeof positions === "number" && positions > 1 ? Math.min(positions, 6) : 1;
  const press = lastPress(device);
  return (
    <span className="ghar-keys">
      {Array.from({ length: count }, (_, index) => (
        <i
          key={`${index}-${device.state.button?.changed_at ?? ""}`}
          data-last={press?.position === index ? "" : undefined}
        />
      ))}
    </span>
  );
}

/** Air in a few words: its tier, else its fine particulates. */
function airReading(device: GharDevice): string {
  const tier = str(device, "air_quality");
  const pm25 = num(device, "pm25");
  if (tier !== null && tier !== "unknown") {
    return pm25 === null ? words(tier) : `${words(tier)} · PM2.5 ${Math.round(pm25)}`;
  }
  return pm25 === null ? "No reading yet" : `PM2.5 ${Math.round(pm25)}`;
}

function SensorReadouts({ device }: ControlsProps) {
  const units = capability(device, "sensor")?.units;
  const unit = (key: string) =>
    typeof units === "object" && units !== null && key in units ? ` ${String((units as Record<string, unknown>)[key])}` : "";
  const temperature = num(device, "temperature");
  const humidity = num(device, "humidity");
  const lux = num(device, "illuminance");
  const pressure = num(device, "pressure");
  const flow = num(device, "flow");
  const tier = str(device, "air_quality");
  return (
    <Readouts
      rows={[
        ["Temperature", temperature === null ? null : `${temperature.toFixed(1)}°C`],
        ["Humidity", humidity === null ? null : `${Math.round(humidity)}%`],
        ["Light", lux === null ? null : `${lux.toLocaleString()} lx`],
        ["Pressure", pressure === null ? null : `${pressure.toFixed(1)} kPa`],
        ["Flow", flow === null ? null : `${flow} m³/h`],
        ["Air", tier === null ? null : words(tier)],
        ...CONCENTRATIONS.map(([key, name]): readonly [string, string | null] => {
          const value = num(device, key);
          return [name, value === null ? null : `${value}${unit(key)}`];
        }),
      ]}
    />
  );
}

function ButtonControls({ device }: ControlsProps) {
  const press = lastPress(device);
  const at = changedAt(device, "button");
  return (
    <Readouts
      rows={[
        ["Last press", press === null ? null : pressWords(press)],
        ["When", at === null ? null : `${since(at)} ago`],
      ]}
    />
  );
}

export const lightSensor: Family = {
  label: () => "Light sensor",
  Form: SunForm,
  style: (device) => vars({ "--ghar-level": Math.min(1, Math.log10((num(device, "illuminance") ?? 0) + 1) / 4.5) }),
  reading: (device) => {
    const lux = num(device, "illuminance");
    return lux === null ? "No reading yet" : `${lux.toLocaleString()} lx`;
  },
  tone: () => ({}),
  primary: () => null,
  Controls: SensorReadouts,
};

export const climateSensor: Family = {
  label: (device) => (num(device, "humidity") !== null && num(device, "temperature") !== null ? "Temperature and humidity" : device.kind === "humidity" ? "Humidity sensor" : "Temperature sensor"),
  Form: CapsuleForm,
  style: (device) =>
    vars({
      "--ghar-level": (num(device, "humidity") ?? 0) / 100,
      "--ghar-warm": warmth(num(device, "temperature")),
    }),
  reading: (device) => {
    const temperature = num(device, "temperature");
    const humidity = num(device, "humidity");
    const parts = [
      temperature === null ? null : `${temperature.toFixed(1)}°`,
      humidity === null ? null : `${Math.round(humidity)}%`,
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(" · ") : "No reading yet";
  },
  tone: (device) => ({ alert: device.online && (num(device, "humidity") ?? 0) >= HUMID_PERCENT }),
  primary: () => null,
  Controls: SensorReadouts,
};

export const pressure: Family = {
  label: () => "Pressure sensor",
  Form: IsobarForm,
  reading: (device) => {
    const value = num(device, "pressure");
    return value === null ? "No reading yet" : `${value.toFixed(1)} kPa`;
  },
  tone: () => ({}),
  primary: () => null,
  Controls: SensorReadouts,
};

export const flow: Family = {
  label: () => "Flow sensor",
  Form: StreamForm,
  style: (device) => vars({ "--ghar-spin": `${(2 - Math.min(1.6, (num(device, "flow") ?? 0) / 2)).toFixed(2)}s` }),
  reading: (device) => {
    const value = num(device, "flow");
    return value === null ? "No reading yet" : `${value} m³/h`;
  },
  tone: (device) => ({ on: device.online && (num(device, "flow") ?? 0) > 0 }),
  primary: () => null,
  Controls: SensorReadouts,
};

export const air: Family = {
  label: () => "Air quality",
  Form: MotesForm,
  style: (device) => {
    const tier = str(device, "air_quality");
    return vars({
      "--ghar-level": Math.min(1, Math.max(0.08, (num(device, "pm25") ?? 0) / 60)),
      "--ghar-air": tier !== null && POOR_AIR.has(tier) ? "var(--error)" : tier === "fair" || tier === "moderate" ? "var(--clay)" : "var(--sage-deep)",
    });
  },
  reading: airReading,
  tone: (device) => {
    const tier = str(device, "air_quality");
    return { alert: device.online && tier !== null && POOR_AIR.has(tier) };
  },
  primary: () => null,
  Controls: SensorReadouts,
};

export const button: Family = {
  label: (device) => {
    const positions = capability(device, "button")?.positions;
    return typeof positions === "number" && positions > 1 ? `Switch · ${positions} buttons` : "Switch";
  },
  Form: KeysForm,
  reading: (device) => {
    const press = lastPress(device);
    const at = changedAt(device, "button");
    return press === null ? "No presses yet" : at ? `${pressWords(press)} · ${since(at)}` : pressWords(press);
  },
  tone: () => ({}),
  primary: () => null,
  Controls: ButtonControls,
};
