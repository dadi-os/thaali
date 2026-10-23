import { describe, expect, it } from "vitest";
import type { GharDevice, GharRoom } from "../../types/ghar";
import {
  activePreset,
  allOff,
  applyCommand,
  evening,
  eveningCommands,
  EVENING,
  groupNames,
  groupSection,
  headline,
  hueRgb,
  kelvinRgb,
  lightRgb,
  roomSections,
  sectionLevel,
  sectionsFor,
  sectionStatus,
  sectionSwitch,
  summarize,
  tileLook,
  tileStatus,
  warmthFraction,
  warmthMireds,
} from "./model";

const AT = "2026-10-22T20:00:00.000Z";
const LATER = "2026-10-22T21:00:00.000Z";

const bedroom: GharRoom = { id: "r1", name: "Ankur's room" };
const kitchen: GharRoom = { id: "r2", name: "Kitchen" };
const unplaced: GharRoom = { id: "r0", name: "unassigned" };

type LightOptions = {
  room?: GharRoom;
  on?: boolean;
  brightness?: number;
  white?: number;
  hue?: [number, number];
  tags?: string[];
  online?: boolean;
  modes?: string[];
};

function light(id: string, name: string, options: LightOptions = {}): GharDevice {
  const state: GharDevice["state"] = {};
  const put = (key: string, value: unknown) => {
    state[key] = { value, changed_at: AT };
  };
  put("on", options.on ?? false);
  put("brightness", options.brightness ?? 100);
  if (options.white !== undefined) {
    put("color_temp", options.white);
    put("color_mode", "color_temp");
  }
  if (options.hue !== undefined) {
    put("hue", options.hue[0]);
    put("saturation", options.hue[1]);
    put("color_mode", "hue_sat");
  }
  return {
    id,
    name,
    kind: "light",
    product_name: "Smart RGBTW Bulb",
    bridge_name: null,
    room: options.room ?? bedroom,
    tags: (options.tags ?? []).map((tag) => ({ id: `t-${tag}`, name: tag })),
    capabilities: [
      { capability: "on_off", config: {} },
      { capability: "level", config: { min: 0, max: 100 } },
      { capability: "color", config: { modes: options.modes ?? ["hue_sat", "color_temp"] } },
    ],
    online: options.online ?? true,
    last_seen_at: AT,
    state,
  };
}

const desk = light("d1", "Desk Lamp", { on: true, brightness: 80, white: 357 });
const left = light("d2", "Left Nightstand", { hue: [13, 124], tags: ["Nightstands"] });
const right = light("d3", "Right Nightstand", { on: true, brightness: 60, hue: [13, 124], tags: ["Nightstands"] });
const kettle: GharDevice = {
  ...light("d4", "Kettle", { room: kitchen }),
  kind: "plug",
  capabilities: [{ capability: "on_off", config: {} }],
  state: { on: { value: true, changed_at: AT } },
  tags: [],
};

