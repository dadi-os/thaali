/**
 * Things that move air, light or water: a blind's slats over daylight, a fan's petals turning
 * with its speed, and a valve's gate across a pipe (a pump shares it).
 */

import type { GharDevice } from "../../../../types/ghar";
import { Actions, capability, ChoiceRow, has, num, PowerRow, Readouts, Slider, str, vars, words, type ControlsProps, type Family } from "./kit";

function WindowForm() {
  return (
    <>
      <span aria-hidden className="ghar-window__glow" />
      <span className="ghar-window">
        <span className="ghar-window__slats" />
      </span>
    </>
  );
}

function FanForm() {
  return (
    <span className="ghar-fan">
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}

function ValveForm() {
  return (
    <span className="ghar-valve">
      <span className="ghar-valve__pipe" />
      <span className="ghar-valve__gate">
        <i />
      </span>
    </span>
  );
}

function CoverControls({ device, pending, send }: ControlsProps) {
  const config = capability(device, "cover");
  const disabled = pending || !device.online;
  return (
    <>
      <Actions
        disabled={disabled}
        actions={[
          { label: "Open", onPress: () => send({ capability: "cover", command: "open" }) },
          { label: "Stop", onPress: () => send({ capability: "cover", command: "stop" }) },
          { label: "Close", onPress: () => send({ capability: "cover", command: "close" }) },
        ]}
      />
      {config?.lift === true ? (
        <Slider
          label="Open"
          min={0}
          max={100}
          value={num(device, "open_percent")}
          format={(value) => `${Math.round(value)}%`}
          disabled={disabled}
          track="linear-gradient(90deg, var(--sage-deep), var(--daylight))"
          onCommit={(value) =>
            send({ capability: "cover", command: "go_to_lift", params: { percent_open: Math.round(value) } })
          }
        />
      ) : null}
      {config?.tilt === true ? (
        <Slider
          label="Tilt"
          min={0}
          max={100}
          value={num(device, "tilt_percent")}
          format={(value) => `${Math.round(value)}%`}
          disabled={disabled}
          onCommit={(value) => send({ capability: "cover", command: "go_to_tilt", params: { percent: Math.round(value) } })}
        />
      ) : null}
    </>
  );
}

const FAN_MODES = ["off", "low", "medium", "high", "auto"] as const;

function FanControls({ device, pending, send }: ControlsProps) {
  const mode = str(device, "fan_mode");
  const on = mode !== null && mode !== "off";
  const auto = capability(device, "fan")?.auto === true;
  const disabled = pending || !device.online;
  return (
    <>
      <PowerRow
        name={`${device.name} power`}
        on={on}
        status={on ? words(mode) : "Off"}
        disabled={disabled}
        onToggle={() => send({ capability: "fan", command: "set_mode", params: { mode: on ? "off" : "on" } })}
      />
      <Slider
        label="Speed"
        min={0}
        max={100}
        value={num(device, "fan_percent")}
        format={(value) => `${Math.round(value)}%`}
        disabled={disabled}
        onCommit={(percent) => send({ capability: "fan", command: "set_percent", params: { percent: Math.round(percent) } })}
      />
      <ChoiceRow
        label="Mode"
        options={FAN_MODES.filter((value) => value !== "auto" || auto).map((value) => ({ value, label: words(value) }))}
        current={mode}
        disabled={disabled}
        onPick={(value) => send({ capability: "fan", command: "set_mode", params: { mode: value } })}
      />
    </>
  );
}

const PUMP_MODES = ["normal", "minimum", "maximum", "local"] as const;

function ValveControls({ device, pending, send }: ControlsProps) {
  const disabled = pending || !device.online;
  const state = str(device, "valve");
  const open = state === "open";
  const remaining = num(device, "open_remaining_s");
  return (
    <>
      {has(device, "valve") ? (
        <Actions
          disabled={disabled}
          actions={
            open
              ? [{ label: "Close", primary: true, onPress: () => send({ capability: "valve", command: "close" }) }]
              : [
                  {
                    label: "Open for 15 min",
                    primary: true,
                    onPress: () => send({ capability: "valve", command: "open", params: { duration_s: 900 } }),
                  },
                  { label: "Open", onPress: () => send({ capability: "valve", command: "open" }) },
                ]
          }
        />
      ) : null}
      {has(device, "on_off") ? (
        <PowerRow
          name={`${device.name} power`}
          on={device.state.on?.value === true}
          status={device.state.on?.value === true ? "Running" : "Off"}
          disabled={disabled}
          onToggle={() => send({ capability: "on_off", command: "toggle" })}
        />
      ) : null}
      {has(device, "pump") ? (
        <ChoiceRow
          label="Pump mode"
          options={PUMP_MODES.map((value) => ({ value, label: words(value) }))}
          current={str(device, "pump_mode")}
          disabled={disabled}
          onPick={(value) => send({ capability: "pump", command: "set_mode", params: { mode: value } })}
        />
      ) : null}
      <Readouts
        rows={[
          ["Valve", state === null ? null : words(state)],
          ["Closes in", remaining === null || !open ? null : `${Math.ceil(remaining / 60)} min`],
          ["Flow", num(device, "flow") === null ? null : `${num(device, "flow")} m³/h`],
        ]}
      />
    </>
  );
}

/** True when water is moving: a valve open or a pump running. */
function flowing(device: GharDevice): boolean {
  return str(device, "valve") === "open" || device.state.on?.value === true;
}

export const cover: Family = {
  label: (device) => (capability(device, "cover")?.tilt === true ? "Blind · Lift and tilt" : "Blind"),
  Form: WindowForm,
  style: (device) => vars({ "--ghar-open": (num(device, "open_percent") ?? 0) / 100 }),
  reading: (device) => {
    const open = num(device, "open_percent");
    if (open === null) {
      return "No reading yet";
    }
    if (device.state.moving?.value === true) {
      return "Moving";
    }
    return open <= 0 ? "Closed" : open >= 100 ? "Open" : `${Math.round(open)}% open`;
  },
  tone: (device) => ({ on: (num(device, "open_percent") ?? 0) > 0 }),
  primary: () => null,
  Controls: CoverControls,
};

export const fan: Family = {
  label: (device) => (device.kind === "air_purifier" ? "Air purifier" : "Fan"),
  Form: FanForm,
  style: (device) => vars({ "--ghar-spin": `${(2.6 - (num(device, "fan_percent") ?? 0) / 50).toFixed(2)}s` }),
  reading: (device) => {
    const mode = str(device, "fan_mode");
    const percent = num(device, "fan_percent");
    if (mode === null || mode === "off") {
      return "Off";
    }
    return percent === null ? words(mode) : `${Math.round(percent)}%`;
  },
  tone: (device) => {
    const mode = str(device, "fan_mode");
    return { on: device.online && mode !== null && mode !== "off" };
  },
  primary: (device) => {
    const mode = str(device, "fan_mode");
    return { capability: "fan", command: "set_mode", params: { mode: mode !== null && mode !== "off" ? "off" : "on" } };
  },
  Controls: FanControls,
};

export const valve: Family = {
  label: (device) => (device.kind === "pump" ? "Pump" : device.kind === "irrigation" ? "Irrigation" : "Water valve"),
  Form: ValveForm,
  reading: (device) => {
    if (device.kind === "pump") {
      const mode = str(device, "pump_mode");
      if (device.state.on?.value !== true) {
        return "Off";
      }
      return mode === null ? "Running" : `Running · ${words(mode)}`;
    }
    const state = str(device, "valve");
    const remaining = num(device, "open_remaining_s");
    if (state === null) {
      return "No reading yet";
    }
    return state === "open" && remaining !== null ? `Open · ${Math.ceil(remaining / 60)} min left` : words(state);
  },
  tone: (device) => ({ on: device.online && flowing(device) }),
  primary: () => null,
  Controls: ValveControls,
};
