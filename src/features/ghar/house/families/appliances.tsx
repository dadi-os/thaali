/**
 * Appliances: a robot vacuum orbiting its room, a cycle ring around a turning drum for laundry
 * and dishes, cabinets frosted by their cold, and an oven's rings warming with its heat.
 */

import type { GharDevice } from "../../../../types/ghar";
import {
  Actions,
  capability,
  choices,
  ChoiceRow,
  num,
  Readouts,
  Slider,
  str,
  vars,
  words,
  type ControlsProps,
  type Family,
} from "./kit";

/** The longest cycle the ring is drawn against when a device gives no total. */
const CYCLE_SECONDS = 3 * 60 * 60;

function OrbitForm() {
  return (
    <span className="ghar-orbit">
      <span className="ghar-orbit__dock" />
      <span className="ghar-orbit__arm">
        <span className="ghar-orbit__bot" />
      </span>
    </span>
  );
}

function CycleForm() {
  return (
    <span className="ghar-cycle">
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle className="ghar-cycle__track" cx="32" cy="32" r="29" />
        <circle className="ghar-cycle__done" cx="32" cy="32" r="29" />
      </svg>
      <span className="ghar-cycle__drum" />
    </span>
  );
}

function FridgeForm() {
  return (
    <span className="ghar-fridge">
      <span />
    </span>
  );
}

