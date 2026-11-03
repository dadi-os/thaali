// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devices } from "../../dev/fixtures/ghar";
import { ghar } from "../../shared/api";
import type { TileProps } from "../home/Tile";
import { GharTile } from "./GharTile";

vi.mock("../../shared/api", () => ({ isMeshOnline: (state: string) => state === "connected", ghar: { createRoom: vi.fn(() => Promise.resolve({})) } }));
vi.mock("../../shared/hooks/useConnection", () => ({ useConnection: () => ({ state: "connected" }) }));
vi.mock("../../store/toasts", () => ({ pushToast: vi.fn() }));
vi.mock("./useHouse", () => ({ useHouse: () => house }));
vi.mock("../home/Tile", () => ({ Tile: ({ children }: TileProps) => <div>{children(geometry)}</div> }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let geometry = { iw: 700, bh: 300, tw: 734, th: 370 };
const house = {
  connected: true,
  devicesQuery: { data: { devices: devices("normal") } },
  failure: null,
  pending: new Set<string>(),
  run: vi.fn(),
  write: vi.fn(async (_label: string, action: () => Promise<unknown>) => { await action(); return true; }),
};
let root: Root;
let host: HTMLElement;

function Location() {
  return <output>{useLocation().pathname}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  geometry = { iw: 700, bh: 300, tw: 734, th: 370 };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function mount() {
  act(() => root.render(<MemoryRouter><GharTile order={0} /><Location /></MemoryRouter>));
}

describe("Home Ghar controls", () => {
  it("creates a named room on Enter and keeps the Home route", async () => {
    mount();
    act(() => (host.querySelector("[aria-label='New room']") as HTMLButtonElement).click());
    const input = host.querySelector<HTMLInputElement>("[aria-label='New room name']")!;
    input.value = "  Reading room  ";
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(ghar.createRoom).toHaveBeenCalledExactlyOnceWith("Reading room");
    expect(host.querySelector("output")!.textContent).toBe("/");
  });

  it("cancels room creation on Escape", () => {
    mount();
    act(() => (host.querySelector("[aria-label='New room']") as HTMLButtonElement).click());
    const input = host.querySelector<HTMLInputElement>("[aria-label='New room name']")!;
    input.value = "Cancel this";
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(ghar.createRoom).not.toHaveBeenCalled();
    expect(host.querySelector("input")).toBeNull();
  });

  it("opens Ghar for overflow rooms instead of starting a room creation", () => {
    geometry = { iw: 320, bh: 65, tw: 354, th: 135 };
    mount();
    act(() => (host.querySelector("[aria-label='Show all rooms']") as HTMLButtonElement).click());
    expect(host.querySelector("output")!.textContent).toBe("/ghar");
    expect(ghar.createRoom).not.toHaveBeenCalled();
  });
});
