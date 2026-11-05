import { describe, expect, it } from "vitest";
import { railWidthFor } from "./ResizeHandle";

describe("rail width", () => {
  it("takes the default share of a window, up to 300 px", () => {
    expect(railWidthFor(1440, null)).toBe(300);
    expect(railWidthFor(960, null)).toBe(300);
  });

  it("keeps the chosen width between 260 and 560 px", () => {
    expect(railWidthFor(1920, 100)).toBe(260);
    expect(railWidthFor(1920, 900)).toBe(560);
    expect(railWidthFor(1920, 420)).toBe(420);
  });

  it("leaves the main area at least 640 px", () => {
    expect(railWidthFor(960, 560)).toBe(320);
    expect(railWidthFor(1000, 560)).toBe(360);
  });
});
