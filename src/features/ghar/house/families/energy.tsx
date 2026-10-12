/** Plugs and meters: a socket that breathes current, and a crown of ticks lit as far as the draw reaches. */

import type { GharDevice } from "../../../../types/ghar";
import { has, num, PowerRow, Readouts, vars, type ControlsProps, type Family } from "./kit";

/** Draw at which a socket's ring and a meter's crown are full. */
const FULL_WATTS = { plug: 2000, meter: 2400 };

const watts = (value: number) => `${Math.round(value).toLocaleString()} W`;

function SocketForm() {
  return (
    <span className="ghar-socket">
      <i />
      <i />
    </span>
  );
}

function CrownForm({ device }: { device: GharDevice }) {
  const power = num(device, "power_w");
  return (
    <span className="ghar-crown">
      {Array.from({ length: 24 }, (_, n) => (
        <i key={n} style={vars({ "--n": n })} />
      ))}
      <b className="font-numeric text-[11px] font-medium text-ink-muted">{power === null ? "—" : Math.round(power)}</b>
    </span>
  );
}

/** Power and energy readings, for any device that measures them. */
function EnergyReadouts({ device }: { device: GharDevice }) {
  const power = num(device, "power_w");
  const voltage = num(device, "voltage_v");
  const current = num(device, "current_a");
  const energy = num(device, "energy_kwh");
  return (
    <Readouts
      rows={[
        ["Now", power === null ? null : watts(power)],
        ["Voltage", voltage === null ? null : `${Math.round(voltage)} V`],
        ["Current", current === null ? null : `${current.toFixed(1)} A`],
        ["Total", energy === null ? null : `${energy.toFixed(2)} kWh`],
      ]}
    />
  );
}

function PlugControls({ device, pending, send }: ControlsProps) {
  const on = device.state.on?.value === true;
  return (
    <>
      <PowerRow
        name={`${device.name} power`}
        on={on}
        status={on ? "On" : "Off"}
        disabled={pending || !device.online}
        onToggle={() => send({ capability: "on_off", command: "toggle" })}
      />
      <EnergyReadouts device={device} />
    </>
  );
}

export const plug: Family = {
  label: (device) => (has(device, "energy") ? "Plug · Measures power" : "Plug"),
  Form: SocketForm,
  style: (device) => vars({ "--ghar-level": Math.min(1, (num(device, "power_w") ?? 0) / FULL_WATTS.plug) }),
  reading: (device) => {
    if (device.state.on?.value !== true) {
      return "Off";
    }
    const power = num(device, "power_w");
    return power === null ? "On" : watts(power);
  },
  tone: (device) => ({ on: device.online && device.state.on?.value === true }),
  primary: () => ({ capability: "on_off", command: "toggle" }),
  Controls: PlugControls,
};

export const meter: Family = {
  label: () => "Energy",
  Form: CrownForm,
  style: (device) => vars({ "--ghar-level": Math.min(1, Math.abs(num(device, "power_w") ?? 0) / FULL_WATTS.meter) }),
  reading: (device) => {
    const power = num(device, "power_w");
    return power === null ? "No reading yet" : watts(power);
  },
  tone: () => ({}),
  primary: () => null,
  Controls: ({ device }) => <EnergyReadouts device={device} />,
};
