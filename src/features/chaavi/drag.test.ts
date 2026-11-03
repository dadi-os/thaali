import { describe, expect, it } from "vitest";
import type { ChaaviItem } from "../../types/chaavi";
import { dropChange, parseDrop } from "./drag";

const item = (folderId: string | null, favorite: boolean) => ({ folderId, favorite }) as ChaaviItem;

describe("drop targets", () => {
  it("reads a row's drop key", () => {
    expect(parseDrop("favorites")).toEqual({ kind: "favorites" });
    expect(parseDrop("none")).toEqual({ kind: "none" });
    expect(parseDrop("folder:abc")).toEqual({ kind: "folder", id: "abc" });
    expect(parseDrop("other")).toBeNull();
  });

  it("stars an item dropped on Favorites unless it is starred", () => {
    expect(dropChange(item(null, false), { kind: "favorites" })).toEqual({ favorite: true });
    expect(dropChange(item(null, true), { kind: "favorites" })).toBeNull();
  });

  it("moves an item to a folder or to no folder, and leaves one that is already there", () => {
    expect(dropChange(item(null, false), { kind: "folder", id: "a" })).toEqual({ folderId: "a" });
    expect(dropChange(item("a", false), { kind: "folder", id: "a" })).toBeNull();
    expect(dropChange(item("a", false), { kind: "none" })).toEqual({ folderId: null });
    expect(dropChange(item(null, false), { kind: "none" })).toBeNull();
  });
});
