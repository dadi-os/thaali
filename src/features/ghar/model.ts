/**
 * How the Ghar page and the home widget read the house: rooms and groups as sections, a
 * light's real color and brightness as a tile's look, a section's summary, the commands the
 * quick actions send, and the state Ghar holds once it accepts a command.
 */

import type { GharCapabilityName, GharCommand, GharDevice, GharRoom } from "../../types/ghar";

/** Ghar's seeded room for devices not placed in a room yet. */
export const UNASSIGNED_ROOM = "unassigned";

/** 0–255 red, green and blue. */
export type Rgb = readonly [number, number, number];

/** What a lit light that reports no color glows: warm white. */
export const WARM_WHITE: Rgb = [255, 206, 150];

/** What anything lit that is not a light glows. */
export const DEVICE_GLOW = "var(--sage)";

/** The warm and cool ends of the Warmth slider, in kelvin. */
export const WARMEST_K = 2000;
export const COOLEST_K = 6500;

/** Evening: every light on at this brightness and this warm white (2700 K). */
export const EVENING = { level: 40, mireds: 370 } as const;

/** One command for one device. */
export type DeviceCommand = { id: string; command: GharCommand };

/** What the chips filter the page to. */
export type Filter = { kind: "everywhere" } | { kind: "room"; id: string } | { kind: "group"; name: string };

/** A run of tiles under one header: a room, or a group (a Ghar tag) across rooms. */
export type Section = {
  key: string;
  title: string;
  /** The room, for a room section; null for a group. */
  room: GharRoom | null;
  devices: GharDevice[];
};

/** What a section's header and the widget say about a set of devices. */
export type Summary = {
  lights: number;
  on: number;
  /** Mean brightness 0–100 of the lit lights, or null when none is lit. */
  brightness: number | null;
  /** The lit lights' colors mixed, or null when none is lit. */
  color: Rgb | null;
  /** The lit lights' color names, each once, in tile order. */
  names: string[];
};

/** A lit tile's colors; an off tile is drawn quiet by the stylesheet instead. */
export type TileLook = {
  fill: string;
  border: string;
  disc: string;
  discInk: string;
  statusInk: string;
};

/** A one-tap color for a light. */
export type Preset = { name: string; swatch: string; command: GharCommand };

/** Human label for a room. The seeded room is the unplaced pile. */
export function roomTitle(name: string): string {
  return name === UNASSIGNED_ROOM ? "Unplaced" : name;
}

export function has(device: GharDevice, name: GharCapabilityName): boolean {
  return device.capabilities.some((cap) => cap.capability === name);
}

function num(device: GharDevice, key: string): number | null {
  const value = device.state[key]?.value;
  return typeof value === "number" ? value : null;
}

/** The color modes a light's color capability supports. */
export function colorModes(device: GharDevice): string[] {
  const modes = device.capabilities.find((cap) => cap.capability === "color")?.config.modes;
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === "string") : [];
}

export function isLight(device: GharDevice): boolean {
  return device.kind === "light";
}

/** True when the device is reachable and Ghar last heard it on. */
export function isOn(device: GharDevice): boolean {
  return device.online && device.state.on?.value === true;
}

/** True for a light the quick actions and room controls can reach. */
export function isReachableLight(device: GharDevice): boolean {
  return device.online && isLight(device) && has(device, "on_off");
}

/** Brightness 0–100 for a dimmable device that has reported one, else null. */
export function brightness(device: GharDevice): number | null {
  return has(device, "level") ? num(device, "brightness") : null;
}

/**
 * kelvinRgb approximates the color of a white at `kelvin` (Tanner Helland's fit of the
 * blackbody curve, good from 1000 K to 40000 K).
 */
export function kelvinRgb(kelvin: number): Rgb {
  const t = Math.min(40_000, Math.max(1_000, kelvin)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(red), clamp(green), clamp(blue)];
}

