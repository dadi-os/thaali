import { describe, expect, it } from "vitest";
import type { GharDevice } from "../../../types/ghar";
import { DEVICE_GLOW, groupByRoom, hasControls, pillLevel, tileGlow, tileOn, tileStatus, trackValue, WARM_LAMP } from "./style";

function device(id: string, over: Partial<GharDevice> & { on?: boolean; extra?: Record<string, unknown> } = {}): GharDevice {
  const { on, extra = {}, ...rest } = over;
  const state: GharDevice["state"] = {};
  for (const [key, value] of Object.entries({ ...(on === undefined ? {} : { on }), ...extra })) {
    state[key] = { value, changed_at: new Date(0).toISOString() };
  }
  return {
    id,
    name: id,
    kind: "light",
    product_name: null,
    bridge_name: null,
    room: { id: "den", name: "Den" },
    capabilities: [{ capability: "on_off", config: {} }],
    online: true,
    last_seen_at: null,
    state,
    ...rest,
  };
}

describe("ghar tiles", () => {
  it("groups by room with Unplaced last, devices by name, and one room on request", () => {
    const rooms = [
      { id: "den", name: "Den" },
      { id: "u", name: "unassigned" },
      { id: "attic", name: "Attic" },
    ];
    const devices = [
      device("zeta"),
      device("loose", { room: { id: "u", name: "unassigned" } }),
      device("Alpha"),
      device("fan", { room: { id: "attic", name: "Attic" } }),
      device("hall", { room: { id: "gone", name: "Hall" } }),
    ];
    const groups = groupByRoom(devices, rooms, null);
    expect(groups.map((g) => g.title)).toEqual(["Attic", "Den", "Hall", "Unplaced"]);
    expect(groups[1]!.devices.map((d) => d.id)).toEqual(["Alpha", "zeta"]);
    expect(groupByRoom(devices, rooms, "den").map((g) => g.room.id)).toEqual(["den"]);
  });

  it("glows a lamp in its own light, warm white without a color, and the rest in clay", () => {
    expect(tileGlow(device("hue", { extra: { hue: 127, saturation: 254, color_mode: "hue_sat" } }))).toBe("hsl(180 100% 58%)");
    expect(tileGlow(device("plain"))).toBe(WARM_LAMP);
    expect(tileGlow(device("plug", { kind: "plug" }))).toBe(DEVICE_GLOW);
  });

  it("reads on, off, brightness and offline", () => {
    expect(tileStatus(device("a", { on: true, extra: { brightness: 80.4 } }))).toBe("On · 80%");
    expect(tileStatus(device("b", { on: false }))).toBe("Off");
    expect(tileStatus(device("c", { on: true, online: false }))).toBe("Offline");
    expect(tileOn(device("d", { on: true, online: false }))).toBe(false);
    expect(tileOn(device("e", { on: true }))).toBe(true);
  });

  it("offers controls only beyond a plain switch", () => {
    expect(hasControls(device("a"))).toBe(false);
    expect(hasControls(device("b", { capabilities: [{ capability: "on_off", config: {} }, { capability: "level", config: {} }] }))).toBe(true);
  });

  it("maps a pointer onto the pill and the sliders within their ranges", () => {
    expect(pillLevel(100, 100, 200)).toBe(100);
    expect(pillLevel(200, 100, 200)).toBe(50);
    expect(pillLevel(400, 100, 200)).toBe(1);
    expect(trackValue(-5, 0, 100, 153, 500)).toBe(153);
    expect(trackValue(50, 0, 100, 0, 254)).toBe(127);
    expect(trackValue(500, 0, 100, 153, 500)).toBe(500);
  });
});
