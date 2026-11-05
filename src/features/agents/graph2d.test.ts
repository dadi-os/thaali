import { describe, expect, it } from "vitest";
import { agents } from "../../dev/fixtures/hath";
import type { AgentRecord } from "../../types/hath";
import { graphName, layoutForest, viewForest } from "./graph2d";
import { laneState } from "./laneState";

const record = (id: string, parent: string | null): AgentRecord => ({ ...agents("normal")[0]!, id, name: id, parent_agent_id: parent });
const stateOf = (agent: AgentRecord) => laneState(agent, undefined);

describe("layoutForest", () => {
  it("puts a root on the first ring, its child on the second, and links them", () => {
    const { nodes, links } = layoutForest([record("career-manager", null), record("resume-specialist", "career-manager")], stateOf);
    const [root, child] = nodes;
    expect(root!.depth).toBe(1);
    expect(child!.depth).toBe(2);
    expect(Math.hypot(root!.x, root!.y / 0.86)).toBeCloseTo(120);
    expect(Math.hypot(child!.x, child!.y / 0.86)).toBeCloseTo(225);
    expect(links).toHaveLength(1);
    expect(links[0]!.from).toBe(root);
  });

  it("makes an agent whose parent is not in the list a root", () => {
    const { nodes, links } = layoutForest([record("orphan-specialist", "retired-manager")], stateOf);
    expect(nodes[0]!.depth).toBe(1);
    expect(links).toHaveLength(0);
  });

  it("places every agent once", () => {
    const all = agents("many").filter((agent) => agent.active);
    const { nodes } = layoutForest(all, stateOf);
    expect(nodes).toHaveLength(all.length);
    expect(new Set(nodes.map((n) => n.agent.id)).size).toBe(all.length);
  });
});

describe("viewForest", () => {
  it("names only the roots of a large forest, once each, by their whole name", () => {
    const all = agents("many").filter((agent) => agent.active);
    const view = viewForest(layoutForest(all, stateOf), { labels: "roots", width: 600, height: 300, nodeScale: 0.7 });
    for (const [node, label] of view.labels) {
      expect(node.depth).toBe(1);
      expect(label.name).toBe(graphName(node.agent.name));
    }
  });

  it("writes a name whole, with its role suffix and uncut", () => {
    const long = "application-and-recruiting-coordination-specialist";
    expect(graphName(long)).toBe(long);
    expect(graphName("finance-specialist")).toBe("finance-specialist");
  });
});
