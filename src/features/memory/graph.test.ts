import { describe, expect, it } from "vitest";
import type { NodeKind, NodeRecord } from "../../types/yaad";
import { sectionsOf, type Connection, type MemoryNode } from "./graph";

const NOW = Date.parse("2026-10-28T14:42:00.000Z");

const connection = (id: string, kind: NodeKind, extra: Partial<NodeRecord> = {}): Connection => ({
  id,
  type: "ABOUT",
  outgoing: true,
  node: { id, kind, title: id, created_at: "2026-10-01T00:00:00.000Z", occurred_at: null, ...extra } as MemoryNode,
});

describe("sectionsOf", () => {
  it("lists plans that are still ahead soonest first, and leaves past plans among the others", () => {
    const sections = sectionsOf(
      [
        connection("later", "plan", { occurred_at: "2026-10-30T10:00:00.000Z" }),
        connection("soon", "plan", { occurred_at: "2026-10-28T15:00:00.000Z" }),
        connection("past", "plan", { occurred_at: "2026-10-20T10:00:00.000Z" }),
        connection("undated", "plan"),
      ],
      NOW,
    );
    expect(sections.comingUp.map((c) => c.id)).toEqual(["soon", "later"]);
    expect(sections.others.map((c) => c.id)).toEqual(["past", "undated"]);
  });

  it("lists memories newest first and keeps them out of the others", () => {
    const sections = sectionsOf(
      [
        connection("old", "memory", { created_at: "2026-09-01T00:00:00.000Z" }),
        connection("new", "memory", { created_at: "2026-10-27T00:00:00.000Z" }),
        connection("friend", "person"),
      ],
      NOW,
    );
    expect(sections.memories.map((c) => c.id)).toEqual(["new", "old"]);
    expect(sections.others.map((c) => c.id)).toEqual(["friend"]);
  });
});
