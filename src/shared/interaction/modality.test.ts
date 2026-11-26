// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { installInputModality } from "./modality";

let stop: () => void;
afterEach(() => stop());

describe("input modality", () => {
  it("is pointer after a press and keyboard after a navigation key, and ignores a lone modifier", () => {
    stop = installInputModality();
    const root = document.documentElement;
    expect(root.dataset.input).toBe("pointer");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(root.dataset.input).toBe("keyboard");
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(root.dataset.input).toBe("pointer");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
    expect(root.dataset.input).toBe("pointer");
  });

  it("leaves nothing on the root when stopped", () => {
    stop = installInputModality();
    stop();
    expect(document.documentElement.dataset.input).toBeUndefined();
    stop = () => undefined;
  });
});
