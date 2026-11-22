// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const copyText = vi.hoisted(() => vi.fn(async (_text: string) => undefined));
vi.mock("../../shared/desktop/clipboard", () => ({ copyText }));

import { WhereCopy } from "./WhereCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  copyText.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const tip = () => document.querySelector('[role="tooltip"]')?.textContent ?? "";

describe("WhereCopy", () => {
  it("shows the address on hover, copies it on click and says Copied for a moment", async () => {
    act(() => root.render(<WhereCopy label="Wells Hall · room 220" address="619 Red Cedar Rd, East Lansing" />));
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Copy address"]')!;
    act(() => {
      button.parentElement!.parentElement!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      button.parentElement!.parentElement!.dispatchEvent(new MouseEvent("mouseenter"));
    });
    expect(tip()).toContain("619 Red Cedar Rd");
    await act(async () => {
      button.click();
    });
    expect(copyText).toHaveBeenCalledWith("619 Red Cedar Rd, East Lansing");
    expect(tip()).toContain("Copied");
    await act(async () => {
      vi.advanceTimersByTime(1_600);
    });
    expect(tip()).toContain("619 Red Cedar Rd");
  });

  it("is plain text when the place has no address", () => {
    act(() => root.render(<WhereCopy label="Home" address={null} />));
    expect(host.querySelector("button")).toBeNull();
    expect(host.textContent).toBe("Home");
  });
});
