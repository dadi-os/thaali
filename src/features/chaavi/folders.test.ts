import { describe, expect, it } from "vitest";
import type { ChaaviFolder, ChaaviItem } from "../../types/chaavi";
import { buildFolderTree, isWithin, subtreeRenames } from "./folders";

const folders: ChaaviFolder[] = [
  { id: "a", name: "development" },
  { id: "b", name: "development/fliks-gg" },
  { id: "c", name: "google/work" },
];

const inFolder = (folderId: string | null) => ({ folderId }) as ChaaviItem;

describe("folder paths", () => {
  it("matches a path and its subfolders but not a name prefix", () => {
    expect(isWithin("development", "development")).toBe(true);
    expect(isWithin("development/fliks-gg", "development")).toBe(true);
    expect(isWithin("developmental", "development")).toBe(false);
  });

  it("builds a tree with a node for a parent that is not a folder, and rolls counts up", () => {
    const tree = buildFolderTree(folders, [inFolder("a"), inFolder("b"), inFolder("b"), inFolder("c"), inFolder(null)]);
    expect(tree.map((node) => [node.path, node.id, node.count])).toEqual([
      ["development", "a", 3],
      ["google", null, 1],
    ]);
    expect(tree[0]!.children.map((node) => [node.path, node.id, node.count])).toEqual([["development/fliks-gg", "b", 2]]);
  });

  it("renames a folder together with the folders under it", () => {
    expect(subtreeRenames(folders, "development", "dev")).toEqual([
      { id: "a", name: "dev" },
      { id: "b", name: "dev/fliks-gg" },
    ]);
    expect(subtreeRenames(folders, "google", "mail")).toEqual([{ id: "c", name: "mail/work" }]);
  });
});
