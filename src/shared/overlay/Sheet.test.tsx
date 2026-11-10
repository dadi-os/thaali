// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Sheet", () => {
  it("never grows past the surface it floats in, so a short window scrolls its content instead of cutting it off", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <Sheet open onClose={vi.fn()} label="Needs a time">
          <div className="scroll min-h-0 flex-1">rows</div>
        </Sheet>,
      );
    });
    const panel = host.ownerDocument.querySelector<HTMLElement>("[role=dialog]")!;
    expect(panel.style.maxHeight).toBe("100%");
    expect(parseFloat(panel.style.minHeight)).toBe(0);
    expect(panel.style.overflow).toBe("hidden");
    expect(panel.querySelector(".scroll.min-h-0.flex-1")).not.toBeNull();
  });
});
