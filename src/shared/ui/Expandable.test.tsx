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

function Tree({ onSelect = vi.fn() }: { onSelect?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Expandable look="folder" title="Gym" trailing={2} open={open} onToggle={() => setOpen(!open)} onSelect={onSelect}>
      <span>Monday</span>
      <span>Tuesday</span>
    </Expandable>
  );
}

describe("Expandable folder look", () => {
  it("shows its title and count, opens its children under a connector with the chevron, and mounts them only while open", async () => {
    act(() => root.render(<Tree />));
    expect(host.textContent).toContain("Gym");
    expect(host.textContent).toContain("2");
    expect(host.textContent).not.toContain("Monday");
    const chevron = host.querySelector("button[aria-label='Expand Gym']") as HTMLButtonElement;
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
    act(() => chevron.click());
    expect(host.textContent).toContain("Monday");
    expect(host.textContent).toContain("Tuesday");
    expect(host.querySelector(".border-l")).not.toBeNull();
    expect((host.querySelector("button[aria-label='Collapse Gym']") as HTMLButtonElement).getAttribute("aria-expanded")).toBe("true");
    act(() => (host.querySelector("button[aria-label='Collapse Gym']") as HTMLButtonElement).click());
    await settle();
    expect(host.textContent).not.toContain("Monday");
  });

  it("chooses the folder from its title and leaves the chevron to toggling", () => {
    const onSelect = vi.fn();
    act(() => root.render(<Tree onSelect={onSelect} />));
    act(() => (host.querySelector("button[aria-current]") as HTMLButtonElement).click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("Monday");
  });

  it("toggles from the whole row when it has no select, and a leaf has no chevron", () => {
    function Plain() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Expandable look="folder" title="Group" open={open} onToggle={() => setOpen(!open)}>
            <span>inside</span>
          </Expandable>
          <Expandable look="folder" title="Leaf" open={false} onToggle={() => undefined} />
        </>
      );
    }
    act(() => root.render(<Plain />));
    const toggles = host.querySelectorAll("button[aria-expanded]");
    expect(toggles).toHaveLength(1);
    act(() => (toggles[0] as HTMLButtonElement).click());
    expect(host.textContent).toContain("inside");
  });

  it("swaps its folder glyph for the open one with the row", () => {
    act(() => root.render(<Tree />));
    const before = host.querySelector("svg path")!.getAttribute("d");
    act(() => (host.querySelector("button[aria-label='Expand Gym']") as HTMLButtonElement).click());
    const paths = [...host.querySelectorAll("svg path")].map((path) => path.getAttribute("d"));
    expect(paths.some((d) => d !== before && d?.includes("L5.4 11"))).toBe(true);
  });
});