function HobForm() {
  return (
    <span className="ghar-hob">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Minutes left on a cycle, or null when the device does not count down. */
function minutesLeft(device: GharDevice): number | null {
  const seconds = num(device, "countdown_s");
  return seconds === null ? null : Math.ceil(seconds / 60);
}

/** The mode picker for a device with the `mode` capability. */
function ModeRow({ device, pending, send }: ControlsProps) {
  const modes = choices(capability(device, "mode"), "modes");
  const current = modes.find((mode) => mode.label === str(device, "mode"))?.id ?? null;
  return (
    <ChoiceRow
      label="Mode"
      options={modes.map((mode) => ({ value: mode.id, label: mode.label }))}
      current={current}
      disabled={pending || !device.online}
      onPick={(mode) => send({ capability: "mode", command: "change_to", params: { mode } })}
    />
  );
}

function VacuumControls(props: ControlsProps) {
  const { device, pending, send } = props;
  const config = capability(device, "rvc");
  const state = str(device, "operational_state");
  const cleanModes = choices(config, "clean_modes");
  const areas = choices(config, "areas");
  const cleanMode = cleanModes.find((mode) => mode.label === str(device, "clean_mode"))?.id ?? null;
  const area = areas.find((choice) => choice.label === str(device, "area"))?.id ?? null;
  const disabled = pending || !device.online;
  const battery = num(device, "battery");
  return (
    <>
      <Actions
        disabled={disabled}
        actions={[
          ...(state === "running" ? [{ label: "Pause", onPress: () => send({ capability: "rvc", command: "pause" }) }] : []),
          { label: "Send home", onPress: () => send({ capability: "rvc", command: "go_home" }) },
        ]}
      />
      <ChoiceRow
        label="Clean mode"
        options={cleanModes.map((mode) => ({ value: mode.id, label: mode.label }))}
        current={cleanMode}
        disabled={disabled}
        onPick={(mode) => send({ capability: "rvc", command: "set_clean_mode", params: { mode } })}
      />
      <ChoiceRow
        label="Area"
        options={areas.map((choice) => ({ value: choice.id, label: choice.label }))}
        current={area}
        disabled={disabled}
        onPick={(id) => send({ capability: "rvc", command: "select_areas", params: { areas: [id] } })}
      />
      <Readouts
        rows={[
          ["State", state === null ? null : words(state)],
          ["Battery", battery === null ? null : `${Math.round(battery)}%`],
        ]}
      />
    </>
  );
}

function CycleControls(props: ControlsProps) {
  const { device, pending, send } = props;
  const state = str(device, "operational_state");
  const phase = str(device, "phase");
  const left = minutesLeft(device);
  const disabled = pending || !device.online;
  return (
    <>
      <Actions
        disabled={disabled}
        actions={[
          ...(state === "running" ? [{ label: "Pause", onPress: () => send({ capability: "appliance", command: "pause" }) }] : []),
          ...(state === "running" || state === "paused"
            ? [{ label: "Stop", onPress: () => send({ capability: "appliance", command: "stop" }) }]
            : []),
        ]}
      />
      <ModeRow {...props} />
      <Readouts
        rows={[
          ["State", state === null ? null : words(state)],
          ["Phase", phase],
          ["Left", left === null ? null : `${left} min`],
        ]}
      />
    </>
  );
}

/** Target temperature control for fridges and ovens, in degrees or in the device's own levels. */
function TemperatureControl({ device, pending, send }: ControlsProps) {
  const config = capability(device, "temperature_control");
  if (!config) {
    return null;
  }
  const disabled = pending || !device.online;
  if (config.numeric === true && typeof config.min === "number" && typeof config.max === "number") {
    return (
      <Slider
        label="Set to"
        min={config.min}
        max={config.max}
        step={typeof config.step === "number" ? config.step : 1}
        value={num(device, "target_temperature")}
        format={(value) => `${value}°C`}
        disabled={disabled}
        track="linear-gradient(90deg, var(--tide), var(--clay))"
        onCommit={(celsius) => send({ capability: "temperature_control", command: "set", params: { celsius } })}
      />
    );
  }
  const levels = Array.isArray(config.levels) ? config.levels.filter((item): item is string => typeof item === "string") : [];
  const level = str(device, "temperature_level");
  return (
    <ChoiceRow
      label="Level"
      options={levels.map((level, index) => ({ value: index, label: level }))}
      current={level === null ? null : levels.indexOf(level)}
      disabled={disabled}
      onPick={(level) => send({ capability: "temperature_control", command: "set", params: { level } })}
    />
  );
}

function FridgeControls(props: ControlsProps) {
  const temperature = num(props.device, "temperature");
  return (
    <>
      <TemperatureControl {...props} />
      <ModeRow {...props} />
      <Readouts rows={[["Inside", temperature === null ? null : `${temperature.toFixed(1)}°C`]]} />
    </>
  );
}

function OvenControls(props: ControlsProps) {
  const { device, pending, send } = props;
  const state = str(device, "operational_state");
  const temperature = num(device, "temperature");
  return (
    <>
      {state === "running" ? (
        <Actions
          disabled={pending || !device.online}
          actions={[{ label: "Stop", onPress: () => send({ capability: "appliance", command: "stop" }) }]}
        />
      ) : null}
      <ModeRow {...props} />
      <TemperatureControl {...props} />
      <Readouts
        rows={[
          ["State", state === null ? null : words(state)],
          ["Inside", temperature === null ? null : `${Math.round(temperature)}°C`],
        ]}
      />
    </>
  );
}


export const vacuum: Family = {
  label: () => "Robot vacuum",
  Form: OrbitForm,
  reading: (device) => {
    const state = str(device, "operational_state");
    const area = str(device, "area");
    const battery = num(device, "battery");
    if (state === null) {
      return "No reading yet";
    }
    if (state === "running") {
      return area === null ? "Cleaning" : `Cleaning · ${area}`;
    }
    return battery === null ? words(state) : `${words(state)} · ${Math.round(battery)}%`;
  },
  tone: (device) => ({
    run: device.online && str(device, "operational_state") === "running",
    alert: device.online && str(device, "operational_state") === "error",
  }),
  primary: () => null,
  Controls: VacuumControls,
};

export const cycle: Family = {
  label: (device) => (device.kind === "dishwasher" ? "Dishwasher" : device.kind === "dryer" ? "Dryer" : "Washer"),
  Form: CycleForm,
  style: (device) => {
    const seconds = num(device, "countdown_s");
    const running = str(device, "operational_state") === "running";
    return vars({ "--ghar-level": running && seconds !== null ? Math.max(0, 1 - seconds / CYCLE_SECONDS) : 0 });
  },
  reading: (device) => {
    const state = str(device, "operational_state");
    const phase = str(device, "phase");
    const left = minutesLeft(device);
    if (state === null) {
      return str(device, "mode") ?? "No reading yet";
    }
    if (state !== "running") {
      return words(state);
    }
    return [phase, left === null ? null : `${left} min`].filter((part): part is string => part !== null).join(" · ") || "Running";
  },
  tone: (device) => ({
    run: device.online && str(device, "operational_state") === "running",
    on: device.online && str(device, "operational_state") === "running",
    alert: device.online && str(device, "operational_state") === "error",
  }),
  primary: () => null,
  Controls: CycleControls,
};

export const fridge: Family = {
  label: (device) => (device.kind === "cabinet" ? "Cold cabinet" : "Refrigerator"),
  Form: FridgeForm,
  style: (device) => {
    const temperature = num(device, "temperature");
    return vars({ "--ghar-level": temperature === null ? 0 : Math.min(1, Math.max(0.2, (10 - temperature) / 30)) });
  },
  reading: (device) => {
    const temperature = num(device, "temperature");
    const mode = str(device, "mode");
    if (temperature !== null) {
      return `${temperature.toFixed(1)}°`;
    }
    return mode ?? "No reading yet";
  },
  tone: () => ({}),
  primary: () => null,
  Controls: FridgeControls,
};

export const oven: Family = {
  label: (device) => (device.kind === "microwave" ? "Microwave" : device.kind === "cooktop" ? "Cooktop" : "Oven"),
  Form: HobForm,
  style: (device) => vars({ "--ghar-level": Math.min(1, Math.max(0, (num(device, "temperature") ?? 0) / 250)) }),
  reading: (device) => {
    const state = str(device, "operational_state");
    const mode = str(device, "mode");
    const temperature = num(device, "temperature");
    if (state !== "running") {
      return mode === null ? "Off" : `Off · ${mode}`;
    }
    return [mode, temperature === null ? null : `${Math.round(temperature)}°`].filter((part): part is string => part !== null).join(" · ") || "On";
  },
  tone: (device) => ({ on: device.online && str(device, "operational_state") === "running" }),
  primary: () => null,
  Controls: OvenControls,
};
