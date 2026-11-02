/**
 * How the Ghar page and the Home tile read the house: rooms and groups as sections, what a device says
 * about itself, the commands the controls send, and the state Ghar holds once it accepts a command.
 */

import type { GharCapabilityName, GharCommand, GharDevice, GharRoom } from "../../types/ghar";

/** Ghar's seeded room for devices not placed in a room yet. */
export const UNASSIGNED_ROOM = "unassigned";

/** The warm colour a light glows when it reports no colour of its own. */
const WARM = "#f0a868";

/** Evening: every light on at this brightness and this warm white (2700 K). */
export const EVENING = { level: 40, mireds: 370 } as const;

/** The coolest and warmest whites a light's colour temperature slider spans, in mireds. */
const COOL_MIREDS = 150;
const WARM_MIREDS = 500;

/** Heat setpoint steps the thermostat's stepper takes, in degrees. */
export const SETPOINT_STEP = 0.5;

/** One command for one device. */
export type DeviceCommand = { id: string; command: GharCommand };

/** What the chips filter the page to. */
export type Filter = { kind: "everywhere" } | { kind: "room"; id: string } | { kind: "group"; name: string };

/** A run of tiles under one header: a room, or a group (a Ghar tag) across rooms. */
export type Section = {
  /** `room` and `unassigned` are rooms (the second holds the devices nobody has placed); `group` crosses rooms. */
  kind: "room" | "unassigned" | "group";
  key: string;
  title: string;
  /** The room, for a room section; null for a group. */
  room: GharRoom | null;
  devices: GharDevice[];
};

/** A one-tap colour for a light: its white (mireds) or its hue and saturation (each 0 to 254). */
export type Preset =
  | { name: string; swatch: string; mode: "color_temp"; mireds: number }
  | { name: string; swatch: string; mode: "hue_sat"; hue: number; saturation: number };

/** Human label for a room. The seeded room is the pile of devices nobody has placed. */
export function roomTitle(name: string): string {
  return name === UNASSIGNED_ROOM ? "Unassigned" : name;
}

/** Whether the device has a capability. */
export function has(device: GharDevice, name: GharCapabilityName): boolean {
  return device.capabilities.some((cap) => cap.capability === name);
}

/** The colour modes a light's colour capability offers: `color_temp`, `hue_sat`. */
export function colorModes(device: GharDevice): string[] {
  const modes = device.capabilities.find((cap) => cap.capability === "color")?.config.modes;
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === "string") : [];
}

/** A number the device reports under `key`, or null. */
export function num(device: GharDevice, key: string): number | null {
  const value = device.state[key]?.value;
  return typeof value === "number" ? value : null;
}

export function isLight(device: GharDevice): boolean {
  return device.kind === "light";
}

/** True when the device reports whether it is on, so it has a switch. */
export function isSwitchable(device: GharDevice): boolean {
  return typeof device.state.on?.value === "boolean";
}

/** True when the device is reachable and Ghar last heard it on. */
export function isOn(device: GharDevice): boolean {
  return device.online && device.state.on?.value === true;
}

/** True for a light the quick actions and room controls can reach. */
export function isReachableLight(device: GharDevice): boolean {
  return device.online && isLight(device) && has(device, "on_off");
}

/** The colour of a light's dot and slider: grey when off, its hue when it shows one, warm white otherwise. */
export function lightColor(device: GharDevice): string {
  if (device.state.on?.value !== true) {
    return "var(--ink-ghost)";
  }
  if (device.state.color_mode?.value === "hue_sat") {
    return `hsl(${Math.round((Number(device.state.hue?.value ?? 0) / 254) * 360)} ${Math.round((Number(device.state.saturation?.value ?? 0) / 254) * 100)}% 58%)`;
  }
  return WARM;
}

