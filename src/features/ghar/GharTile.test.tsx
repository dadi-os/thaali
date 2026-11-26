// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devices } from "../../dev/fixtures/ghar";
import { installContextMenu, type ContextRequest } from "../../shared/interaction/contextMenu";
import type { Action } from "../../shared/interaction/actions";
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
  house.devicesQuery.data.devices = devices("normal");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function mount() {
  act(() => root.render(<MemoryRouter><GharTile order={0} /><Location /></MemoryRouter>));
}

describe("Home Ghar controls", () => {
  it("has no way to start a tag, and lists a tag's lights with its lights stacked under it", () => {
    mount();
    expect(host.querySelector("[aria-label='New tag']")).toBeNull();
    expect(host.querySelector("input")).toBeNull();
    expect(host.querySelectorAll("button[aria-pressed]").length).toBeGreaterThan(0);
  });

  it("shows a column per tag with how many of its lights are on", () => {
    mount();
    const cards = [...host.querySelectorAll("section[title^='Switch']")].map((card) => card.textContent);
    expect(cards.some((text) => text?.includes("all lights") && text.includes("3 of 5 on"))).toBe(true);
    expect(cards.some((text) => text?.startsWith("ankur's bed lights") && text.includes("0 of 1 on"))).toBe(true);
  });

  it("switches the whole tag from anywhere on its card without opening Ghar", () => {
    mount();
    const card = [...host.querySelectorAll<HTMLElement>("section[title^='Switch']")].find((candidate) => candidate.textContent?.startsWith("ankur's bed lights"))!;
    act(() => card.click());
    expect(house.run).toHaveBeenCalledWith([{ id: expect.any(String), command: { capability: "on_off", command: "on" } }]);
    expect(host.querySelector("output")!.textContent).toBe("/");
  });

  it("flips only that light when a light inside a card is tapped, not the whole group", () => {
    mount();
    const card = [...host.querySelectorAll<HTMLElement>("section[title^='Switch']")].find((candidate) => candidate.textContent?.includes("all lights"))!;
    const light = card.querySelector<HTMLButtonElement>("button[title^='Switch'][aria-pressed]:not([aria-label])")!;
    act(() => light.click());
    expect(house.run).toHaveBeenCalledOnce();
    expect(house.run.mock.calls[0]![0]).toHaveLength(1);
  });

  it("lists a light with no tag as a pill in the No tag strip, and a tap flips just that light", () => {
    const [first] = devices("normal");
    house.devicesQuery.data.devices = [...devices("normal"), { ...first!, id: "porch", name: "Porch Light", tags: [] }];
    mount();
    expect(host.textContent).toContain("No tag");
    const pill = [...host.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find((button) => button.textContent === "Porch Light")!;
    act(() => pill.click());
    expect(house.run).toHaveBeenCalledOnce();
    expect(house.run.mock.calls[0]![0]).toEqual([expect.objectContaining({ id: "porch" })]);
  });

  describe("right-click menus", () => {
    let stop: () => void;
    let opened: ContextRequest[];
    beforeEach(() => {
      opened = [];
      stop = installContextMenu((request) => opened.push(request));
    });
    afterEach(() => stop());

    const rowsOf = (request: ContextRequest) => request.actions.filter((row): row is Action => row !== "separator");
    const rightClick = (element: Element) => act(() => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })));

    it("offers a light's device actions, and choosing Turn on or off sends that light the command", () => {
      mount();
      const card = [...host.querySelectorAll<HTMLElement>("section[title^='Switch']")].find((candidate) => candidate.textContent?.includes("all lights"))!;
      rightClick(card.querySelector("button[title^='Switch'][aria-pressed]:not([aria-label])")!);
      expect(opened).toHaveLength(1);
      const rows = rowsOf(opened[0]!);
      expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(["inspect", "power", "identify"]));
      expect(rows.find((row) => row.id === "inspect")!.label).toBe("Open in Ghar");
      expect(rows.some((row) => row.id === "rename")).toBe(false);
      act(() => void rows.find((row) => row.id === "power")!.run());
      expect(house.run).toHaveBeenCalledWith([{ id: expect.any(String), command: expect.objectContaining({ capability: "on_off" }) }]);
    });

    it("offers a tag card Turn all on or off and Open tag, and the open row goes to the tag in Ghar", () => {
      mount();
      const card = [...host.querySelectorAll<HTMLElement>("section[title^='Switch']")].find((candidate) => candidate.textContent?.startsWith("ankur's bed lights"))!;
      rightClick(card.querySelector("button[aria-label^='Switch']")!);
      const rows = rowsOf(opened[0]!);
      expect(rows.map((row) => row.label)).toEqual(["Turn all on", "Open ankur's bed lights"]);
      act(() => void rows[0]!.run());
      expect(house.run).toHaveBeenCalledOnce();
      act(() => void rows[1]!.run());
      expect(host.querySelector("output")!.textContent).toBe("/ghar");
    });

    it("shows why an action cannot run while Ghar is unreachable", () => {
      house.connected = false;
      mount();
      rightClick(host.querySelector("button[aria-pressed]:not([aria-label])")!);
      expect(rowsOf(opened[0]!).find((row) => row.id === "identify")!.disabledReason).toBe("Ghar is unreachable");
      house.connected = true;
    });
  });
});
