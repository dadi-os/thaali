import { describe, expect, it, vi } from "vitest";
import type { Action } from "../../shared/interaction/actions";
import { devices } from "../../dev/fixtures/ghar";
import { deviceActions, type DeviceActionDeps } from "./deviceActions";
import { tagActions } from "./tagActions";

const house = devices("normal");
const lamp = house.find((device) => device.name === "Desk Lamp")!;

/** The actions of `device` with every dependency a spy, by id. */
function actionsOf(device = lamp, overrides: Partial<DeviceActionDeps> = {}) {
  const deps: DeviceActionDeps = { disabled: false, onToggle: vi.fn(), onIdentify: vi.fn(), onRename: vi.fn(), onRemoveFromTag: vi.fn(), onInspect: vi.fn(), ...overrides };
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

  it("offers to take a device out from under the tag being shown, and only then", () => {
    expect(actionsOf().byId("remove-tag")).toBeUndefined();
    const { byId, deps } = actionsOf(lamp, { inTag: "reading" });
    expect(byId("remove-tag")!.label).toBe("Remove from reading");
    void byId("remove-tag")!.run();
    expect(deps.onRemoveFromTag).toHaveBeenCalledOnce();
  });

  it("says why it cannot act while Ghar is unreachable, but still opens the inspector", () => {
    const { byId } = actionsOf(lamp, { disabled: true });
    expect(byId("power")!.disabledReason).toBeDefined();
    expect(byId("identify")!.disabledReason).toBeDefined();
    expect(byId("inspect")!.disabledReason).toBeUndefined();
  });
});

describe("tag actions", () => {
  const deps = { disabled: false, onRename: vi.fn(), onAddDevices: vi.fn(), onDelete: vi.fn() };

  it("renames, adds devices and deletes, with delete last and destructive", () => {
    const list = tagActions(deps).filter((row): row is Action => row !== "separator");
    expect(list.map((row) => row.id)).toEqual(["rename", "add-devices", "delete"]);
    expect(list[list.length - 1]!.destructive).toBe(true);
  });

  it("asks for the delete instead of performing it, and says why it cannot while Ghar is unreachable", () => {
    const list = tagActions(deps).filter((row): row is Action => row !== "separator");
    void list.find((row) => row.id === "delete")!.run();
    expect(deps.onDelete).toHaveBeenCalledOnce();
    const shut = tagActions({ ...deps, disabled: true }).filter((row): row is Action => row !== "separator");
    expect(shut.every((row) => row.disabledReason !== undefined)).toBe(true);
  });
});