/** What a device is doing now, in a few words: "On · 62%", "Off", "60% open", "Offline". */
export function stateLine(device: GharDevice): string {
  const { state } = device;
  if (!device.online) {
    return "Offline";
  }
  if (isSwitchable(device)) {
    if (state.on?.value !== true) {
      return "Off";
    }
    return isLight(device) || state.brightness ? `On · ${num(device, "brightness") ?? 100}%` : "On";
  }
  if (device.kind === "cover") {
    return `${num(device, "lift_percent_open") ?? 0}% open`;
  }
  if (device.kind === "thermostat") {
    return `${num(device, "local_temperature")}° · heat to ${num(device, "heat_setpoint")}°`;
  }
  if (device.kind === "occupancy") {
    return state.occupied?.value === true ? "Occupied" : "Not occupied";
  }
  return "Online";
}

/** "2800 K" for a white at `mireds`. */
export function kelvinLabel(mireds: number): string {
  return `${Math.round(1_000_000 / mireds)} K`;
}

/** Where a white sits on the colour temperature slider, 0 to 100: the warm end at 500 mireds, the cool end at 150. */
export function warmthPercent(mireds: number): number {
  return Math.max(0, Math.min(100, ((WARM_MIREDS - mireds) / (WARM_MIREDS - COOL_MIREDS)) * 100));
}

/** The mireds at a point 0 to 1 along the colour temperature slider. */
export function warmthMireds(fraction: number): number {
  return Math.round(WARM_MIREDS - fraction * (WARM_MIREDS - COOL_MIREDS));
}

/** A light's mireds when it shows a white, else null. */
export function whiteMireds(device: GharDevice): number | null {
  const mireds = num(device, "color_temp");
  return mireds !== null && mireds > 0 && device.state.color_mode?.value !== "hue_sat" ? mireds : null;
}

/** The one-tap colours under the sliders. */
export const PRESETS: readonly Preset[] = [
  { name: "Candle", swatch: "#ffb46b", mode: "color_temp", mireds: 454 },
  { name: "Warm white", swatch: "#ffe2bc", mode: "color_temp", mireds: 370 },
  { name: "Daylight", swatch: "#f4f7ff", mode: "color_temp", mireds: 154 },
  { name: "Peach", swatch: "#ffaa82", mode: "hue_sat", hue: 13, saturation: 124 },
  { name: "Sage", swatch: "#a9c79a", mode: "hue_sat", hue: 71, saturation: 90 },
];

/** The presets a light can show: whites need colour temperature, hues need hue and saturation. */
export function presetsFor(device: GharDevice): Preset[] {
  const modes = colorModes(device);
  return PRESETS.filter((preset) => modes.includes(preset.mode));
}

/** The preset a light is showing, within a step of its slider, or null. */
export function activePreset(device: GharDevice): string | null {
  const mireds = whiteMireds(device);
  const match = presetsFor(device).find((preset) =>
    preset.mode === "color_temp"
      ? mireds !== null && Math.abs(mireds - preset.mireds) <= 10
      : device.state.color_mode?.value === "hue_sat" &&
        Math.abs((num(device, "hue") ?? -99) - preset.hue) <= 4 &&
        Math.abs((num(device, "saturation") ?? -99) - preset.saturation) <= 12,
  );
  return match ? match.name : null;
}

