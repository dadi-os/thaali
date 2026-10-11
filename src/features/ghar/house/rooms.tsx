/**
 * How Ghar draws the house: rooms are panels on the paper, each lamp a soft pool of light
 * in its own color and brightness around a small fixture, and the home widget gives each
 * room one row with a dot per lamp.
 */

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import type { GharDevice } from "../../../types/ghar";
import { Ticker } from "../../../shared/components/Ticker";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import { roomTitle, UnplacedCommission } from "../commission";
import { DeviceGlyph, glyphFor } from "./icons";
import { isLit, isSwitchable, lampColor, lampLevel, PLAIN_LAMP, roomGlow } from "./light";
import type { RoomRef } from "./search";

/** Pointer and hover wiring for a device where it sits. Click, drag and hover are decided by the house. */
export type DeviceHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, device: GharDevice) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>, device: GharDevice) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>, device: GharDevice) => void;
  onHover: (deviceId: string, el: HTMLElement) => void;
  onHoverEnd: () => void;
};

/** True for a light Ghar can dim. */
function isDimmable(device: GharDevice): boolean {
  return device.capabilities.some((cap) => cap.capability === "dimmable");
}

/** The Matter product string when it says more than the device's own name, else null. */
function productSubtitle(device: GharDevice): string | null {
  const product = device.product_name?.trim() ?? "";
  if (!product) {
    return null;
  }
  if (product.localeCompare(device.name.trim(), undefined, { sensitivity: "accent" }) === 0) {
    return null;
  }
  return product;
}

/**
 * What a device that is not a light last reported, in a few words: lock, contact,
 * occupancy, temperature and humidity readings, else its product, else that it has none.
 */