/** The light of hue `degrees` at saturation 0–1 and full value: white at 0, the pure hue at 1. */
export function hueRgb(degrees: number, saturation: number): Rgb {
  const channel = (n: number) => {
    const k = (n + degrees / 60) % 6;
    return Math.round(255 * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

/** Whether a light is showing a white (color temperature) rather than a hue. */
function showsWhite(device: GharDevice): boolean {
  const mode = device.state.color_mode?.value;
  if (mode === "color_temp" || mode === "hue_sat") {
    return mode === "color_temp";
  }
  const hue = device.state.hue;
  const temp = device.state.color_temp;
  return !hue || (temp !== undefined && Date.parse(temp.changed_at) >= Date.parse(hue.changed_at));
}

/** A light's mireds when it shows a white, else null. */
function whiteMireds(device: GharDevice): number | null {
  const mireds = num(device, "color_temp");
  return mireds !== null && mireds > 0 && showsWhite(device) ? mireds : null;
}

/** A light's hue in degrees and saturation 0–1 when it shows a hue, else null. */
function hueReading(device: GharDevice): { degrees: number; saturation: number } | null {
  const hue = num(device, "hue");
  if (hue === null || whiteMireds(device) !== null) {
    return null;
  }
  const saturation = num(device, "saturation");
  return { degrees: (hue / 254) * 360, saturation: saturation === null ? 1 : saturation / 254 };
}

/** The color a light gives off: its white or hue, or warm white when it reports no color. */
export function lightRgb(device: GharDevice): Rgb {
  const mireds = whiteMireds(device);
  if (mireds !== null) {
    return kelvinRgb(1_000_000 / mireds);
  }
  const hue = hueReading(device);
  return hue ? hueRgb(hue.degrees, hue.saturation) : WARM_WHITE;
}

export function rgbCss([r, g, b]: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}

/** The CSS color a device glows when on: a light's own light, else sage. */
export function glow(device: GharDevice): string {
  return isLight(device) ? rgbCss(lightRgb(device)) : DEVICE_GLOW;
}

/** A white's everyday name. */
export function kelvinName(kelvin: number): string {
  if (kelvin < 2400) {
    return "Candle";
  }
  if (kelvin < 3300) {
    return "Warm white";
  }
  if (kelvin < 4500) {
    return "Soft white";
  }
  if (kelvin < 5600) {
    return "Neutral white";
  }
  return "Daylight";
}

/** A hue's everyday name; a pale one reads as white, a soft orange as peach. */
export function hueName(degrees: number, saturation: number): string {
  if (saturation < 0.15) {
    return "White";
  }
  const h = ((degrees % 360) + 360) % 360;
  if (h < 12 || h >= 345) {
    return "Red";
  }
  if (h < 42) {
    return saturation < 0.65 ? "Peach" : "Orange";
  }
  if (h < 68) {
    return "Yellow";
  }
  if (h < 160) {
    return saturation < 0.45 ? "Sage" : "Green";
  }
  if (h < 200) {
    return "Cyan";
  }
  if (h < 255) {
    return "Blue";
  }
  if (h < 295) {
    return "Purple";
  }
  return "Pink";
}

/** A light's color by name, or null for a light that reports no color. */
export function colorName(device: GharDevice): string | null {
  const mireds = whiteMireds(device);
  if (mireds !== null) {
    return kelvinName(1_000_000 / mireds);
  }
  const hue = hueReading(device);
  return hue ? hueName(hue.degrees, hue.saturation) : null;
}

/** A device's kind as words, for devices with nothing to switch. */
function kindWords(device: GharDevice): string {
  const spaced = device.kind.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "80% · Warm white", "On", "Off", "Offline", or the device's kind when it has no switch. */
export function tileStatus(device: GharDevice): string {
  if (!device.online) {
    return "Offline";
  }
  const on = device.state.on?.value;
  if (typeof on !== "boolean") {
    return kindWords(device);
  }
  if (!on) {
    return "Off";
  }
  const level = brightness(device);
  const name = isLight(device) ? colorName(device) : null;
  const parts = [level === null ? null : `${Math.round(level)}%`, name].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "On";
}

/**
 * A lit tile's colors from its light: the fill and border strengthen with brightness (about
 * 32% and 90% at 80%), the icon disc is the full color, and the inks are the color pulled
 * toward dark (the disc) or the page's ink (the status line). Null when the device is off.
 */
export function tileLook(device: GharDevice): TileLook | null {
  if (!isOn(device)) {
    return null;
  }
  const color = glow(device);
  const level = (brightness(device) ?? 100) / 100;
  const fill = Math.round(14 + 22 * level);
  const border = Math.round(50 + 50 * level);
  return {
    fill: `color-mix(in srgb, ${color} ${fill}%, transparent)`,
    border: `color-mix(in srgb, ${color} ${border}%, transparent)`,
    disc: color,
    discInk: `color-mix(in srgb, ${color} 35%, black)`,
    statusInk: `color-mix(in srgb, ${color} 40%, var(--ink))`,
  };
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Every room as a section, by name with Unplaced last (and only when it holds devices), each
 * with its devices by name. A device whose room is missing from `rooms` brings its own.
 */
export function roomSections(devices: GharDevice[], rooms: GharRoom[]): Section[] {
  const sections = new Map<string, Section>();
  const add = (room: GharRoom) => {
    const section = { key: `room:${room.id}`, title: roomTitle(room.name), room, devices: [] };
    sections.set(room.id, section);
    return section;
  };
  for (const room of rooms) {
    if (room.name !== UNASSIGNED_ROOM) {
      add(room);
    }
  }
  for (const device of devices) {
    (sections.get(device.room.id) ?? add(device.room)).devices.push(device);
  }
  for (const section of sections.values()) {
    section.devices.sort((a, b) => byName(a.name, b.name));
  }
  return [...sections.values()].sort((a, b) => {
    const unplaced = Number(a.room?.name === UNASSIGNED_ROOM) - Number(b.room?.name === UNASSIGNED_ROOM);
    return unplaced !== 0 ? unplaced : byName(a.title, b.title);
  });
}

/** Every group (Ghar tag) any device carries, by name. */
export function groupNames(devices: GharDevice[]): string[] {
  return [...new Set(devices.flatMap((device) => device.tags.map((tag) => tag.name)))].sort(byName);
}

/** One group as a section: the devices that carry the tag, by name. */
export function groupSection(devices: GharDevice[], name: string): Section {
  return {
    key: `group:${name}`,
    title: name,
    room: null,
    devices: devices.filter((device) => device.tags.some((tag) => tag.name === name)).sort((a, b) => byName(a.name, b.name)),
  };
}

/** The sections a filter shows: every room, one room, or one group. */
export function sectionsFor(filter: Filter, devices: GharDevice[], rooms: GharRoom[]): Section[] {
  if (filter.kind === "group") {
    return [groupSection(devices, filter.name)];
  }
  const all = roomSections(devices, rooms);
  return filter.kind === "room" ? all.filter((section) => section.room?.id === filter.id) : all;
}

/** How many lights are on, how bright and what color they are together. */
export function summarize(devices: GharDevice[]): Summary {
  const lights = devices.filter(isLight);
  const lit = lights.filter(isOn);
  const levels = lit.map(brightness).filter((level): level is number => level !== null);
  const colors = lit.map(lightRgb);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mix = (channel: 0 | 1 | 2) => Math.round(mean(colors.map((color) => color[channel])));
  return {
    lights: lights.length,
    on: lit.length,
    brightness: levels.length > 0 ? Math.round(mean(levels)) : null,
    color: colors.length > 0 ? [mix(0), mix(1), mix(2)] : null,
    names: [...new Set(lit.map(colorName).filter((name): name is string => name !== null))],
  };
}

/** "2 of 3 lights on", "All lights off", or "No lights yet". */
export function headline(summary: Summary): string {
  if (summary.lights === 0) {
    return "No lights yet";
  }
  return summary.on === 0 ? "All lights off" : `${summary.on} of ${summary.lights} lights on`;
}

/** A section's line under its name: "2 of 3 on · Warm white, peach", "All off", or its device count. */
export function sectionStatus(summary: Summary, devices: number): string {
  if (summary.lights === 0) {
    return devices === 0 ? "Nothing here yet" : `${devices} ${devices === 1 ? "device" : "devices"}`;
  }
  if (summary.on === 0) {
    return "All off";
  }
  const count = `${summary.on} of ${summary.lights} on`;
  if (summary.names.length === 0) {
    return count;
  }
  const names = summary.names.map((name, index) => (index === 0 ? name : name.toLowerCase())).join(", ");
  return `${count} · ${names}`;
}

export function switchCommand(on: boolean): GharCommand {
  return { capability: "on_off", command: on ? "on" : "off" };
}

export function levelCommand(level: number): GharCommand {
  return { capability: "level", command: "move_to", params: { level } };
}

export function temperatureCommand(mireds: number): GharCommand {
  return { capability: "color", command: "temperature", params: { mireds } };
}

export function hueCommand(hue: number, saturation: number): GharCommand {
  return { capability: "color", command: "hue_saturation", params: { hue, saturation } };
}

/** Switch every reachable light: all off when any is on, else all on. */
export function sectionSwitch(devices: GharDevice[]): DeviceCommand[] {
  const lights = devices.filter(isReachableLight);
  const anyOn = lights.some(isOn);
  return lights
    .filter((device) => isOn(device) === anyOn)
    .map((device) => ({ id: device.id, command: switchCommand(!anyOn) }));
}

/** Every reachable light that is on, off. */
export function allOff(devices: GharDevice[]): DeviceCommand[] {
  return devices.filter((device) => isReachableLight(device) && isOn(device)).map((device) => ({ id: device.id, command: switchCommand(false) }));
}

/** Every reachable dimmable light to `level`, which turns it on. */
export function sectionLevel(devices: GharDevice[], level: number): DeviceCommand[] {
  return devices
    .filter((device) => isReachableLight(device) && has(device, "level"))
    .map((device) => ({ id: device.id, command: levelCommand(level) }));
}

/**
 * Evening for one light: warm white first where it can show a white (Ghar applies color while
 * a light is off), then the evening brightness, which turns it on; a light that does not dim
 * is just switched on.
 */
export function eveningCommands(device: GharDevice): GharCommand[] {
  if (!isReachableLight(device)) {
    return [];
  }
  const warm = colorModes(device).includes("color_temp") ? [temperatureCommand(EVENING.mireds)] : [];
  return [...warm, has(device, "level") ? levelCommand(EVENING.level) : switchCommand(true)];
}

/** Evening for the whole house. */
export function evening(devices: GharDevice[]): DeviceCommand[] {
  return devices.flatMap((device) => eveningCommands(device).map((command) => ({ id: device.id, command })));
}

/** The device as Ghar holds it once it has accepted `command`, so the page does not wait on the refetch. */
export function applyCommand(device: GharDevice, command: GharCommand): GharDevice {
  const at = new Date().toISOString();
  const set = (values: Record<string, unknown>): GharDevice => ({
    ...device,
    state: {
      ...device.state,
      ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, changed_at: at }])),
    },
  });
  const params = command.params ?? {};
  if (command.capability === "on_off" && command.command !== "toggle") {
    return set({ on: command.command === "on" });
  }
  if (command.capability === "level" && command.command === "move_to") {
    return set(isLight(device) || device.kind === "plug" ? { brightness: params.level, on: true } : { brightness: params.level });
  }
  if (command.capability === "color" && command.command === "temperature") {
    return set({ color_temp: params.mireds, color_mode: "color_temp" });
  }
  if (command.capability === "color" && command.command === "hue_saturation") {
    return set({ hue: params.hue, saturation: params.saturation, color_mode: "hue_sat" });
  }
  return device;
}

/** A fraction 0–1 of the way along a track from `start` over `length`. */
export function trackFraction(at: number, start: number, length: number): number {
  return Math.min(1, Math.max(0, (at - start) / length));
}

/** Brightness 1–100 from a fraction; 0 would switch a light off, so a drag bottoms out at 1. */
export function levelAt(fraction: number): number {
  return Math.max(1, Math.round(fraction * 100));
}

/** Where a white sits on the Warmth slider: 0 at the warm end, 1 at the cool end. */
export function warmthFraction(mireds: number): number {
  return trackFraction(1_000_000 / mireds, WARMEST_K, COOLEST_K - WARMEST_K);
}

/** The mireds at a point on the Warmth slider. */
export function warmthMireds(fraction: number): number {
  return Math.round(1_000_000 / (WARMEST_K + fraction * (COOLEST_K - WARMEST_K)));
}

/** A light's mireds for the Warmth slider, or null when it is showing a hue. */
export function warmth(device: GharDevice): number | null {
  return whiteMireds(device);
}

/** A light's hue 0–254 and saturation 0–254 for the Color slider, or null when it shows a white. */
export function hue(device: GharDevice): { hue: number; saturation: number } | null {
  const reading = hueReading(device);
  return reading ? { hue: Math.round((reading.degrees / 360) * 254), saturation: Math.round(reading.saturation * 254) } : null;
}

/** "2800 K", to the nearest hundred. */
export function kelvinLabel(mireds: number): string {
  return `${Math.round(1_000_000 / mireds / 100) * 100} K`;
}

/** The one-tap colors under the sliders. */
export const PRESETS: readonly Preset[] = [
  { name: "Candle", swatch: "#ffb46b", command: temperatureCommand(454) },
  { name: "Warm white", swatch: "#ffe2bc", command: temperatureCommand(370) },
  { name: "Daylight", swatch: "#f4f7ff", command: temperatureCommand(154) },
  { name: "Peach", swatch: "#ffaa82", command: hueCommand(13, 124) },
  { name: "Sage", swatch: "#a9c79a", command: hueCommand(71, 90) },
];

/** The presets a light can show: whites need color temperature, hues need hue and saturation. */
export function presetsFor(device: GharDevice): Preset[] {
  const modes = colorModes(device);
  return PRESETS.filter((preset) => modes.includes(preset.command.command === "temperature" ? "color_temp" : "hue_sat"));
}

/** The preset a light is showing, within a step of the slider, or null. */
export function activePreset(device: GharDevice): string | null {
  const mireds = whiteMireds(device);
  const shown = hue(device);
  const match = PRESETS.find((preset) => {
    const params = preset.command.params ?? {};
    if (preset.command.command === "temperature") {
      return mireds !== null && Math.abs(mireds - Number(params.mireds)) <= 10;
    }
    return shown !== null && Math.abs(shown.hue - Number(params.hue)) <= 4 && Math.abs(shown.saturation - Number(params.saturation)) <= 12;
  });
  return match ? match.name : null;
}
