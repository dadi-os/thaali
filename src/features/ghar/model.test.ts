import { describe, expect, it } from "vitest";
import type { GharDevice } from "../../types/ghar";
import {
  activePreset,
  allOff,
  applyCommand,
  coverCommand,
  devicesFor,
  evening,
  eveningCommands,
  EVENING,
  liftCommand,
  sectionLevel,
  sectionLevelCommands,
  sectionMeta,
  sectionSwitch,
  setpointCommand,
  stateLine,
  tagGroups,
  tagLights,
  untaggedDevices,
  warmthMireds,
  warmthPercent,
} from "./model";

const AT = "2026-10-22T20:00:00.000Z";

type LightOptions = {
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
  ...light("d4", "Kettle"),
  kind: "plug",
  capabilities: [{ capability: "on_off", config: {} }],
  state: { on: { value: true, changed_at: AT } },
  tags: [],
};

describe("grouping by tag", () => {
  const lamp = light("d8", "Reading Lamp", { on: true, tags: ["Nightstands", "all lights", "reading"] });

  it("lists every tag any device carries by name, a device under each of its tags", () => {
    const groups = tagGroups([desk, left, right, lamp, kettle]);
    expect(groups.map((group) => [group.tag.name, group.devices.map((device) => device.id)])).toEqual([
      ["all lights", ["d8"]],
      ["Nightstands", ["d2", "d3", "d8"]],
      ["reading", ["d8"]],
    ]);
  });

  it("finds the devices that carry no tag", () => {
    expect(untaggedDevices([desk, left, kettle]).map((device) => device.id)).toEqual(["d1", "d4"]);
    expect(tagGroups([desk, kettle])).toEqual([]);
  });

  it("filters to every device or one tag", () => {
    const devices = [desk, left, right, lamp, kettle];
    expect(devicesFor({ kind: "all" }, devices)).toEqual(devices);
    expect(devicesFor({ kind: "tag", name: "Nightstands" }, devices).map((device) => device.id)).toEqual(["d2", "d3", "d8"]);
    expect(devicesFor({ kind: "tag", name: "gone" }, devices)).toEqual([]);
  });

  it("orders the Home tile's cards: a tag with a light on first, the rest by name, a light on every card of its tags, none for a light with no tag", () => {
    const cards = tagLights([desk, left, right, lamp]);
    expect(cards.map((card) => [card.name, card.on, card.lights.length])).toEqual([
      ["all lights", 1, 1],
      ["Nightstands", 2, 3],
      ["reading", 1, 1],
    ]);
    expect(tagLights([left, desk]).map((card) => card.name)).toEqual(["Nightstands"]);
    expect(tagLights([])).toEqual([]);
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

describe("Evening and the tag controls", () => {
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

  it("switches a tag off when any light is on, else every light on", () => {
    expect(sectionSwitch([desk, left]).map((c) => [c.id, c.command.command])).toEqual([["d1", "off"]]);
    expect(sectionSwitch([left, light("d7", "Other")]).map((c) => c.command.command)).toEqual(["on", "on"]);
    expect(allOff([desk, left, right]).map((c) => c.id)).toEqual(["d1", "d3"]);
  });

  it("sets every dimmable light under a tag to one brightness", () => {
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
