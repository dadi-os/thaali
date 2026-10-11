import { describe, expect, it } from "vitest";
import type { GharDevice } from "../../../types/ghar";
import { kelvinRgb, lampColor, lampLevel, roomGlow } from "./light";

/** A colour bulb with the given readings, each changed at `at` seconds. */
function bulb(state: Record<string, [unknown, number]>, on = true): GharDevice {
  return {
    id: "b",
    name: "Desk Lamp",
    product_name: null,
    room: { id: "r", name: "Den" },
    capabilities: [
      { capability: "switchable" },
      { capability: "dimmable", config: { min: 0, max: 100 } },
      { capability: "colorable", config: { modes: ["hue_sat", "color_temp"] } },
    ],
    online: true,
    last_seen_at: null,
    state: {
      on: { value: on, changed_at: new Date(0).toISOString() },
      ...Object.fromEntries(
        Object.entries(state).map(([key, [value, at]]) => [key, { value, changed_at: new Date(at * 1000).toISOString() }]),
      ),
    },
  };
}

describe("light", () => {
  it("warms toward red-orange at low kelvin and whitens at daylight", () => {
    const [r1, , b1] = kelvinRgb(2000);
    expect(r1).toBe(255);
    expect(b1).toBeLessThan(80);
    const [r2, g2, b2] = kelvinRgb(6600);
    expect(Math.min(r2, g2, b2)).toBeGreaterThan(230);
  });

  it("colors a lamp by whichever of hue or white Ghar heard change last, white on a tie", () => {
    expect(lampColor(bulb({ hue: [127, 5], saturation: [254, 5], color_temp: [250, 1] }))).toBe("hsl(180 100% 58%)");
    expect(lampColor(bulb({ hue: [127, 1], saturation: [254, 1], color_temp: [250, 5] }))).toMatch(/^rgb\(/);
    expect(lampColor(bulb({ hue: [127, 3], color_temp: [250, 3] }))).toMatch(/^rgb\(/);
    expect(lampColor(bulb({}))).toBeNull();
  });

  it("reads level over the dimmable range and glows only lit lamps", () => {
    expect(lampLevel(bulb({ brightness: [50, 1] }))).toBe(0.5);
    expect(roomGlow([bulb({ brightness: [50, 1] }, false)], "top")).toBeNull();
    expect(roomGlow([bulb({ brightness: [50, 1] }), bulb({}, true)], "end")?.split("radial-gradient")).toHaveLength(3);
    expect(roomGlow([{ ...bulb({ brightness: [50, 1] }), online: false }], "top")).toBeNull();
  });
});
