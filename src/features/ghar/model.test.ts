import { describe, expect, it } from "vitest";
import type { GharDevice, GharRoom } from "../../types/ghar";
import {
  activePreset,
  allOff,
  applyCommand,
  coverCommand,
  evening,
  eveningCommands,
  EVENING,
  groupNames,
  groupSection,
  liftCommand,
  roomSections,
  sectionLevel,
  sectionLevelCommands,
  sectionMeta,
  sectionsFor,
  sectionSwitch,
  setpointCommand,
  stateLine,
  warmthMireds,
  warmthPercent,
} from "./model";

const AT = "2026-10-22T20:00:00.000Z";

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
  it("lists every named room in Ghar's order, empty ones too, and Unassigned last only when it holds devices", () => {
    const sections = roomSections([desk, kettle], [unplaced, kitchen, bedroom]);
    expect(sections.map((section) => [section.title, section.kind, section.devices.length])).toEqual([["Kitchen", "room", 1], ["Ankur's room", "room", 1]]);
    const placed = roomSections([desk, { ...kettle, room: unplaced }], [unplaced, bedroom]);
    expect(placed.map((section) => section.title)).toEqual(["Ankur's room", "Unassigned"]);
    expect(placed[1]?.kind).toBe("unassigned");
  });

  it("keeps a room's devices in Ghar's order and brings in a room missing from the list", () => {
    const sections = roomSections([right, left, kettle], [bedroom]);
    expect(sections[0]?.devices.map((device) => device.name)).toEqual(["Right Nightstand", "Left Nightstand"]);
    expect(sections.map((section) => section.title)).toContain("Kitchen");
  });

  it("collects groups from tags and shows a group across rooms", () => {
    expect(groupNames([desk, left, right, kettle])).toEqual(["Nightstands"]);
    const group = groupSection([desk, left, right, kettle], "Nightstands");
    expect([group.kind, group.devices.map((device) => device.id)]).toEqual(["group", ["d2", "d3"]]);
  });

  it("filters to one room or one group, hiding an Unassigned that holds nothing", () => {
    const devices = [desk, left, kettle];
    expect(sectionsFor({ kind: "everywhere" }, devices, [unplaced, bedroom, kitchen]).map((section) => section.title)).toEqual(["Ankur's room", "Kitchen"]);
    expect(sectionsFor({ kind: "room", id: "r2" }, devices, [unplaced, bedroom, kitchen]).map((section) => section.title)).toEqual(["Kitchen"]);
    expect(sectionsFor({ kind: "group", name: "Nightstands" }, devices, [bedroom])[0]?.devices).toEqual([left]);
  });
});

describe("what a section and a device say", () => {
  it("counts lit lights, and a section with no light counts its devices", () => {
    expect(sectionMeta([desk, left, right])).toBe("2 of 3 on");
    expect(sectionMeta([kettle])).toBe("1 device");
    expect(sectionMeta([])).toBe("0 devices");
  });

  it("averages the lit lights' brightness and reads 0 when none is lit", () => {
    expect(sectionLevel([desk, right, left])).toBe(70);
    expect(sectionLevel([left])).toBe(0);
  });

  it("does not count an offline light as on", () => {
    expect(sectionMeta([light("d9", "Hall", { on: true, online: false })])).toBe("0 of 1 on");
  });

  it("says brightness when on, Off, Offline, or what the kind reports", () => {
    expect(stateLine(desk)).toBe("On · 80%");
    expect(stateLine(left)).toBe("Off");
    expect(stateLine({ ...desk, online: false })).toBe("Offline");
    expect(stateLine(kettle)).toBe("On");
    const blind = { ...kettle, kind: "cover" as const, state: { lift_percent_open: { value: 60, changed_at: AT } } };
    expect(stateLine(blind)).toBe("60% open");
  });
});

describe("Evening and the room controls", () => {
  it("sets a warm white before the evening brightness, which turns the light on", () => {
    expect(eveningCommands(left)).toEqual([
      { capability: "color", command: "temperature", params: { mireds: EVENING.mireds } },
      { capability: "level", command: "move_to", params: { level: EVENING.level } },
    ]);
  });

  it("skips the white on a light that cannot show one, and leaves offline lights alone", () => {
    const dimOnly = light("d5", "Hall", { modes: [] });
    expect(eveningCommands(dimOnly)).toEqual([{ capability: "level", command: "move_to", params: { level: EVENING.level } }]);
    expect(evening([light("d6", "Out", { online: false })])).toEqual([]);
  });

  it("switches a room off when any light is on, else every light on", () => {
    expect(sectionSwitch([desk, left]).map((c) => [c.id, c.command.command])).toEqual([["d1", "off"]]);
    expect(sectionSwitch([left, light("d7", "Other")]).map((c) => c.command.command)).toEqual(["on", "on"]);
    expect(allOff([desk, left, right]).map((c) => c.id)).toEqual(["d1", "d3"]);
  });

  it("sets every dimmable light in a room to one brightness", () => {
    expect(sectionLevelCommands([desk, left, kettle], 30).map((c) => c.id)).toEqual(["d1", "d2"]);
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

  it("holds a cover's position and a thermostat's setpoint", () => {
    const blind = { ...kettle, kind: "cover" as const, capabilities: [{ capability: "cover" as const, config: {} }], state: { lift_percent_open: { value: 60, changed_at: AT } } };
    expect(applyCommand(blind, liftCommand(25)).state.lift_percent_open?.value).toBe(25);
    expect(applyCommand(blind, coverCommand("close")).state.lift_percent_open?.value).toBe(0);
    const heat = { ...kettle, kind: "thermostat" as const, state: { heat_setpoint: { value: 21, changed_at: AT } } };
    expect(applyCommand(heat, setpointCommand(21.5)).state.heat_setpoint?.value).toBe(21.5);
  });

  it("maps the colour temperature slider between its ends and back", () => {
    expect(warmthPercent(500)).toBe(0);
    expect(warmthPercent(150)).toBe(100);
    expect(warmthMireds(1)).toBe(150);
    expect(warmthMireds(warmthPercent(370) / 100)).toBe(370);
  });
});