describe("grouping by room and tag", () => {
  it("lists every named room by name, empty ones too, and Unplaced last only when it holds devices", () => {
    const stray = light("d5", "Hall Lamp", { room: unplaced });
    expect(roomSections([desk, kettle], [unplaced, kitchen, bedroom]).map((s) => s.title)).toEqual(["Ankur's room", "Kitchen"]);
    expect(roomSections([stray, desk], [unplaced, kitchen, bedroom]).map((s) => s.title)).toEqual(["Ankur's room", "Kitchen", "Unplaced"]);
  });

  it("sorts a room's devices by name and brings in a room missing from the list", () => {
    const sections = roomSections([right, desk, left, kettle], [bedroom]);
    expect(sections[0]?.devices.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
    expect(sections[1]?.room).toEqual(kitchen);
  });

  it("collects groups from tags and shows a group across rooms", () => {
    const hall = light("d6", "Hall Lamp", { room: kitchen, tags: ["Nightstands", "Downstairs"] });
    const devices = [desk, left, right, hall];
    expect(groupNames(devices)).toEqual(["Downstairs", "Nightstands"]);
    expect(groupSection(devices, "Nightstands").devices.map((d) => d.id)).toEqual(["d6", "d2", "d3"]);
  });

  it("filters to one room or one group", () => {
    const devices = [desk, left, right, kettle];
    expect(sectionsFor({ kind: "room", id: "r2" }, devices, [bedroom, kitchen]).map((s) => s.title)).toEqual(["Kitchen"]);
    expect(sectionsFor({ kind: "group", name: "Nightstands" }, devices, [bedroom]).map((s) => s.room)).toEqual([null]);
    expect(sectionsFor({ kind: "everywhere" }, devices, [bedroom, kitchen])).toHaveLength(2);
  });
});

describe("the room summary", () => {
  it("counts lit lights, averages their brightness and names their colors once", () => {
    const summary = summarize([desk, left, right, kettle]);
    expect(summary).toMatchObject({ lights: 3, on: 2, brightness: 70, names: ["Warm white", "Peach"] });
    expect(sectionStatus(summary, 4)).toBe("2 of 3 on · Warm white, peach");
    expect(headline(summary)).toBe("2 of 3 lights on");
  });

  it("reads all off, no lights, and an empty room", () => {
    const off = summarize([left]);
    expect(off.brightness).toBeNull();
    expect(off.color).toBeNull();
    expect(sectionStatus(off, 1)).toBe("All off");
    expect(headline(off)).toBe("All lights off");
    expect(sectionStatus(summarize([kettle]), 1)).toBe("1 device");
    expect(sectionStatus(summarize([]), 0)).toBe("Nothing here yet");
    expect(headline(summarize([kettle]))).toBe("No lights yet");
  });

  it("does not count an offline light as on", () => {
    expect(summarize([light("d7", "Porch", { on: true, online: false })]).on).toBe(0);
  });
});

describe("tile color from state", () => {
  it("lights a tile in its white, stronger the brighter it is", () => {
    const look = tileLook(desk)!;
    const [r, g, b] = kelvinRgb(1_000_000 / 357);
    expect(look.disc).toBe(`rgb(${r} ${g} ${b})`);
    expect(look.fill).toBe(`color-mix(in srgb, rgb(${r} ${g} ${b}) 32%, transparent)`);
    expect(look.border).toBe(`color-mix(in srgb, rgb(${r} ${g} ${b}) 90%, transparent)`);
  });

  it("leaves an off or offline tile quiet", () => {
    expect(tileLook(left)).toBeNull();
    expect(tileLook(light("d7", "Porch", { on: true, online: false }))).toBeNull();
  });

  it("colors a hue at full value, white at no saturation", () => {
    expect(hueRgb(0, 1)).toEqual([255, 0, 0]);
    expect(hueRgb(120, 0)).toEqual([255, 255, 255]);
    expect(lightRgb(right)).toEqual(hueRgb((13 / 254) * 360, 124 / 254));
  });

  it("takes the reading that changed last when the light reports no color mode", () => {
    const device = light("d8", "Lamp", { on: true });
    device.state.color_temp = { value: 250, changed_at: AT };
    device.state.hue = { value: 170, changed_at: LATER };
    device.state.saturation = { value: 254, changed_at: LATER };
    expect(lightRgb(device)).toEqual(hueRgb((170 / 254) * 360, 1));
  });

  it("says brightness and color when on, Off, Offline, or the kind for a device with no switch", () => {
    expect(tileStatus(desk)).toBe("80% · Warm white");
    expect(tileStatus(right)).toBe("60% · Peach");
    expect(tileStatus(left)).toBe("Off");
    expect(tileStatus(kettle)).toBe("On");
    expect(tileStatus(light("d7", "Porch", { online: false }))).toBe("Offline");
    expect(tileStatus({ ...kettle, kind: "air_quality", state: {} })).toBe("Air quality");
  });
});

describe("Evening and the room controls", () => {
  it("sets a warm white before the evening brightness, which turns the light on", () => {
    expect(eveningCommands(left)).toEqual([
      { capability: "color", command: "temperature", params: { mireds: EVENING.mireds } },
      { capability: "level", command: "move_to", params: { level: EVENING.level } },
    ]);
    expect(EVENING.level).toBe(40);
    expect(Math.round(1_000_000 / EVENING.mireds)).toBeLessThan(3000);
  });

  it("skips the white on a light that cannot show one, and leaves offline lights and plugs alone", () => {
    expect(eveningCommands(light("d9", "Strip", { modes: ["hue_sat"] }))).toEqual([
      { capability: "level", command: "move_to", params: { level: 40 } },
    ]);
    expect(evening([kettle, light("d7", "Porch", { online: false })])).toEqual([]);
  });

  it("switches a room off when any light is on, else every light on", () => {
    expect(sectionSwitch([desk, left, right])).toEqual([
      { id: "d1", command: { capability: "on_off", command: "off" } },
      { id: "d3", command: { capability: "on_off", command: "off" } },
    ]);
    expect(sectionSwitch([left])).toEqual([{ id: "d2", command: { capability: "on_off", command: "on" } }]);
    expect(allOff([desk, left, kettle]).map((c) => c.id)).toEqual(["d1"]);
  });

  it("sets every dimmable light in a room to one brightness", () => {
    expect(sectionLevel([desk, left, kettle], 55).map((c) => [c.id, c.command.params])).toEqual([
      ["d1", { level: 55 }],
      ["d2", { level: 55 }],
    ]);
  });
});

describe("accepted commands", () => {
  it("holds the state Ghar reports once a command is accepted", () => {
    const leveled = applyCommand(left, { capability: "level", command: "move_to", params: { level: 30 } });
    expect([leveled.state.on?.value, leveled.state.brightness?.value]).toEqual([true, 30]);
    const warm = applyCommand(right, { capability: "color", command: "temperature", params: { mireds: 454 } });
    expect([warm.state.color_temp?.value, warm.state.color_mode?.value]).toEqual([454, "color_temp"]);
    expect(activePreset(warm)).toBe("Candle");
    expect(applyCommand(desk, { capability: "on_off", command: "off" }).state.on?.value).toBe(false);
  });

  it("maps the Warmth slider between its ends and back", () => {
    expect(warmthFraction(500)).toBe(0);
    expect(warmthMireds(1)).toBe(154);
    expect(warmthMireds(warmthFraction(370))).toBe(370);
  });
});
