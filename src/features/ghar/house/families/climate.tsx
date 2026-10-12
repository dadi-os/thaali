/** Thermostats, air conditioners and heat pumps: an arc to the setpoint, clay while heating, tide while cooling. */

import type { GharDevice } from "../../../../types/ghar";
import { capability, ChoiceRow, num, Readouts, str, vars, words, type ControlsProps, type Family } from "./kit";

/** The dial spans 10–32 °C. */
const DIAL_MIN = 10;
const DIAL_SPAN = 22;
/** One press of − or + moves the setpoint this far. */
const STEP_C = 0.5;

const degrees = (value: number) => `${value.toFixed(1)}°`;

/** Where a temperature sits on the dial, 0–1. */
function onDial(celsius: number): number {
  return Math.min(1, Math.max(0, (celsius - DIAL_MIN) / DIAL_SPAN));
}

/** The setpoint the device is working toward: cooling's while it cools or is set to cool, else heating's. */
function setpoint(device: GharDevice): { celsius: number; side: "heat" | "cool" } | null {
  const mode = str(device, "system_mode");
  const running = str(device, "running");
  const cool = num(device, "cool_setpoint");
  const heat = num(device, "heat_setpoint");
  if (cool !== null && (mode === "cool" || running === "cooling" || heat === null)) {
    return { celsius: cool, side: "cool" };
  }
  return heat === null ? null : { celsius: heat, side: "heat" };
}

/** The color of what the system is doing: clay heating, tide cooling, sage otherwise. */
function climateColor(device: GharDevice): string {
  const running = str(device, "running");
  return running === "heating" ? "var(--clay)" : running === "cooling" ? "var(--tide)" : "var(--sage)";
}

export type DialProps = {
  device: GharDevice;
  /** The inspector's larger dial. */
  large?: boolean;
};

/** The arc to the setpoint with a marker at the room's temperature, over the reading. */
export function Dial({ device, large = false }: DialProps) {
  const now = num(device, "temperature");
  const target = setpoint(device);
  const off = str(device, "system_mode") === "off";
  return (
    <span className={`ghar-dial ${large ? "ghar-dial--large" : ""}`}>
      <svg viewBox="0 0 80 80" aria-hidden>
        <circle className="ghar-dial__track" cx="40" cy="40" r="32" />
        <circle className="ghar-dial__value" cx="40" cy="40" r="32" />
        {now !== null ? (
          <circle
            className="ghar-dial__now"
            cx="40"
            cy="8"
            r="3.2"
            style={{ transform: `rotate(${-135 + onDial(now) * 270}deg)` }}
          />
        ) : null}
      </svg>
      <span className="ghar-dial__text">
        <b className={`font-numeric font-medium tracking-tight ${large ? "text-[26px]" : "text-[17px]"}`}>
          {now === null ? "—" : degrees(now)}
        </b>
        <small className={`font-numeric text-ink-faint ${large ? "text-[11px]" : "text-[9.5px]"}`}>
          {off ? "off" : target ? `→ ${degrees(target.celsius)}` : ""}
        </small>
      </span>
    </span>
  );
}

function DialForm({ device }: { device: GharDevice }) {
  return (
    <>
      <span aria-hidden className="ghar-aura" />
      <Dial device={device} />
    </>
  );
}

/** The system modes a thermostat offers, from what it can do. */
function modes(device: GharDevice): string[] {
  const config = capability(device, "thermostat");
  return [
    "off",
    ...(config?.heat === true ? ["heat"] : []),
    ...(config?.cool === true ? ["cool"] : []),
    ...(config?.auto === true ? ["auto"] : []),
    ...(device.kind === "air_conditioner" ? ["fan_only", "dry"] : []),
  ];
}

function ClimateControls({ device, pending, send }: ControlsProps) {
  const target = setpoint(device);
  const disabled = pending || !device.online || target === null;
  const humidity = num(device, "humidity");
  const running = str(device, "running");
  function step(delta: number): void {
    if (!target) {
      return;
    }
    const celsius = Math.round((target.celsius + delta) * 10) / 10;
    send({
      capability: "thermostat",
      command: "set_setpoint",
      params: target.side === "cool" ? { cool_c: celsius } : { heat_c: celsius },
    });
  }
  const round =
    "grid size-9 place-items-center rounded-full border border-sage-line text-[17px] text-sage-deep transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active disabled:opacity-40";
  return (
    <>
      <div className="flex items-center justify-center gap-4">
        <button type="button" aria-label="Lower the setpoint" disabled={disabled} onClick={() => step(-STEP_C)} className={round}>
          −
        </button>
        <span className={`ghar-tile ${str(device, "running") !== "idle" ? "ghar-tile--run" : ""}`} style={dialStyle(device)}>
          <Dial device={device} large />
        </span>
        <button type="button" aria-label="Raise the setpoint" disabled={disabled} onClick={() => step(STEP_C)} className={round}>
          +
        </button>
      </div>
      <ChoiceRow
        label="Mode"
        options={modes(device).map((value) => ({ value, label: words(value) }))}
        current={str(device, "system_mode")}
        disabled={pending || !device.online}
        onPick={(mode) => send({ capability: "thermostat", command: "set_mode", params: { mode } })}
      />
      <Readouts
        rows={[
          ["Running", running === null ? null : words(running)],
          ["Humidity", humidity === null ? null : `${Math.round(humidity)}%`],
        ]}
      />
    </>
  );
}

function dialStyle(device: GharDevice) {
  const target = setpoint(device);
  return vars({
    "--ghar-arc": str(device, "system_mode") === "off" || !target ? 0 : onDial(target.celsius),
    "--ghar-climate": climateColor(device),
  });
}


export const climate: Family = {
  label: (device) =>
    device.kind === "air_conditioner"
      ? "Air conditioner"
      : device.kind === "heat_pump"
        ? "Heat pump"
        : device.kind === "water_heater"
          ? "Water heater"
          : "Thermostat",
  Form: DialForm,
  style: dialStyle,
  reading: (device) => {
    const running = str(device, "running");
    const target = setpoint(device);
    if (str(device, "system_mode") === "off") {
      return "Off";
    }
    if (running === "heating" || running === "cooling") {
      return words(running);
    }
    return target ? `Holding ${degrees(target.celsius)}` : "No reading yet";
  },
  tone: (device) => {
    const running = str(device, "running");
    return { run: device.online && running !== null && running !== "idle" && str(device, "system_mode") !== "off" };
  },
  primary: () => null,
  Controls: ClimateControls,
};
