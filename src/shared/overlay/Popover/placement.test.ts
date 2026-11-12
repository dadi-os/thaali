import { describe, expect, it } from "vitest";
import { EDGE_PAD, placePanel, type PlaceInput } from "./placement";

const base: PlaceInput = { originX: 500, originY: 400, clearance: 30, lift: 26, width: 320, height: 200, reserve: false, maxHeight: 520, viewportW: 1000, viewportH: 800 };

/** Whether the panel placed for `input`, at its limit height, lies wholly inside the window with its margins. */
function inside(input: PlaceInput): boolean {
  const { left, top, limit } = placePanel({ ...input, reserve: true });
  return left >= EDGE_PAD && top >= EDGE_PAD && left + input.width <= input.viewportW - EDGE_PAD && top + limit <= input.viewportH - EDGE_PAD;
}

describe("placePanel", () => {
  it("sits beside the anchor, clear of it", () => {
    const placed = placePanel(base);
    expect(placed.side).toBe("left");
    expect(placed.left).toBe(530);
    expect(placed.top).toBe(374);
  });

  it("flips to the other side of the anchor near the right edge", () => {
    const placed = placePanel({ ...base, originX: 900 });
    expect(placed.side).toBe("right");
    expect(placed.left).toBe(900 - 30 - 320);
  });

  it("takes the side with more room when it fits on neither, and stays in the window", () => {
    const narrow = { ...base, viewportW: 420, originX: 300, width: 320 };
    const placed = placePanel(narrow);
    expect(placed.side).toBe("right");
    expect(inside(narrow)).toBe(true);
  });

  it("stays inside the window at all four edges and corners", () => {
    for (const originX of [0, 500, 1000]) {
      for (const originY of [0, 400, 800]) {
        expect(inside({ ...base, reserve: true, originX, originY })).toBe(true);
      }
    }
  });

  it("limits its height to the window in a short window", () => {
    expect(placePanel({ ...base, viewportH: 300 }).limit).toBe(300 - 2 * EDGE_PAD);
    expect(inside({ ...base, reserve: true, viewportH: 300, originY: 290 })).toBe(true);
  });

  it("holds the room it may grow to when it reserves, lifting a short panel near the bottom", () => {
    expect(placePanel({ ...base, reserve: true }).top).toBe(800 - 520 - EDGE_PAD);
    expect(placePanel(base).top).toBe(374);
  });

  it("keeps its own maximum in a tall window", () => {
    expect(placePanel(base).limit).toBe(520);
  });
});
