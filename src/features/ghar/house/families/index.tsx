/**
 * Device families: the public face of how Ghar draws, reads and controls each kind of device,
 * and what in the house is worth a look.
 */

import type { GharDevice, GharKind } from "../../../../types/ghar";
import { contact, leak, lock, occupancy, smoke } from "./access";
import { cycle, fridge, oven, vacuum } from "./appliances";
import { climate } from "./climate";
import { cover, fan, valve } from "./covers";
import { meter, plug } from "./energy";
import { bool, num, vars, type Family } from "./kit";
import { light } from "./lighting";
import { camera, speaker, tv } from "./media";
import { air, button, climateSensor, flow, HUMID_PERCENT, lightSensor, pressure } from "./sensors";

export { LampFixture, lampVars } from "./lighting";
export type { ControlsProps, Family, Tone } from "./kit";

/** Battery level under which a device is worth a look. */
const LOW_BATTERY_PERCENT = 20;

/** Spokes drawn around a bridge's hub. */
const HUB_SPOKES = 4;

function HubForm() {
  return (
    <span className="ghar-hub">
      <b />
      {Array.from({ length: HUB_SPOKES }, (_, n) => (
        <i key={n} style={vars({ "--n": n })} />
      ))}
    </span>
  );
}

const bridge: Family = {
  label: () => "Bridge",
  Form: HubForm,
  reading: () => "Brings in other devices",
  tone: () => ({}),
  primary: () => null,
  Controls: () => null,
};

function PlainForm() {
  return <span className="ghar-plain" />;
}

/** A device Ghar has no family for: its plain ring, its power if it has one. */
const other: Family = {
  label: () => "Device",
  Form: PlainForm,
  reading: (device) => {
    const on = bool(device, "on");
    return on === null ? (device.product_name ?? "No reading yet") : on ? "On" : "Off";
  },
  tone: (device) => ({ on: device.online && bool(device, "on") === true }),
  primary: (device) => (bool(device, "on") === null ? null : { capability: "on_off", command: "toggle" }),
  Controls: () => null,
};

/** The family that draws each device kind. */
const FAMILY_BY_KIND: Record<GharKind, Family> = {
  light,
  plug,
  switch: button,
  cover,
  fan,
  air_purifier: fan,
  thermostat: climate,
  air_conditioner: climate,
  heat_pump: climate,
  water_heater: climate,
  lock,
  contact,
  occupancy,
  light_sensor: lightSensor,
  temperature: climateSensor,
  humidity: climateSensor,
  pressure,
  flow,
  leak,
  freeze: leak,
  rain: leak,
  air_quality: air,
  smoke_alarm: smoke,
  energy_meter: meter,
  solar: meter,
  battery_storage: meter,
  ev_charger: meter,
  valve,
  irrigation: valve,
  pump: valve,
  robot_vacuum: vacuum,
  washer: cycle,
  dryer: cycle,
  dishwasher: cycle,
  refrigerator: fridge,
  cabinet: fridge,
  oven,
  cooktop: oven,
  microwave: oven,
  extractor_hood: fan,
  speaker,
  tv,
  camera,
  doorbell: camera,
  bridge,
  other,
};

/** The family for a device. */
export function familyOf(device: GharDevice): Family {
  return FAMILY_BY_KIND[device.kind];
}

/** Something in the house worth a look: clay for a warning, the error color for now. */
export type Attention = { tone: "warn" | "error"; text: string };

/** Why a device is worth a look, or null when it is fine. */
export function attention(device: GharDevice): Attention | null {
  if (!device.online) {
    return { tone: "error", text: `${device.name} is offline` };
  }
  const tone = familyOf(device).tone(device);
  if (tone.danger) {
    return { tone: "error", text: `${device.name}: ${familyOf(device).reading(device)}` };
  }
  if (bool(device, "locked") === false) {
    return { tone: "warn", text: `${device.name} is unlocked` };
  }
  if (device.kind === "contact" && bool(device, "contact") === false) {
    return { tone: "warn", text: `${device.name} is open` };
  }
  const humidity = num(device, "humidity");
  if (humidity !== null && humidity >= HUMID_PERCENT) {
    return { tone: "warn", text: `${device.name} reads ${Math.round(humidity)}% humidity` };
  }
  if (tone.alert) {
    return { tone: "warn", text: `${device.name}: ${familyOf(device).reading(device)}` };
  }
  const battery = num(device, "battery");
  if (battery !== null && battery < LOW_BATTERY_PERCENT) {
    return { tone: "warn", text: `${device.name} battery at ${Math.round(battery)}%` };
  }
  if (bool(device, "reachable") === false) {
    return { tone: "error", text: `${device.name} is unreachable through its bridge` };
  }
  return null;
}
