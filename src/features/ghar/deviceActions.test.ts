import { describe, expect, it, vi } from "vitest";
import type { Action } from "../../shared/interaction/actions";
import { devices, rooms } from "../../dev/fixtures/ghar";
import { deviceActions, type DeviceActionDeps } from "./deviceActions";
import { roomActions } from "./roomActions";

const house = devices("normal");
const lamp = house.find((device) => device.name === "Desk Lamp")!;

/** The actions of `device` with every dependency a spy, by id. */
function actionsOf(device = lamp, overrides: Partial<DeviceActionDeps> = {}) {
  const deps: DeviceActionDeps = { rooms: rooms("normal"), disabled: false, onToggle: vi.fn(), onIdentify: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onInspect: vi.fn(), ...overrides };
  const rows = deviceActions(device, deps).filter((row): row is Action => row !== "separator");
  return { deps, rows, byId: (id: string) => rows.find((row) => row.id === id) };
}

describe("device actions", () => {
  it("switches a lamp to the opposite of its state", () => {
    const { byId, deps } = actionsOf();
    const power = byId("power")!;
    expect(power.label).toBe(lamp.state.on?.value === true ? "Turn off" : "Turn on");
    void power.run();
    expect(deps.onToggle).toHaveBeenCalledWith(lamp.state.on?.value !== true);
  });

  it("moves to every other room and never to its own", () => {
    const { rows, deps } = actionsOf();
    const moves = rows.filter((row) => row.id.startsWith("move:"));
    expect(moves.map((row) => row.id)).not.toContain(`move:${lamp.room.id}`);
    expect(moves).toHaveLength(rooms("normal").filter((room) => room.id !== lamp.room.id).length);
    void moves[0]!.run();
    expect(deps.onMove).toHaveBeenCalledOnce();
  });

  it("says why it cannot act while Ghar is unreachable, but still opens the inspector", () => {
    const { byId } = actionsOf(lamp, { disabled: true });
    expect(byId("power")!.disabledReason).toBeDefined();
    expect(byId("identify")!.disabledReason).toBeDefined();
    expect(byId("inspect")!.disabledReason).toBeUndefined();
  });
});

describe("room actions", () => {
  const deps = { disabled: false, hasLights: true, opened: false, onToggleOptions: vi.fn(), onRename: vi.fn(), onMoveHere: vi.fn(), onAddHere: vi.fn(), onDelete: vi.fn() };

  it("offers brightness only for a room with lights, and keeps delete last and destructive", () => {
    const withLights = roomActions(deps).filter((row): row is Action => row !== "separator");
    expect(withLights.map((row) => row.id)).toEqual(["brightness", "rename", "move-here", "add-here", "delete"]);
    expect(withLights[withLights.length - 1]!.destructive).toBe(true);
    const bare = roomActions({ ...deps, hasLights: false }).filter((row): row is Action => row !== "separator");
    expect(bare.map((row) => row.id)).not.toContain("brightness");
  });

  it("asks for the delete instead of performing it", () => {
    const list = roomActions(deps).filter((row): row is Action => row !== "separator");
    void list.find((row) => row.id === "delete")!.run();
    expect(deps.onDelete).toHaveBeenCalledOnce();
  });
});
