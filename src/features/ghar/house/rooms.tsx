/**
 * How Ghar draws the house: rooms are glass panels on the paper, each washed from above by its
 * lit lamps, and every device is its family's abstract form over its name and reading. The
 * home tile gives each room one row with a bead per lamp and a mark per other device.
 */

import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import type { GharDevice } from "../../../types/ghar";
import { Ticker } from "../../../shared/components/Ticker";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import { roomTitle } from "../commission";
import { attention, familyOf, LampFixture } from "./families";
import { isLamp, isLit, roomGlow } from "./light";
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

/** The Matter product string when it says more than the device's own name, else null. */
function productSubtitle(device: GharDevice): string | null {
  const product = device.product_name?.trim();
  if (!product || product.localeCompare(device.name.trim(), undefined, { sensitivity: "accent" }) === 0) {
    return null;
  }
  return product;
}

/** The temperature a room reads: the mean of its thermostats and temperature sensors, or null. */
export function roomTemperature(inRoom: GharDevice[]): number | null {
  const readings = inRoom.flatMap((device) => {
    const value = device.state.temperature?.value;
    return device.online && typeof value === "number" && device.kind !== "refrigerator" && device.kind !== "cabinet" && device.kind !== "oven"
      ? [value]
      : [];
  });
  return readings.length === 0 ? null : readings.reduce((sum, value) => sum + value, 0) / readings.length;
}

