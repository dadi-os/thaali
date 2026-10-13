/**
 * The house in miniature: its rooms side by side, each as wide as what it holds and dusky until
 * its lamps light it. Every lamp is a pool of its own color, as wide and strong as its
 * brightness, breathing slowly; climate rises from the floor in clay or tide and daylight falls
 * from an open blind; each room's temperature, locks and what needs a look sit in its corner and
 * its other devices along its floor. The home tile and the top of the Ghar page draw it.
 */

import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { motion } from "motion/react";
import type { GharDevice } from "../../../types/ghar";
import { EASE, SLOWER_S } from "../../../shared/lib/ux/motion";
import { roomTitle } from "../commission";
import { attention, familyOf, LampFixture } from "./families";
import { isLamp, isLit, lampColor, lampLevel, PLAIN_LAMP } from "./light";
import { roomTemperature, RollingText } from "./rooms";
import type { RoomRef } from "./search";

/** Soft spring a pool settles on when its lamp changes, so light swells and fades instead of snapping. */
const POOL_SPRING = { type: "spring", stiffness: 90, damping: 18, mass: 1 } as const;

/** Seconds between neighbouring rooms arriving, and from a room to its lamps coming on. */
const ROOM_STAGGER_S = 0.07;
const LIGHTS_AFTER_S = 0.18;

/** Seconds between neighbouring pools' breaths (ghar.css sets the breath), so the house never pulses in step. */
const BREATHE_OFFSET_S = 1.7;

/** Other devices drawn along a room's floor before the rest are counted. */
const THINGS_SHOWN = 5;

/** The most devices that widen a room, so a full room never squeezes its neighbours unreadable. */
const WIDEST_ROOM = 5;

export type HouseMapProps = {
  /** Named rooms, in order. */
  rooms: RoomRef[];
  devices: GharDevice[];
  pendingIds: ReadonlySet<string>;
  /** `tile` on the home dashboard; `page` over the Ghar page, with larger fixtures and type. */
  size: "tile" | "page";
  /**
   * What a room tap does: `switch` its lights (a room with no lamp online takes no tap, so it
   * falls through to whatever holds the map) or `show` its panel.
   */
  roomAction: "switch" | "show";
  onRoom: (roomId: string) => void;
  /** Switch one lamp. */
  onLamp: (device: GharDevice) => void;
  /** Ghar is reachable, so lamps can be switched. */
  live: boolean;
};

/** A tap on a room, drawn as light spreading from where it landed. */
type Ripple = { roomId: string; x: number; y: number; key: number };

/** A tap on a lamp, drawn as a ring leaving its fixture. */
type Flare = { id: string; key: number };

/** How many rooms share a row of the map before it wraps. */
function perRow(count: number, size: HouseMapProps["size"]): number {
  if (size === "page") {
    return count <= 6 ? count : Math.ceil(count / 2);
  }
  return count <= 4 ? count : count <= 8 ? Math.ceil(count / 2) : Math.ceil(count / 3);
}

/** Where lamp `index` of `count` hangs in its room, in percent: spread across it, alternately a little high and low. */
function spot(index: number, count: number): { x: number; y: number } {
  return { x: ((index + 0.5) / count) * 100, y: count === 1 ? 44 : index % 2 === 0 ? 40 : 54 };
}

/** A room's air: heating or cooling rising from the floor and daylight falling from an open blind; null when still. */
function airWash(inRoom: GharDevice[]): string | null {
  const layers: string[] = [];
  const running = inRoom.find(
    (device) => device.online && (device.state.running?.value === "heating" || device.state.running?.value === "cooling"),
  );
  if (running) {
    const color = running.state.running?.value === "heating" ? "var(--clay)" : "var(--tide)";
    layers.push(`radial-gradient(90% 70% at 50% 125%, color-mix(in srgb, ${color} 42%, transparent), transparent 72%)`);
  }
  const blind = inRoom.find(
    (device) => typeof device.state.open_percent?.value === "number" && device.state.open_percent.value > 0,
  );
  if (blind && typeof blind.state.open_percent?.value === "number") {
    layers.push(
      `linear-gradient(180deg, color-mix(in srgb, var(--daylight) ${Math.round(blind.state.open_percent.value * 0.7)}%, transparent), transparent 62%)`,
    );
  }
  return layers.length > 0 ? layers.join(", ") : null;
}

