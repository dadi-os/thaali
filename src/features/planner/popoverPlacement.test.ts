import { describe, expect, it } from "vitest";
import { placeAround } from "./popoverPlacement";

const view = { width: 1440, height: 900 };

describe("popover placement", () => {
  it("puts the panel to the right of a small block, with the gap between them", () => {
    const point = placeAround({ left: 100, top: 300, right: 300, bottom: 340 }, 420, 380, view)!;
    expect(point.x + 22).toBe(312);
    expect(point.y - 26).toBe(300);
  });

  it("takes the left when there is no room on the right", () => {
    const point = placeAround({ left: 900, top: 300, right: 1400, bottom: 340 }, 420, 380, view)!;
    expect(point.x + 22).toBe(900 - 12 - 420);
  });

  it("goes below a block that spans the window, and above when there is no room below", () => {
    const wide = { left: 50, top: 200, right: 1400, bottom: 240 };
    expect(placeAround(wide, 420, 380, view)!.y - 26).toBe(252);
    const low = { left: 50, top: 700, right: 1400, bottom: 740 };
    expect(placeAround(low, 420, 380, view)!.y - 26).toBe(700 - 12 - 380);
  });

  it("keeps the panel under the title bar and inside the window, and gives up when nothing fits", () => {
    expect(placeAround({ left: 100, top: 10, right: 300, bottom: 40 }, 420, 380, view)!.y - 26).toBe(64);
    expect(placeAround({ left: 0, top: 70, right: 1440, bottom: 880 }, 420, 380, view)).toBeNull();
  });
});