/** What a room's lights are doing, in a few words; a room without lights counts its devices. */
export function roomSummary(inRoom: GharDevice[]): string {
  const lamps = inRoom.filter(isLamp);
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

export type TallyProps = {
  /** The count; null while it loads. */
  value: number | null;
  /** Shown after the count as `/of`, for a part of a whole. */
  of?: number;
  /** A reading that is not a count, such as 21.4°; replaces the ticker. */
  text?: string;
  /** Tracking-caps label under the count. */
  label: string;
  /** `error` for a count of trouble, such as devices offline. */
  tone?: "quiet" | "error";
  /** Seconds before the ticker lands, so a row of tallies settles in turn. */
  delay?: number;
};

/** A count as the home ledgers draw it: an odometer number over a tracking-caps label. */
export function Tally({ value, of, text, label, tone = "quiet", delay = 0 }: TallyProps) {
  const color = tone === "error" ? "text-error" : "text-ink";
  return (
    <span className="flex min-w-0 flex-col items-center justify-center gap-2 px-3">
      <span className="flex items-baseline gap-0.5">
        {text !== undefined ? (
          <span className={`font-numeric text-[28px] font-medium tracking-tight ${color}`}>{text}</span>
        ) : (
          <Ticker value={value} delay={delay} className={`text-[28px] font-medium tracking-tight ${color}`} />
        )}
        {of !== undefined ? <span className="font-numeric text-[13px] text-ink-ghost tabular-nums">/{of}</span> : null}
      </span>
      <span className={`truncate text-[10px] font-medium tracking-[2px] ${tone === "error" ? "text-error" : "text-sage-deep"}`}>
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
 * One device as it sits in a room: its family's form over its name and reading, with its
 * battery and bridge marked in the corner. The tile's modifiers carry its state.
 */
export function DeviceFace({ device, pending, ghost = false }: DeviceFaceProps) {
  const family = familyOf(device);
  const tone = family.tone(device);
  const battery = device.state.battery?.value;
  const { Form } = family;
  return (
    <div
      aria-busy={pending}
      title={productSubtitle(device) ?? undefined}
      className={`ghar-tile ${tone.on ? "ghar-tile--on" : ""} ${tone.run ? "ghar-tile--run" : ""} ${
        tone.alert ? "ghar-tile--alert" : ""
      } ${tone.danger ? "ghar-tile--danger" : ""} ${pending ? "ghar-tile--pending" : ""} ${
        device.online ? "" : "ghar-tile--offline"
      } ${ghost ? "ghar-tile--ghost" : ""}`}
      style={family.style?.(device)}
    >
      <span className="pointer-events-none absolute top-1.5 left-2 flex items-center gap-1">
        {typeof battery === "number" ? (
          <span className={`ghar-battery ${battery < 20 ? "ghar-battery--low" : ""}`} title={`Battery ${Math.round(battery)}%`}>
            <i style={{ width: `${Math.max(4, Math.min(100, battery))}%` }} />
          </span>
        ) : null}
        {device.bridge_name ? (
          <span className="text-[9px] tracking-[0.12em] text-ink-faint uppercase">via {device.bridge_name}</span>
        ) : null}
      </span>
      <span className="ghar-tile__stage">
        <Form device={device} />
      </span>
      <span className="relative block min-w-0 text-center">
        <span className="block truncate text-[12.5px] leading-tight font-medium text-ink">{device.name}</span>
        <span className="ghar-tile__reading mt-1 flex h-[13px] items-center justify-center font-numeric text-[11px] leading-none">
          <span className="truncate">
            {!device.online ? "Offline" : pending ? "Waiting…" : family.reading(device)}
          </span>
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

/** A device where it sits, wired to the house: a tap does its primary action, hover opens its controls, a move drags it to another room. */
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
      className={`touch-pan-y transition-opacity duration-slow ease-dadi ${dimmed ? "opacity-30" : ""}`}
    >
      <DeviceFace device={device} pending={pending} />
    </div>
  );
}

export type RoomPanelProps = DeviceHandlers & {
  room: RoomRef;
  /** Every device in the room, for its summary, its temperature and its light. */
  inRoom: GharDevice[];
  /** The devices search leaves showing. */
  devices: GharDevice[];
  /** Place in the grid, to stagger the panels in. */
  index: number;
  /** A dragged device is over the room. */
  hot: boolean;
  /** Unplaced is the only room: it spans the page. */
  wide: boolean;
  /** Briefly drawn out, after the horizon pointed at it. */
  flash: boolean;
  pendingIds: ReadonlySet<string>;
  draggingId: string | null;
  onToggleRoom: () => void;
  /** Open the pairing sheet; shown in Unplaced. */
  onPair: () => void;
};

/**
 * One room: a glass panel lit from above by its lit lamps, its name in tracking caps, what its
 * lights are doing, its temperature and a switch for all of its lights, over a floor of its
 * devices. Unplaced is the dashed pairing zone. Devices are dropped onto any panel to move them.
 */
export function RoomPanel({
  room,
  inRoom,
  devices,
  index,
  hot,
  wide,
  flash,
  pendingIds,
  draggingId,
  onToggleRoom,
  onPair,
  ...handlers
}: RoomPanelProps) {
  const unplaced = room.name === "unassigned";
  const lamps = inRoom.filter((device) => isLamp(device) && device.online);
  const lit = lamps.some(isLit);
  const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
  const glow = unplaced ? null : roomGlow(lamps, "top");
  const temperature = unplaced ? null : roomTemperature(inRoom);
  const heating = inRoom.some((device) => device.state.running?.value === "heating");
  return (
    <motion.section
      data-room-id={room.id}
      aria-label={roomTitle(room.name)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay: index * 0.05 }}
      className={`ghar-room ${unplaced ? "ghar-room--unplaced" : ""} ${hot || flash ? "ghar-room--hot" : ""} ${
        wide ? "col-span-full" : ""
      }`}
    >
      <span aria-hidden className="ghar-room__light" style={{ backgroundImage: glow ?? "none", opacity: glow ? 1 : 0 }} />
      <header className="relative flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-[11px] font-medium tracking-[2.5px] text-sage-deep uppercase">{roomTitle(room.name)}</h2>
          <p className={`mt-1 truncate text-[12px] ${lit ? "text-ink-muted" : "text-ink-ghost"}`}>
            {unplaced ? "New devices land here · drag one into a room" : roomSummary(inRoom)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {temperature !== null ? (
            <span className="flex items-center gap-1.5 font-numeric text-[12px] text-ink-muted">
              <span aria-hidden className={`size-1.5 rounded-full ${heating ? "bg-[var(--clay)]" : "bg-[var(--tide)]"}`} />
              {temperature.toFixed(1)}°
            </span>
          ) : null}
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
        </div>
      </header>
      <div className="ghar-room__floor">
        {unplaced ? (
          <button
            type="button"
            onClick={onPair}
            className="flex items-center gap-3.5 rounded-[var(--radius)] border border-dashed border-sage-line bg-[var(--glass-sheet)] px-3.5 py-3 text-left transition-[border-color] duration-slow ease-dadi hover:border-sage"
          >
            <span className="grid size-[34px] shrink-0 place-items-center rounded-full border border-dashed border-sage text-[18px] text-sage-deep">
              +
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink">Add a device</span>
              <span className="block text-[12px] text-ink-ghost">Matter pairing code or QR text</span>
            </span>
          </button>
        ) : null}
        {devices.length > 0 ? (
          <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(112px,1fr))]">
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
  /** Every device in the room. */
  inRoom: GharDevice[];
  pendingIds: ReadonlySet<string>;
  onToggle: () => void;
};

/**
 * Home tile row for one room: its name, a bead per lamp glowing its color and a small mark per
 * other device (clay when it needs a look), washed from the right in its lit lamps' light.
 * A tap switches the room's lights and does not open the page.
 */
export function RoomRow({ room, inRoom, pendingIds, onToggle }: RoomRowProps) {
  const lamps = inRoom.filter(isLamp);
  const others = inRoom.filter((device) => !isLamp(device));
  const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
  const glow = roomGlow(lamps, "end");
  return (
    <button
      type="button"
      aria-pressed={lamps.some(isLit)}
      aria-busy={pending}
      aria-label={`${roomTitle(room.name)} lights`}
      disabled={pending || lamps.length === 0}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="ghar-row h-[30px]"
      style={glow ? { backgroundImage: glow } : undefined}
    >
      <span className="truncate text-[13px] text-ink">{roomTitle(room.name)}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {lamps.map((lamp) => (
          <LampFixture key={lamp.id} device={lamp} size="dot" pending={pendingIds.has(lamp.id)} />
        ))}
        {others.slice(0, lamps.length > 0 ? 2 : 4).map((device) => (
          <span key={device.id} aria-hidden className={`ghar-mini ${attention(device) ? "ghar-mini--alert" : ""}`} />
        ))}
      </span>
    </button>
  );
}
