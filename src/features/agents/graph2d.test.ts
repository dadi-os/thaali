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
    expect(view.shown.size).toBeGreaterThan(0);
    for (const node of view.shown) {
      expect(node.depth).toBe(1);
      expect(view.names.get(node)!.name).toBe(graphName(node.agent.name));
    }
  });

  it("keeps every position, the box and every name's place whichever agents are live", () => {
    const all = agents("many").filter((agent) => agent.active);
    const viewWith = (liveIds: string[]) =>
      viewForest(layoutForest(all, (agent) => laneState(agent, { work: liveIds.includes(agent.id), process: false })), { labels: "live", reserve: "all", width: 520, height: 260, nodeScale: 0.85 });
    const quiet = viewWith([]);
    const busy = viewWith([all[0]!.id, all[3]!.id, all[7]!.id]);
    expect(busy.viewBox).toEqual(quiet.viewBox);
    expect(busy.nodes.map((n) => [n.x, n.y])).toEqual(quiet.nodes.map((n) => [n.x, n.y]));
    expect([...busy.names.values()]).toEqual([...quiet.names.values()]);
    expect([...quiet.shown].every((n) => n.state === "waiting")).toBe(true);
    expect(busy.shown.size).toBeGreaterThan(quiet.shown.size);
    expect([...busy.shown].every((n) => n.state !== "idle")).toBe(true);
  });

  it("names every agent that is not idle, one waiting on a task included, and leaves idle ones unnamed", () => {
    const all = agents("many").filter((agent) => agent.active);
    const states = new Map(all.map((agent, index) => [agent.id, index === 0 ? "waiting" : index === 1 ? "working" : "idle"] as const));
    const view = viewForest(layoutForest(all, (agent) => states.get(agent.id) ?? "idle"), { labels: "live", reserve: "all", width: 520, height: 260, nodeScale: 0.85 });
    expect([...view.shown].map((n) => n.state).sort()).toEqual(["waiting", "working"]);
  });

  it("names two close non-idle agents without their names overlapping", () => {
    const family = [record("career-manager", null), record("a-specialist", "career-manager"), record("b-specialist", "career-manager"), record("c-specialist", "career-manager"), record("d-specialist", "career-manager")];
    const states = new Map<string, "waiting" | "working">([["b-specialist", "waiting"], ["c-specialist", "working"]]);
    const view = viewForest(layoutForest(family, (agent) => states.get(agent.id) ?? "idle", { r1: 40, step: 14 }), { labels: "live", reserve: "all", width: 400, height: 200, nodeScale: 0.85 });
    const shown = [...view.shown];
    expect(shown.map((n) => n.agent.id).sort()).toEqual(["b-specialist", "c-specialist"]);
    const box = (n: (typeof shown)[number]) => {
      const label = view.names.get(n)!;
      const wide = label.name.length * label.size * 0.6;
      const x0 = label.right ? n.x : n.x - wide;
      return { x0, x1: x0 + wide, y0: n.y + label.dy - label.size * 0.75, y1: n.y + label.dy + label.size * 0.45 };
    };
    const [one, two] = shown.map(box) as [ReturnType<typeof box>, ReturnType<typeof box>];
    expect(one.x0 < two.x1 && one.x1 > two.x0 && one.y0 < two.y1 && one.y1 > two.y0).toBe(false);
  });

  it("gives every node a place for its name so a hover can show it", () => {
    const all = agents("normal").filter((agent) => agent.active);
    const view = viewForest(layoutForest(all, stateOf), { labels: "live", width: 520, height: 260, nodeScale: 0.85 });
    expect(view.names.size).toBe(all.length);
  });

  it("writes a name whole, with its role suffix and uncut", () => {
    const long = "application-and-recruiting-coordination-specialist";
    expect(graphName(long)).toBe(long);
    expect(graphName("finance-specialist")).toBe("finance-specialist");
  });
});