function deviceReading(device: GharDevice): string {
  const { locked, contact, occupancy, temperature, humidity } = device.state;
  const parts = [
    typeof locked?.value === "boolean" ? (locked.value ? "Locked" : "Unlocked") : null,
    typeof contact?.value === "boolean" ? (contact.value ? "Closed" : "Open") : null,
    typeof occupancy?.value === "boolean" ? (occupancy.value ? "Occupied" : "Clear") : null,
    typeof temperature?.value === "number" ? `${temperature.value.toFixed(1)}°C` : null,
    typeof humidity?.value === "number" ? `${Math.round(humidity.value)}% RH` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : (productSubtitle(device) ?? "No reading yet");
}

/** True when a device reports something worth a glance: a door unlocked or open. */
function needsAttention(device: GharDevice): boolean {
  return device.state.locked?.value === false || device.state.contact?.value === false;
}

/** CSS variables a lit lamp draws with: its color and its level, 0–1. */
function lampVars(device: GharDevice): CSSProperties {
  return {
    "--lamp": lampColor(device) ?? PLAIN_LAMP,
    "--lamp-level": String(lampLevel(device)),
  } as CSSProperties;
}

/** What a room's lights are doing, in a few words; a room without lights counts its devices. */
function roomSummary(inRoom: GharDevice[]): string {
  const lamps = inRoom.filter(isSwitchable);
  if (lamps.length === 0) {
    return inRoom.length === 0 ? "Empty" : inRoom.length === 1 ? "1 device" : `${inRoom.length} devices`;
  }
  const on = lamps.filter(isLit).length;
  if (on === 0) {
    return lamps.length === 1 ? "Light off" : `${lamps.length} lights off`;
  }
  if (on === lamps.length) {
    return lamps.length === 1 ? "Light on" : `All ${lamps.length} lights on`;
  }
  return `${on} of ${lamps.length} lights on`;
}

type LampFixtureProps = {
  device: GharDevice;
  /** A command for it is in flight: it keeps its last reading and breathes. */
  pending: boolean;
  /** `dot` in a widget row, `bulb` at the heart of a light's pool on the page. */
  size: "dot" | "bulb";
};

/** A light's fixture: a ring when off, a glowing bead of its own color when on, dashed when offline. */
export function LampFixture({ device, pending, size }: LampFixtureProps) {
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

export type TallyProps = {
  /** The count; null while it loads. */
  value: number | null;
  /** Shown after the count as `/of`, for a part of a whole. */
  of?: number;
  /** Tracking-caps label under the count. */
  label: string;
  /** `error` for a count of trouble, such as devices offline. */
  tone?: "quiet" | "error";
  /** Seconds before the ticker lands, so a row of tallies settles in turn. */
  delay?: number;
};

/** A count as the home ledgers draw it: an odometer number over a tracking-caps label. */
export function Tally({ value, of, label, tone = "quiet", delay = 0 }: TallyProps) {
  return (
    <span className="flex min-w-0 flex-col items-center justify-center gap-2 px-3">
      <span className="flex items-baseline gap-0.5">
        <Ticker
          value={value}
          delay={delay}
          className={`text-[28px] font-medium tracking-tight ${tone === "error" ? "text-error" : "text-ink"}`}
        />
        {of !== undefined ? (
          <span className="font-numeric text-[13px] text-ink-ghost tabular-nums">/{of}</span>
        ) : null}
      </span>
      <span
        className={`truncate text-[10px] font-medium tracking-[2px] ${tone === "error" ? "text-error" : "text-sage-deep"}`}
      >
        {label}
      </span>
    </span>
  );
}

type DeviceFaceProps = {
  device: GharDevice;
  pending: boolean;
  /** The copy that follows the pointer while dragging. */
  ghost?: boolean;
};

/**
 * One device as it sits in a room. A light is a pool of its own color, as wide and strong as
 * its brightness, around its fixture, over its name and level; anything else is its glyph in
 * a ring over its last reading, tinted clay when a door is unlocked or open.
 */
export function DeviceFace({ device, pending, ghost = false }: DeviceFaceProps) {
  const light = isSwitchable(device);
  const lit = isLit(device);
  const level = Math.round(lampLevel(device) * 100);
  return (
    <div
      aria-busy={pending}
      title={productSubtitle(device) ?? undefined}
      className={`ghar-tile ${lit ? "ghar-tile--lit" : ""} ${pending ? "ghar-tile--pending" : ""} ${
        device.online ? "" : "ghar-tile--offline"
      } ${ghost ? "ghar-tile--ghost" : ""}`}
      style={light ? lampVars(device) : undefined}
    >
      <span className="ghar-tile__stage">
        {light ? (
          <>
            <span aria-hidden className="ghar-tile__pool" />
            <LampFixture device={device} pending={pending} size="bulb" />
          </>
        ) : (
          <span className={`ghar-device ${needsAttention(device) ? "ghar-device--attention" : ""}`}>
            <DeviceGlyph kind={glyphFor(device.capabilities)} lit={false} />
          </span>
        )}
      </span>
      <span className="relative block min-w-0 text-center">
        <span className="block truncate text-[12.5px] leading-tight font-medium text-ink">{device.name}</span>
        <span
          className={`mt-1 flex h-[13px] items-center justify-center text-[11px] leading-none ${
            lit && !pending ? "text-sage-deep" : "text-ink-ghost"
          }`}
        >
          {!device.online ? (
            "Offline"
          ) : pending ? (
            "Switching…"
          ) : !light ? (
            <span className="truncate">{deviceReading(device)}</span>
          ) : lit && isDimmable(device) ? (
            <>
              <Ticker value={level} className="text-[11px]" />
              <span className="font-numeric">%</span>
            </>
          ) : lit ? (
            "On"
          ) : (
            "Off"
          )}
        </span>
      </span>
    </div>
  );
}

type DeviceTileProps = DeviceHandlers & {
  device: GharDevice;
  pending: boolean;
  /** It is the one being dragged, so its place shows faded. */
  dimmed: boolean;
};

/** A device where it sits, wired to the house: click switches it, hover opens its controls, a move drags it to another room. */
function DeviceTile({
  device,
  pending,
  dimmed,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onHover,
  onHoverEnd,
}: DeviceTileProps) {
  return (
    <div
      data-device-id={device.id}
      onPointerDown={(event) => onPointerDown(event, device)}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerUp(event, device)}
      onPointerCancel={(event) => onPointerCancel(event, device)}
      onMouseEnter={(event) => onHover(device.id, event.currentTarget)}
      onMouseLeave={onHoverEnd}
      onClick={(event) => event.stopPropagation()}
      className={`touch-none transition-opacity duration-slow ease-dadi ${dimmed ? "opacity-30" : ""}`}
    >
      <DeviceFace device={device} pending={pending} />
    </div>
  );
}

export type RoomPanelProps = DeviceHandlers & {
  room: RoomRef;
  /** Every device in the room, for its summary and its light. */
  inRoom: GharDevice[];
  /** The devices search leaves showing. */
  devices: GharDevice[];
  /** Place in the grid, to stagger the panels in. */
  index: number;
  /** A dragged device is over the room. */
  hot: boolean;
  pendingIds: ReadonlySet<string>;
  draggingId: string | null;
  onToggleRoom: () => void;
};

/**
 * One room: a glass panel lit from above by its lit lamps, its name in tracking caps, what
 * its lights are doing and a switch for all of them, over a floor of its devices. Unplaced
 * is the dashed pairing zone instead. Devices are dropped onto any panel to move them.
 */
export function RoomPanel({
  room,
  inRoom,
  devices,
  index,
  hot,
  pendingIds,
  draggingId,
  onToggleRoom,
  ...handlers
}: RoomPanelProps) {
  const unplaced = room.name === "unassigned";
  const lamps = inRoom.filter(isSwitchable);
  const lit = lamps.some(isLit);
  const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
  const glow = unplaced ? null : roomGlow(lamps, "top");
  return (
    <motion.section
      data-room-id={room.id}
      aria-label={roomTitle(room.name)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay: index * 0.05 }}
      className={`ghar-room ${unplaced ? "ghar-room--unplaced" : ""} ${hot ? "ghar-room--hot" : ""}`}
    >
      <span
        aria-hidden
        className="ghar-room__light"
        style={{ backgroundImage: glow ?? "none", opacity: glow ? 1 : 0 }}
      />
      <header className="relative flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-[11px] font-medium tracking-[2.5px] text-sage-deep uppercase">
            {roomTitle(room.name)}
          </h2>
          <p className={`mt-1 truncate text-[12px] ${lit ? "text-ink-muted" : "text-ink-ghost"}`}>
            {unplaced ? "New devices land here · drag one into a room" : roomSummary(inRoom)}
          </p>
        </div>
        {!unplaced && lamps.length > 0 ? (
          <button
            type="button"
            role="switch"
            aria-checked={lit}
            aria-label={`${roomTitle(room.name)} lights`}
            disabled={pending}
            onClick={onToggleRoom}
            className={`ghar-switch ${lit ? "ghar-switch--on" : ""} ${pending ? "animate-breath" : ""}`}
          >
            <span className="ghar-switch__knob" />
          </button>
        ) : null}
      </header>
      <div className="ghar-room__floor">
        {unplaced ? <UnplacedCommission /> : null}
        {devices.length > 0 ? (
          <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(128px,1fr))]">
            {devices.map((device) => (
              <DeviceTile
                key={device.id}
                device={device}
                pending={pendingIds.has(device.id)}
                dimmed={draggingId === device.id}
                {...handlers}
              />
            ))}
          </div>
        ) : unplaced ? null : (
          <p className="rounded-[var(--radius)] border border-dashed border-sage-line px-3 py-6 text-center text-[12px] text-ink-ghost">
            Drag a device here
          </p>
        )}
      </div>
    </motion.section>
  );
}

