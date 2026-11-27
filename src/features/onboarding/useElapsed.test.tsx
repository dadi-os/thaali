// @vitest-environment happy-dom
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORGET_AFTER_MS, useElapsed } from "./useElapsed";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

function Probe({ active }: { active: boolean }) {
  return <p>{String(useElapsed(active, FORGET_AFTER_MS))}</p>;
}

const show = (active: boolean) => act(() => root.render(<Probe active={active} />));
const text = () => host.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("useElapsed", () => {
  it("turns true only after the full delay of continuous waiting", () => {
    show(true);
    act(() => vi.advanceTimersByTime(FORGET_AFTER_MS - 1));
    expect(text()).toBe("false");
    act(() => vi.advanceTimersByTime(1));
    expect(text()).toBe("true");
  });

  it("never turns true while inactive", () => {
    show(false);
    act(() => vi.advanceTimersByTime(FORGET_AFTER_MS * 2));
    expect(text()).toBe("false");
  });

  it("starts over when the waiting breaks", () => {
    show(true);
    act(() => vi.advanceTimersByTime(FORGET_AFTER_MS - 1_000));
    show(false);
    show(true);
    act(() => vi.advanceTimersByTime(FORGET_AFTER_MS - 1_000));
    expect(text()).toBe("false");
    act(() => vi.advanceTimersByTime(1_000));
    expect(text()).toBe("true");
  });

  it("goes back to false once the wait ends", () => {
    show(true);
    act(() => vi.advanceTimersByTime(FORGET_AFTER_MS));
    show(false);
    expect(text()).toBe("false");
  });
});
