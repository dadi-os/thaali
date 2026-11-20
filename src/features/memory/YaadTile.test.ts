import { describe, expect, it, vi } from "vitest";
import type { NodeRecord } from "../../types/yaad";

const graph = vi.hoisted(() => vi.fn());
const counts = vi.hoisted(() => vi.fn());
vi.mock("../../shared/api", () => ({ yaad: { graph, counts }, isMeshOnline: () => true }));

import { readHome } from "./YaadTile";

describe("readHome", () => {
  it("reads the graph for the most-used list and the counts for the cards and the total", async () => {
    const nodes = [{ id: "a" }] as NodeRecord[];
    const tally = { total: 1201, kinds: { person: 101, memory: 707, place: 129, plan: 212, task: 52 } };
    graph.mockResolvedValue({ nodes, edges: [] });
    counts.mockResolvedValue(tally);
    expect(await readHome()).toEqual({ nodes, counts: tally });
    expect(graph).toHaveBeenCalledWith({});
  });
});
