import { describe, expect, it } from "vitest";
import { fitToWidth } from "./ScaledFrame";

describe("fitToWidth", () => {
  const browser = { width: 960, height: 540 };

  it("scales uniformly to the container width and follows the aspect ratio", () => {
    expect(fitToWidth(480, browser)).toEqual({ scale: 0.5, height: 270 });
    expect(fitToWidth(1920, browser)).toEqual({ scale: 2, height: 1080 });
  });

  it("rounds the height to a device pixel", () => {
    expect(fitToWidth(301, browser, 2).height).toBe(169.5);
    expect(fitToWidth(301, browser, 1).height).toBe(169);
  });

  it("takes no space before the container is measured", () => {
    expect(fitToWidth(0, browser)).toEqual({ scale: 0, height: 0 });
  });
});
