import { describe, expect, it } from "vitest";
import type { NasFileEntry } from "../../../../types/nas";
import { arrange, nextSort } from "./listing";

function entry(name: string, kind: NasFileEntry["kind"], size: number, modified: string): NasFileEntry {
  return { name, path: `/var/home/dadi/${name}`, kind, size, modified, media_type: "" };
}

const ENTRIES = [
  entry("zeta.md", "file", 10, "2026-11-01T00:00:00Z"),
  entry("alpha", "folder", 0, "2026-11-05T00:00:00Z"),
  entry("beta.md", "file", 500, "2026-11-03T00:00:00Z"),
  entry("omega", "folder", 0, "2026-11-02T00:00:00Z"),
  entry("file10.md", "file", 5, "2026-11-04T00:00:00Z"),
  entry("file2.md", "file", 7, "2026-11-04T00:00:00Z"),
];

const names = (entries: NasFileEntry[]) => entries.map((e) => e.name);

describe("arranging a folder's rows", () => {
  it("lists folders first, then files by name, numbers read as numbers", () => {
    expect(names(arrange(ENTRIES, { key: "name", descending: false }, ""))).toEqual(["alpha", "omega", "beta.md", "file2.md", "file10.md", "zeta.md"]);
  });

  it("keeps folders first when the order flips or another column is chosen", () => {
    expect(names(arrange(ENTRIES, { key: "name", descending: true }, "")).slice(0, 2)).toEqual(["omega", "alpha"]);
    expect(names(arrange(ENTRIES, { key: "size", descending: true }, ""))).toEqual(["alpha", "omega", "beta.md", "zeta.md", "file2.md", "file10.md"]);
    expect(names(arrange(ENTRIES, { key: "modified", descending: true }, ""))).toEqual(["alpha", "omega", "file2.md", "file10.md", "beta.md", "zeta.md"]);
  });

  it("filters by name, ignoring case", () => {
    expect(names(arrange(ENTRIES, { key: "name", descending: false }, "  META "))).toEqual([]);
    expect(names(arrange(ENTRIES, { key: "name", descending: false }, "BET"))).toEqual(["beta.md"]);
  });

  it("starts a new column ascending and flips the same one", () => {
    expect(nextSort({ key: "name", descending: false }, "size")).toEqual({ key: "size", descending: false });
    expect(nextSort({ key: "size", descending: false }, "size")).toEqual({ key: "size", descending: true });
  });
});
