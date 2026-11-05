// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devices } from "../../dev/fixtures/ghar";
import type { TileProps } from "../home/Tile";
import { GharTile } from "./GharTile";

vi.mock("../../shared/api", () => ({ isMeshOnline: (state: string) => state === "connected" }));
vi.mock("../../shared/hooks/useConnection", () => ({ useConnection: () => ({ state: "connected" }) }));
vi.mock("../../contexts/toasts", () => ({ pushToast: vi.fn() }));
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
  it("has no way to start a room, and lists a room's lights when its card is tall enough", () => {
    mount();
    expect(host.querySelector("[aria-label='New room']")).toBeNull();
    expect(host.querySelector("input")).toBeNull();
    expect(host.querySelectorAll("button[aria-pressed]").length).toBeGreaterThan(0);
  });

  it("opens Ghar from the overflow card", () => {
    geometry = { iw: 320, bh: 65, tw: 354, th: 135 };
    mount();
    act(() => (host.querySelector("[aria-label='Show all rooms']") as HTMLButtonElement).click());
    expect(host.querySelector("output")!.textContent).toBe("/ghar");
  });
});
