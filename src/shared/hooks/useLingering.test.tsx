// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLingering } from "./useLingering";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

/** Prints what the hook returns for `value`. */
function Probe({ value }: { value: string | null }) {
  return <span>{useLingering(value, 1000) ?? "none"}</span>;
}

describe("useLingering", () => {
  it("keeps the last value through a short blink off and drops it after the delay", () => {
    act(() => root.render(<Probe value="pin" />));
    act(() => root.render(<Probe value={null} />));
    expect(host.textContent).toBe("pin");
    act(() => vi.advanceTimersByTime(500));
    act(() => root.render(<Probe value="pin" />));
    act(() => vi.advanceTimersByTime(900));
    expect(host.textContent).toBe("pin");
    act(() => root.render(<Probe value={null} />));
    act(() => vi.advanceTimersByTime(1100));
    expect(host.textContent).toBe("none");
  });
});
