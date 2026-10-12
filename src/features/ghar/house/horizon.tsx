/**
 * The house at a glance: a ledger of what matters, a horizon with one segment per room washed
 * in what is happening inside it (its lamps' colors, heating or cooling, daylight through its
 * blinds), and what needs a look.
 */

import type { GharDevice } from "../../../types/ghar";
import { roomTitle } from "../commission";
import { attention } from "./families";
import { isLamp, isLit, lampColor, lampLevel, PLAIN_LAMP } from "./light";
import { roomTemperature, Tally } from "./rooms";
import type { RoomRef } from "./search";

export type HorizonProps = {
  /** Named rooms, in order. */
  rooms: RoomRef[];
  devices: GharDevice[];
  /** Point the page at a room. */
  onRoom: (roomId: string) => void;
  /** Open a device's controls. */
  onDevice: (deviceId: string) => void;
};

/** A room's wash: its lit lamps from above, its heating or cooling from below, daylight from an open blind. */
function wash(inRoom: GharDevice[]): string | null {
  const lit = inRoom.filter(isLit);
  const layers = lit.map((lamp, index) => {
    const strength = Math.round(32 + 22 * lampLevel(lamp));
    const color = lampColor(lamp) ?? PLAIN_LAMP;
    return `radial-gradient(70% 90% at ${Math.round(((index + 0.5) / lit.length) * 100)}% 0%, color-mix(in srgb, ${color} ${strength}%, transparent), transparent 75%)`;
  });
  const running = inRoom.find((device) => device.online && (device.state.running?.value === "heating" || device.state.running?.value === "cooling"));
  if (running) {
    const color = running.state.running?.value === "heating" ? "var(--clay)" : "var(--tide)";
    layers.push(`radial-gradient(90% 60% at 50% 120%, color-mix(in srgb, ${color} 34%, transparent), transparent 70%)`);
  }
  const blind = inRoom.find((device) => typeof device.state.open_percent?.value === "number" && device.state.open_percent.value > 0);
  if (blind && typeof blind.state.open_percent?.value === "number") {
    layers.push(
      `linear-gradient(180deg, color-mix(in srgb, var(--daylight) ${Math.round(blind.state.open_percent.value * 0.6)}%, transparent), transparent 60%)`,
    );
  }
  return layers.length > 0 ? layers.join(", ") : null;
}

/** A room's reading under its name: its lights, else its device count, then its temperature. */
function roomLine(inRoom: GharDevice[]): string {
  const lamps = inRoom.filter(isLamp);
  const temperature = roomTemperature(inRoom);
  return [
    lamps.length > 0 ? `${lamps.filter(isLit).length}/${lamps.length} on` : `${inRoom.length} ${inRoom.length === 1 ? "device" : "devices"}`,
    temperature === null ? null : `${temperature.toFixed(1)}°`,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/** The ledger over the horizon over what needs a look. */
export function Horizon({ rooms, devices, onRoom, onDevice }: HorizonProps) {
  const lamps = devices.filter(isLamp);
  const lightsOn = lamps.filter(isLit).length;
  const temperature = roomTemperature(devices);
  const locks = devices.filter((device) => typeof device.state.locked?.value === "boolean");
  const watts = devices.reduce((sum, device) => {
    const power = device.state.power_w?.value;
    return sum + (device.online && typeof power === "number" ? power : 0);
  }, 0);
  const metered = devices.some((device) => typeof device.state.power_w?.value === "number");
  const flagged = devices.flatMap((device) => {
    const reason = attention(device);
    return reason ? [{ device, reason }] : [];
  });
  return (
    <div className="ghar-overview mb-5">
      <div className="ghar-ledger">
        <Tally value={lightsOn} of={lamps.length} label={lamps.length === 1 ? "LIGHT ON" : "LIGHTS ON"} />
        {temperature !== null ? <Tally value={null} text={`${temperature.toFixed(1)}°`} label="INDOORS" /> : null}
        {locks.length > 0 ? (
          <Tally value={locks.filter((device) => device.state.locked?.value === true).length} of={locks.length} label="LOCKED" delay={0.06} />
        ) : null}
        {metered ? <Tally value={Math.round(watts)} label="WATTS NOW" delay={0.09} /> : null}
        <Tally value={devices.length} label={devices.length === 1 ? "DEVICE" : "DEVICES"} delay={0.12} />
        {flagged.length > 0 ? (
          <Tally
            value={flagged.length}
            label="NEED A LOOK"
            tone={flagged.some((item) => item.reason.tone === "error") ? "error" : "quiet"}
            delay={0.18}
          />
        ) : null}
      </div>
      {rooms.length > 0 ? (
        <div className="ghar-horizon">
          {rooms.map((room) => {
            const inRoom = devices.filter((device) => device.room.id === room.id);
            const background = wash(inRoom);
            const marks = inRoom.flatMap((device) => {
              const reason = attention(device);
              return reason ? [reason.tone] : [];
            });
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onRoom(room.id)}
                className="ghar-horizon__room"
                style={{ flexGrow: Math.max(1, inRoom.length) }}
              >
                <span aria-hidden className="ghar-horizon__wash" style={{ backgroundImage: background ?? "none" }} />
                {marks.length > 0 ? (
                  <span className="absolute top-2.5 right-2.5 flex gap-1">
                    {marks.map((tone, index) => (
                      <span key={index} className={`ghar-mark ${tone === "error" ? "ghar-mark--error" : ""}`} />
                    ))}
                  </span>
                ) : null}
                <span className="absolute right-2 bottom-6 left-2.5 truncate text-[10px] font-medium tracking-[0.18em] text-sage-deep uppercase">
                  {roomTitle(room.name)}
                </span>
                <span className="absolute right-2 bottom-2.5 left-2.5 truncate text-[11px] text-ink-muted">{roomLine(inRoom)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {flagged.length > 0 ? (
        <div className="ghar-attention">
          <span className="mr-1 text-[10px] tracking-[0.16em] text-ink-faint uppercase">Needs a look</span>
          {flagged.map(({ device, reason }) => (
            <button key={device.id} type="button" className="ghar-chip" onClick={() => onDevice(device.id)}>
              <span aria-hidden className={`ghar-mark ${reason.tone === "error" ? "ghar-mark--error" : ""}`} />
              {reason.text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
