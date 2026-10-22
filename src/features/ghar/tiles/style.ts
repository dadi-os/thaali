/**
 * How the Ghar tiles read a device: which room it is grouped under, the color it glows when
 * on, its line of status, and the brightness pill's level from a pointer.
 */

import type { GharDevice, GharRoom } from "../../../types/ghar";
import { roomTitle } from "../commission";
import { familyOf } from "../house/families";
import { isLamp, lampColor } from "../house/light";

/** A lit lamp that reports no color glows warm white, as on the phone. */
export const WARM_LAMP = "rgb(255 217 153)";

/** Anything on that is not a lamp glows in dadi's clay. */
export const DEVICE_GLOW = "var(--clay)";

/** One room's tiles. */
export type RoomGroup = { room: GharRoom; title: string; devices: GharDevice[] };

/** True when Ghar last heard the device on and it is reachable. */
export function tileOn(device: GharDevice): boolean {
  return device.online && device.state.on?.value === true;
}

/** The color a tile glows when its device is on: a lamp's own light, else clay. */
export function tileGlow(device: GharDevice): string {
  if (!isLamp(device)) {
    return DEVICE_GLOW;
  }
  return lampColor(device) ?? WARM_LAMP;
}

/** "On · 80%", "Off", "Offline", or the family's own reading for sensors and the rest. */
export function tileStatus(device: GharDevice): string {
  if (!device.online) {
    return "Offline";
  }
  const on = device.state.on?.value;
  if (typeof on === "boolean") {
    if (!on) {
      return "Off";
    }
    const brightness = device.state.brightness?.value;
    return isLamp(device) && typeof brightness === "number" ? `On · ${Math.round(brightness)}%` : "On";
  }
  return familyOf(device).reading(device);
}

/** True when a tile has controls beyond its tap: brightness, color, or its family's controls. */
export function hasControls(device: GharDevice): boolean {
  return device.capabilities.some((cap) => cap.capability !== "on_off" && cap.capability !== "power_source");
}

/**
 * Rooms that hold devices, by name with Unplaced last, each with its devices by name.
 * `only` keeps one room. A device's own room stands in for a room missing from the list.
 */
export function groupByRoom(devices: GharDevice[], rooms: GharRoom[], only: string | null): RoomGroup[] {
  const known = new Map(rooms.map((room) => [room.id, room]));
  const groups = new Map<string, RoomGroup>();
  for (const device of devices) {
    if (only !== null && device.room.id !== only) {
      continue;
    }
    const room = known.get(device.room.id) ?? device.room;
    let group = groups.get(room.id);
    if (!group) {
      group = { room, title: roomTitle(room.name), devices: [] };
      groups.set(room.id, group);
    }
    group.devices.push(device);
  }
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  for (const group of groups.values()) {
    group.devices.sort((a, b) => byName(a.name, b.name));
  }
  return [...groups.values()].sort((a, b) => {
    const unplaced = Number(a.room.name === "unassigned") - Number(b.room.name === "unassigned");
    return unplaced !== 0 ? unplaced : byName(a.title, b.title);
  });
}

/** Brightness 1–100 for a pointer `y` over a pill whose top is `top` and height `height`. */
export function pillLevel(y: number, top: number, height: number): number {
  const fraction = 1 - (y - top) / height;
  return Math.round(Math.min(100, Math.max(1, fraction * 100)));
}

/** A slider value for a pointer `x` over a track, snapped to whole steps within [min, max]. */
export function trackValue(x: number, left: number, width: number, min: number, max: number): number {
  const fraction = Math.min(1, Math.max(0, (x - left) / width));
  return Math.round(min + fraction * (max - min));
}
