// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb, collapseCrumbs } from "./Breadcrumb";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("collapseCrumbs", () => {
  it("keeps every step when they fit", () => {
    expect(collapseCrumbs(4, 4)).toEqual({ head: 4, tail: 0 });
    expect(collapseCrumbs(4, 9)).toEqual({ head: 4, tail: 0 });
  });

  it("keeps the first and the last steps and folds the middle", () => {
    expect(collapseCrumbs(7, 4)).toEqual({ head: 1, tail: 3 });
  });

  it("never drops below the first and the current step", () => {
    expect(collapseCrumbs(5, 0)).toEqual({ head: 1, tail: 1 });
  });
});

describe("Breadcrumb", () => {
  it("draws the last step as the current place, not a control, and earlier ones with onSelect as buttons", () => {
    const home = vi.fn();
    act(() =>
      root.render(
        <Breadcrumb
          items={[
            { label: "Home", onSelect: home },
            { label: "msu", onSelect: vi.fn() },
            { label: "semester-5", onSelect: vi.fn() },
          ]}
        />,
      ),
    );
    const nav = host.querySelector("nav")!;
    expect(nav.getAttribute("aria-label")).toBe("Breadcrumb");
    expect(nav.querySelectorAll("button")).toHaveLength(2);
    expect(nav.querySelector("[aria-current=page]")!.textContent).toBe("semester-5");
    act(() => nav.querySelector("button")!.click());
    expect(home).toHaveBeenCalledOnce();
  });

  it("puts a long label's whole text in its title", () => {
    act(() => root.render(<Breadcrumb items={[{ label: "a-very-long-folder-name", onSelect: vi.fn() }, { label: "here" }]} />));
    expect(host.querySelector("button")!.getAttribute("title")).toBe("a-very-long-folder-name");
  });

  it("moves focus between steps with the arrow keys", () => {
    act(() => root.render(<Breadcrumb items={[{ label: "a", onSelect: vi.fn() }, { label: "b", onSelect: vi.fn() }, { label: "c" }]} />));
    const [first, second] = [...host.querySelectorAll("button")];
    act(() => first!.focus());
    act(() => {
      first!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(second);
    act(() => {
      second!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(first);
  });

  it("shows every step, with no ellipsis, until the trail has a measured width", () => {
    const items = ["a", "b", "c", "d", "e"].map((label) => ({ label, onSelect: vi.fn() }));
    act(() => root.render(<Breadcrumb items={items} />));
    expect(host.querySelector("[aria-haspopup=menu]")).toBeNull();
    expect(host.querySelectorAll("button")).toHaveLength(4);
  });
});