export type RoomRowProps = {
  room: RoomRef;
  /** Few rooms share the widget, so each row also says what its lights are doing, under its name and as ON or OFF. */
  roomy: boolean;
  /** Switchable devices in the room. */
  lamps: GharDevice[];
  pendingIds: ReadonlySet<string>;
  onToggle: () => void;
};

/**
 * Home widget row for one room: its name and a dot per light glowing its color, washed from
 * the right in its lit lamps' light. Click switches the room and does not open the page.
 */
export function RoomRow({ room, roomy, lamps, pendingIds, onToggle }: RoomRowProps) {
  const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
  const lit = lamps.some(isLit);
  const glow = roomGlow(lamps, "end");
  return (
    <button
      type="button"
      aria-pressed={lit}
      aria-busy={pending}
      aria-label={`${roomTitle(room.name)} lights`}
      disabled={pending || lamps.length === 0}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="ghar-row"
      style={glow ? { backgroundImage: glow } : undefined}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] text-ink">{roomTitle(room.name)}</span>
        {roomy ? (
          <span className="mt-0.5 truncate text-[11px] text-ink-ghost">{roomSummary(lamps)}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="flex items-center gap-1.5">
          {lamps.map((lamp) => (
            <LampFixture key={lamp.id} device={lamp} pending={pendingIds.has(lamp.id)} size="dot" />
          ))}
        </span>
        {roomy ? (
          <span
            className={`w-7 text-right text-[10px] font-medium tracking-[1.5px] ${
              lit && !pending ? "text-sage-deep" : "text-ink-ghost"
            }`}
          >
            {lamps.length === 0 ? "—" : lit ? "ON" : "OFF"}
          </span>
        ) : null}
      </span>
    </button>
  );
}
