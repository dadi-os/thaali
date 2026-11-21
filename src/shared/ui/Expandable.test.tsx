// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Expandable } from "./Expandable";

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

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });

function Demo({ look = "card", onLink = vi.fn() }: { look?: "card" | "row"; onLink?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Expandable title={<button type="button" onClick={onLink}>career-manager</button>} secondary="4 min ago · ran 2m" trailing="Yielded" open={open} onToggle={() => setOpen(!open)} look={look}>
      <span>the inside</span>
    </Expandable>
  );
}

describe("Expandable", () => {
  it("shows its title, secondary line and trailing value shut, and mounts the content only while open", async () => {
    act(() => root.render(<Demo />));
    expect(host.textContent).toContain("career-manager");
    expect(host.textContent).toContain("4 min ago · ran 2m");
    expect(host.textContent).toContain("Yielded");
    expect(host.textContent).not.toContain("the inside");
    const toggle = host.querySelector("button[aria-expanded]") as HTMLButtonElement;
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(host.textContent).toContain("the inside");
    act(() => toggle.click());
    await settle();
    expect(host.textContent).not.toContain("the inside");
  });

  it("is a real button named by its title, so the keyboard and assistive technology reach it", () => {
    act(() => root.render(<Demo />));
    const toggle = host.querySelector("button[aria-expanded]") as HTMLButtonElement;
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("type")).toBe("button");
    const name = host.querySelector(`#${CSS.escape(toggle.getAttribute("aria-labelledby")!)}`)!;
    expect(name.textContent).toBe("career-manager");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps a link inside the title clickable without toggling", () => {
    const onLink = vi.fn();
    act(() => root.render(<Demo onLink={onLink} />));
    const link = [...host.querySelectorAll("button")].find((button) => button.textContent === "career-manager")!;
    act(() => link.click());
    expect(onLink).toHaveBeenCalledTimes(1);
    expect((host.querySelector("button[aria-expanded]") as HTMLButtonElement).getAttribute("aria-expanded")).toBe("false");
  });

  it("turns its chevron a quarter when open, in either look", () => {
    for (const look of ["card", "row"] as const) {
      act(() => root.render(<Demo key={look} look={look} />));
      expect(host.querySelector(".rotate-90")).toBeNull();
      act(() => (host.querySelector("button[aria-expanded]") as HTMLButtonElement).click());
      expect(host.querySelector(".rotate-90")).not.toBeNull();
    }
  });
});
