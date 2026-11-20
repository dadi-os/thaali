// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Disclosure } from "./Disclosure";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Demo({ divider = true }: { divider?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure title="Charter" summary="~2k tokens" open={open} onToggle={() => setOpen(!open)} divider={divider}>
      <span>the charter text</span>
    </Disclosure>
  );
}

describe("Disclosure", () => {
  it("shows its title and summary shut, mounts the content only while open, and turns its chevron", async () => {
    act(() => root.render(<Demo />));
    const button = host.querySelector("button")!;
    expect(button.textContent).toContain("Charter");
    expect(button.textContent).toContain("~2k tokens");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(host.textContent).not.toContain("the charter text");
    expect(button.querySelector(".rotate-90")).toBeNull();
    act(() => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(host.textContent).toContain("the charter text");
    expect(button.querySelector(".rotate-90")).not.toBeNull();
    act(() => button.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(host.textContent).not.toContain("the charter text");
  });

  it("draws a hairline above the row unless told not to", () => {
    act(() => root.render(<Demo />));
    expect(host.firstElementChild!.className).toContain("border-t");
    act(() => root.render(<Demo divider={false} />));
    expect(host.firstElementChild!.className).not.toContain("border-t");
  });
});