/** What a room holds in a few words: its lights on of its lights, else its device count. */
function roomLine(lamps: GharDevice[], inRoom: GharDevice[]): string {
  if (lamps.length > 0) {
    return `${lamps.filter(isLit).length}/${lamps.length} on`;
  }
  return inRoom.length === 0 ? "Empty" : inRoom.length === 1 ? "1 device" : `${inRoom.length} devices`;
}

/** The house in miniature. Taps switch a lamp or act on a room and never reach what holds the map. */
export function HouseMap({ rooms, devices, pendingIds, size, roomAction, onRoom, onLamp, live }: HouseMapProps) {
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const [flare, setFlare] = useState<Flare | null>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(true);
  }, []);

  const across = perRow(rooms.length, size);
  const rows = Array.from({ length: Math.ceil(rooms.length / across) }, (_, row) =>
    rooms.slice(row * across, (row + 1) * across),
  );

  function pressRoom(event: ReactMouseEvent<HTMLButtonElement>, roomId: string): void {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const keyboard = event.detail === 0;
    setRipple({
      roomId,
      x: keyboard ? rect.width / 2 : event.clientX - rect.left,
      y: keyboard ? rect.height / 2 : event.clientY - rect.top,
      key: event.timeStamp,
    });
    onRoom(roomId);
  }

  return (
    <div className={`ghar-map ghar-map--${size}`}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="ghar-map__row">
          {row.map((room, column) => {
            const index = rowIndex * across + column;
            const inRoom = devices.filter((device) => device.room.id === room.id);
            const lamps = inRoom.filter(isLamp);
            const others = inRoom.filter((device) => !isLamp(device));
            const title = roomTitle(room.name);
            const lit = lamps.some(isLit);
            const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
            const switches = roomAction === "switch";
            const pressable = !switches || lamps.some((lamp) => lamp.online);
            const temperature = roomTemperature(inRoom);
            const climate = inRoom.find((device) => device.online && typeof device.state.running?.value === "string")?.state
              .running?.value;
            const locks = inRoom.filter((device) => typeof device.state.locked?.value === "boolean");
            const unlocked = locks.some((device) => device.state.locked?.value === false);
            const flagged = inRoom.flatMap((device) => {
              const reason = attention(device);
              return reason ? [reason] : [];
            });
            const air = airWash(inRoom);
            const roomDelay = entered ? 0 : index * ROOM_STAGGER_S;
            return (
              <motion.div
                key={room.id}
                className={`ghar-map__room ${lit ? "ghar-map__room--lit" : ""}`}
                style={
                  {
                    flexGrow: Math.min(WIDEST_ROOM, Math.max(1, inRoom.length)),
                    "--lamps": Math.max(1, lamps.length),
                  } as CSSProperties
                }
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: SLOWER_S, ease: EASE, delay: roomDelay }}
              >
                <span aria-hidden className="ghar-map__air" style={{ backgroundImage: air ?? "none", opacity: air ? 1 : 0 }} />
                <span aria-hidden className="ghar-map__pools">
                  {lamps.map((lamp, n) => {
                    const at = spot(n, lamps.length);
                    const level = lampLevel(lamp);
                    return (
                      <span
                        key={lamp.id}
                        className={`ghar-pool ${pendingIds.has(lamp.id) ? "ghar-pool--pending" : ""}`}
                        style={{
                          left: `${at.x}%`,
                          top: `${at.y}%`,
                          animationDelay: `${-(index * lamps.length + n) * BREATHE_OFFSET_S}s`,
                        }}
                      >
                        <motion.span
                          className="ghar-pool__light"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${lampColor(lamp) ?? PLAIN_LAMP} var(--ghar-pool-max), transparent)`,
                          }}
                          initial={{ opacity: 0, scale: 0.3 }}
                          animate={
                            isLit(lamp) ? { opacity: 0.4 + 0.6 * level, scale: 0.55 + 0.45 * level } : { opacity: 0, scale: 0.3 }
                          }
                          transition={{ ...POOL_SPRING, delay: entered ? 0 : roomDelay + LIGHTS_AFTER_S + n * ROOM_STAGGER_S }}
                        />
                      </span>
                    );
                  })}
                </span>
                {ripple?.roomId === room.id ? (
                  <motion.span
                    key={ripple.key}
                    aria-hidden
                    className="ghar-map__ripple"
                    style={{ left: ripple.x, top: ripple.y }}
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 0 }}
                    transition={{ duration: 0.9, ease: EASE }}
                  />
                ) : null}
                {pressable ? (
                  <button
                    type="button"
                    className="ghar-map__press"
                    aria-label={switches ? `${title} lights` : `Show ${title}`}
                    aria-pressed={switches ? lit : undefined}
                    aria-busy={pending}
                    disabled={switches && (pending || !live)}
                    onClick={(event) => pressRoom(event, room.id)}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                ) : null}
                {lamps.map((lamp, n) => {
                  const at = spot(n, lamps.length);
                  const waiting = pendingIds.has(lamp.id);
                  return (
                    <motion.button
                      key={lamp.id}
                      type="button"
                      className="ghar-map__lamp"
                      style={{ left: `${at.x}%`, top: `${at.y}%` }}
                      aria-label={lamp.name}
                      aria-pressed={isLit(lamp)}
                      aria-busy={waiting}
                      title={`${lamp.name} · ${lamp.online ? familyOf(lamp).reading(lamp) : "Offline"}`}
                      disabled={!live || !lamp.online || waiting}
                      whileTap={{ scale: 0.8 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setFlare({ id: lamp.id, key: event.timeStamp });
                        onLamp(lamp);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <LampFixture device={lamp} size={size === "page" ? "bulb" : "dot"} pending={waiting} />
                      {flare?.id === lamp.id ? (
                        <motion.span
                          key={flare.key}
                          aria-hidden
                          className="ghar-map__flare"
                          initial={{ scale: 0.5, opacity: 0.8 }}
                          animate={{ scale: 2.4, opacity: 0 }}
                          transition={{ duration: SLOWER_S, ease: EASE }}
                        />
                      ) : null}
                    </motion.button>
                  );
                })}
                <span className="ghar-map__marks">
                  {temperature !== null ? (
                    <span className="ghar-map__temp">
                      <i
                        aria-hidden
                        className={
                          climate === "heating" ? "ghar-map__temp--heat" : climate === "cooling" ? "ghar-map__temp--cool" : ""
                        }
                      />
                      <RollingText text={`${temperature.toFixed(1)}°`} />
                    </span>
                  ) : null}
                  {locks.length > 0 ? (
                    <span
                      role="img"
                      aria-label={unlocked ? "Unlocked" : "Locked"}
                      className={`ghar-map__lock ${unlocked ? "ghar-map__lock--open" : ""}`}
                    />
                  ) : null}
                  {flagged.length > 0 ? (
                    <span
                      role="img"
                      aria-label={flagged.map((reason) => reason.text).join(", ")}
                      className={`ghar-map__flag ${flagged.some((reason) => reason.tone === "error") ? "ghar-map__flag--error" : ""}`}
                    >
                      <i aria-hidden />
                      {flagged.length > 1 ? flagged.length : null}
                    </span>
                  ) : null}
                </span>
                <span className="ghar-map__label">
                  <span className="ghar-map__name">{title}</span>
                  <RollingText text={roomLine(lamps, inRoom)} className="ghar-map__line" />
                </span>
                {others.length > 0 ? (
                  <span aria-hidden className="ghar-map__things">
                    {others.slice(0, THINGS_SHOWN).map((device) => {
                      const tone = familyOf(device).tone(device);
                      const reason = attention(device);
                      return (
                        <i
                          key={device.id}
                          className={`ghar-thing ${tone.on || tone.run ? "ghar-thing--on" : ""} ${
                            reason ? (reason.tone === "error" ? "ghar-thing--error" : "ghar-thing--warn") : ""
                          } ${device.online ? "" : "ghar-thing--offline"}`}
                        />
                      );
                    })}
                    {others.length > THINGS_SHOWN ? <span>+{others.length - THINGS_SHOWN}</span> : null}
                  </span>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