/** The command that shows a preset. */
export function presetCommand(preset: Preset): GharCommand {
  return preset.mode === "color_temp" ? temperatureCommand(preset.mireds) : hueCommand(preset.hue, preset.saturation);
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Every room as a section in the order Ghar lists them with Unassigned last (and only when it holds devices),
 * each with its devices as Ghar lists them. A device whose room is missing from `rooms` brings its own.
 */
export function roomSections(devices: GharDevice[], rooms: GharRoom[]): Section[] {
  const sections = new Map<string, Section>();
  const add = (room: GharRoom) => {
    const section: Section = {
      kind: room.name === UNASSIGNED_ROOM ? "unassigned" : "room",
      key: `room:${room.id}`,
      title: roomTitle(room.name),
      room,
      devices: [],
    };
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
  return [...sections.values()].sort((a, b) => Number(a.kind === "unassigned") - Number(b.kind === "unassigned"));
}

/** Every group (Ghar tag) any device carries, by name. */
export function groupNames(devices: GharDevice[]): string[] {
  return [...new Set(devices.flatMap((device) => device.tags.map((tag) => tag.name)))].sort(byName);
}

/** One group as a section: the devices that carry the tag, as Ghar lists them. */
export function groupSection(devices: GharDevice[], name: string): Section {
  return { kind: "group", key: `group:${name}`, title: name, room: null, devices: devices.filter((device) => device.tags.some((tag) => tag.name === name)) };
}

/** The sections a filter shows: every room, one room, or one group. */
export function sectionsFor(filter: Filter, devices: GharDevice[], rooms: GharRoom[]): Section[] {
  if (filter.kind === "group") {
    return [groupSection(devices, filter.name)];
  }
  const all = roomSections(devices, rooms).filter((section) => section.kind !== "unassigned" || section.devices.length > 0);
  return filter.kind === "room" ? all.filter((section) => section.room?.id === filter.id) : all;
}

/** How many lights a set of devices holds and how many are on. */
export function countLights(devices: GharDevice[]): { lights: number; on: number } {
  const lights = devices.filter(isLight);
  return { lights: lights.length, on: lights.filter(isOn).length };
}

/** A section's line next to its name: "1 of 2 on", or its device count when it holds no light. */
export function sectionMeta(devices: GharDevice[]): string {
  const { lights, on } = countLights(devices);
  return lights > 0 ? `${on} of ${lights} on` : `${devices.length} ${devices.length === 1 ? "device" : "devices"}`;
}

/** The mean brightness 0 to 100 of the lit dimmable lights in a set, or 0 when none is lit. */
export function sectionLevel(devices: GharDevice[]): number {
  const levels = devices.filter((device) => isLight(device) && isOn(device) && has(device, "level")).map((device) => num(device, "brightness") ?? 100);
  return levels.length > 0 ? Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length) : 0;
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

/** Open, stop or close a cover. */
export function coverCommand(command: "open" | "stop" | "close"): GharCommand {
  return { capability: "cover", command };
}

/** Move a cover to `percent` open. */
export function liftCommand(percent: number): GharCommand {
  return { capability: "cover", command: "go_to_lift", params: { percent_open: percent } };
}

/** Set a thermostat's heat setpoint to `celsius`. */
export function setpointCommand(celsius: number): GharCommand {
  return { capability: "thermostat", command: "set_setpoint", params: { heat_c: celsius } };
}

/** Switch every reachable light: all off when any is on, else all on. */
export function sectionSwitch(devices: GharDevice[]): DeviceCommand[] {
  const lights = devices.filter(isReachableLight);
  const anyOn = lights.some(isOn);
  return lights.filter((device) => isOn(device) === anyOn).map((device) => ({ id: device.id, command: switchCommand(!anyOn) }));
}

/** Every reachable light that is on, off. */
export function allOff(devices: GharDevice[]): DeviceCommand[] {
  return devices.filter((device) => isReachableLight(device) && isOn(device)).map((device) => ({ id: device.id, command: switchCommand(false) }));
}

/** Every reachable dimmable light to `level`, which turns it on. */
export function sectionLevelCommands(devices: GharDevice[], level: number): DeviceCommand[] {
  return devices.filter((device) => isReachableLight(device) && has(device, "level")).map((device) => ({ id: device.id, command: levelCommand(level) }));
}

/**
 * Evening for one light: warm white first where it can show a white (Ghar applies colour while
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
  if (command.capability === "cover" && command.command === "go_to_lift") {
    return set({ lift_percent_open: params.percent_open });
  }
  if (command.capability === "cover" && command.command === "open") {
    return set({ lift_percent_open: 100 });
  }
  if (command.capability === "cover" && command.command === "close") {
    return set({ lift_percent_open: 0 });
  }
  if (command.capability === "thermostat" && command.command === "set_setpoint" && params.heat_c !== undefined) {
    return set({ heat_setpoint: params.heat_c });
  }
  return device;
}
