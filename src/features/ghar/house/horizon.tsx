/**
 * The house at a glance: a ledger of what matters, the house in miniature with its rooms lit by
 * their lamps' pools, and what needs a look.
 */

import { AnimatePresence, motion } from "motion/react";
import type { GharDevice } from "../../../types/ghar";
import { EASE, SLOW_S, SLOWER_S } from "../../../shared/lib/ux/motion";
import { attention } from "./families";
import { isLamp, isLit } from "./light";
import { HouseMap } from "./map";
import { roomTemperature, Tally } from "./rooms";
import type { RoomRef } from "./search";

/** Seconds between neighbouring chips arriving. */
const CHIP_STAGGER_S = 0.04;

export type HorizonProps = {
  /** Named rooms, in order. */
  rooms: RoomRef[];
  devices: GharDevice[];
  pendingIds: ReadonlySet<string>;
  /** Ghar is reachable, so lamps can be switched. */
  live: boolean;
  /** Point the page at a room. */
  onRoom: (roomId: string) => void;
  /** Switch one lamp. */
  onLamp: (device: GharDevice) => void;
  /** Open a device's controls. */
  onDevice: (deviceId: string) => void;
};

/** The ledger over the house in miniature over what needs a look. */
export function Horizon({ rooms, devices, pendingIds, live, onRoom, onLamp, onDevice }: HorizonProps) {
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
    <motion.div
      className="ghar-overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOWER_S, ease: EASE }}
    >
      <div className="ghar-ledger">
        <Tally value={lightsOn} of={lamps.length} label={lamps.length === 1 ? "LIGHT ON" : "LIGHTS ON"} />
        {temperature !== null ? <Tally value={null} degrees={temperature} label="INDOORS" delay={0.03} /> : null}
        {locks.length > 0 ? (
          <Tally
            value={locks.filter((device) => device.state.locked?.value === true).length}
            of={locks.length}
            label="LOCKED"
            delay={0.06}
          />
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
        <div className="ghar-overview__map">
          <HouseMap
            rooms={rooms}
            devices={devices}
            pendingIds={pendingIds}
            size="page"
            roomAction="show"
            onRoom={onRoom}
            onLamp={onLamp}
            live={live}
          />
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {flagged.length > 0 ? (
          <motion.div
            key="attention"
            className="overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: SLOWER_S, ease: EASE }}
          >
            <div className="ghar-attention">
              <span className="mr-1 text-[10px] tracking-[0.16em] text-ink-faint uppercase">Needs a look</span>
              <AnimatePresence mode="popLayout">
                {flagged.map(({ device, reason }, index) => (
                  <motion.button
                    key={device.id}
                    layout="position"
                    type="button"
                    className="ghar-chip"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: SLOW_S, ease: EASE, delay: index * CHIP_STAGGER_S }}
                    onClick={() => onDevice(device.id)}
                  >
                    <span aria-hidden className={`ghar-mark ${reason.tone === "error" ? "ghar-mark--error" : ""}`} />
                    {reason.text}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
