import type { AgentRecord } from "../../types/hath";
import type { LaneState } from "./laneState";

/** One agent placed on the forest: its ring depth, its position around the middle and the way it faces. */
export type ForestNode = { agent: AgentRecord; depth: number; x: number; y: number; ang: number; state: LaneState };

/** A line from an agent to the one it reports to. */
export type ForestLink = { from: ForestNode; to: ForestNode };

export type ForestOptions = {
  /** Radius of the first ring. */
  r1?: number;
  /** Distance between rings. */
  step?: number;
};

/**
 * The agents as a radial forest: one ring per depth, an angular span per root by its leaves, and no node in the
 * middle (Hath has no root). A parent that is not in the list makes its child a root.
 */
export function layoutForest(agents: AgentRecord[], stateOf: (agent: AgentRecord) => LaneState, { r1 = 120, step = 105 }: ForestOptions = {}): { nodes: ForestNode[]; links: ForestLink[] } {
  const ids = new Set(agents.map((a) => a.id));
  const kids = new Map<string | null, AgentRecord[]>();
  for (const agent of agents) {
    const parent = agent.parent_agent_id !== null && ids.has(agent.parent_agent_id) ? agent.parent_agent_id : null;
    kids.set(parent, [...(kids.get(parent) ?? []), agent]);
  }
  const leaves = (agent: AgentRecord): number => {
    const children = kids.get(agent.id) ?? [];
    return children.length > 0 ? children.reduce((sum, child) => sum + leaves(child), 0) : 1;
  };
  const roots = kids.get(null) ?? [];
  const total = roots.reduce((sum, root) => sum + leaves(root), 0) || 1;
  const nodes: ForestNode[] = [];
  const links: ForestLink[] = [];
  const place = (agent: AgentRecord, depth: number, from: number, to: number, parent: ForestNode | null) => {
    const ang = (from + to) / 2;
    const radius = r1 + (depth - 1) * step;
    const node: ForestNode = { agent, depth, x: Math.cos(ang) * radius, y: Math.sin(ang) * radius * 0.86, ang, state: stateOf(agent) };
    nodes.push(node);
    if (parent !== null) {
      links.push({ from: parent, to: node });
    }
    const children = kids.get(agent.id) ?? [];
    const childLeaves = children.reduce((sum, child) => sum + leaves(child), 0) || 1;
    let cursor = from;
    for (const child of children) {
      const width = (leaves(child) / childLeaves) * (to - from);
      place(child, depth + 1, cursor, cursor + width, node);
      cursor += width;
    }
  };
  let cursor = -Math.PI / 2 - 0.3;
  for (const root of roots) {
    const width = (leaves(root) / total) * Math.PI * 2;
    place(root, 1, cursor, cursor + width, null);
    cursor += width;
  }
  return { nodes, links };
}

/** Which names are written beside their nodes: `live` names every agent that is not idle, which includes one waiting on a task. */
export type GraphLabels = "all" | "live" | "roots";

/** One name beside its node: which side, how far above (negative) or below it sits, the text and its size in graph units. */
export type GraphLabel = { right: boolean; dy: number; name: string; size: number };

export type GraphView = {
  nodes: ForestNode[];
  links: ForestLink[];
  /** The viewBox: x, y, width and height, in graph units. */
  viewBox: [number, number, number, number];
  /** Graph units per pixel. */
  unit: (px: number) => number;
  /** Where every node's name goes, shown or not: it is what a hover reveals. */
  names: Map<ForestNode, GraphLabel>;
  /** The nodes whose name is written now: every one `labels` picks, since every node has a place. */
  shown: Set<ForestNode>;
};

export type ViewOptions = {
  /** Which names are written; it never changes where anything is. */
  labels: GraphLabels;
  /** Whose names the box and the placement make room for. The fit depends on this and not on `labels`; every name by default. */
  reserve?: Exclude<GraphLabels, "live">;
  /** The pixels the graph is drawn into. */
  width: number;
  height: number;
  /** Scales the nodes. */
  nodeScale?: number;
  fontScale?: number;
  pad?: number;
};

/** An agent's name as the graph writes it: whole, since the role suffix is part of who the agent is. */
export function graphName(name: string): string {
  return name;
}

/** The most room, as a fraction of the graph's width, the names beside it may take on each side. */
const MAX_LABEL_MARGIN = 0.3;

/** The radius of an agent's node in px, by its depth. */
export function nodeRadius(depth: number, scale: number): number {
  return (depth === 1 ? 8 : depth === 2 ? 6 : 4.5) * scale;
}

type Box = { x0: number; x1: number; y0: number; y1: number };

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * Fits a forest into `width` x `height` px: stretches a short forest to fill a tall container, widens the box for the
 * names that stick out (twice over, since the names change the scale that changes the names), then places each name
 * beside its node on the side it faces, the other side, then lifted or dropped by a line or two on either side, taking the
 * first spot that stays in the box and covers no node and no earlier name; when none is clear it takes the one that
 * collides least, so no name is ever dropped. The
 * positions, the box and every placement depend on the forest and `reserve` alone, never on which agents are live;
 * `labels` only picks which of the placed names are written.
 */
export function viewForest(forest: { nodes: ForestNode[]; links: ForestLink[] }, { labels, reserve = "all", width, height, nodeScale = 1, fontScale = 1, pad = 30 }: ViewOptions): GraphView {
  const { nodes, links } = forest;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  const tall = x1 - x0 + 2 * (pad + 90);
  const flat = y1 - y0 + 2 * pad;
  const want = (tall * height) / width;
  if (nodes.length > 1 && want > flat * 1.05) {
    const factor = Math.min(1.7, (want - 2 * pad) / Math.max(1, y1 - y0));
    for (const n of nodes) {
      n.y *= factor;
    }
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  if (nodes.length === 0) {
    minX = maxX = minY = maxY = 0;
  }
  const reserved = (n: ForestNode) => reserve === "all" || n.depth === 1;
  let ext = { l: 0, r: 0 };
  let viewBox: [number, number, number, number] = [0, 0, 0, 0];
  let unit = (px: number) => px;
  for (let pass = 0; pass < 3; pass++) {
    viewBox = [minX - pad - ext.l, minY - pad, maxX - minX + pad * 2 + ext.l + ext.r, maxY - minY + pad * 2];
    const scale = Math.min(width / viewBox[2], height / viewBox[3]);
    unit = (px) => px / scale;
    const letter = unit(12.5 * fontScale);
    const widest = (right: boolean) =>
      nodes
        .filter((n) => (Math.cos(n.ang) >= -0.05) === right && reserved(n))
        .reduce((most, n) => Math.max(most, n.x * (right ? 1 : -1) + unit(18) + graphName(n.agent.name).length * letter * 0.6), -Infinity);
    const room = (maxX - minX + pad * 2) * MAX_LABEL_MARGIN;
    ext = { l: Math.min(room, Math.max(0, widest(false) - -minX)), r: Math.min(room, Math.max(0, widest(true) - maxX)) };
  }
  const inside = (box: Box) => box.x0 >= viewBox[0] && box.x1 <= viewBox[0] + viewBox[2] && box.y0 >= viewBox[1] && box.y1 <= viewBox[1] + viewBox[3];
  const nodeBoxes = nodes.map((n) => {
    const r = unit(nodeRadius(n.depth, nodeScale)) + unit(2);
    return { node: n, box: { x0: n.x - r, x1: n.x + r, y0: n.y - r, y1: n.y + r } };
  });
  const measure = (n: ForestNode) => {
    const size = unit((n.depth === 1 ? 12.5 : 11.5) * fontScale);
    const name = graphName(n.agent.name);
    return { size, name, wide: name.length * size * 0.6, r: unit(nodeRadius(n.depth, nodeScale)) };
  };
  const boxOf = (n: ForestNode, right: boolean, dy: number): Box => {
    const { size, wide, r } = measure(n);
    const start = right ? n.x + r + unit(7) : n.x - r - unit(7) - wide;
    return { x0: start, x1: start + wide, y0: n.y + dy - size * 0.75, y1: n.y + dy + size * 0.45 };
  };
  const names = new Map<ForestNode, GraphLabel>();
  const taken: Box[] = [];
  const place = (n: ForestNode, solid: (other: ForestNode) => boolean) => {
    const { size, name } = measure(n);
    const facing = Math.cos(n.ang) >= -0.05;
    const lines = [0, -1.2, 1.2, -2.4, 2.4];
    const options = lines.flatMap((line) => [facing, !facing].map((right) => ({ right, dy: line * size })));
    const collisions = (box: Box) =>
      (inside(box) ? 0 : 100) + nodeBoxes.filter((other) => other.node !== n && solid(other.node) && overlaps(box, other.box)).length + taken.filter((other) => overlaps(box, other)).length;
    let best = options[0]!;
    let fewest = Infinity;
    for (const option of options) {
      const cost = collisions(boxOf(n, option.right, option.dy));
      if (cost < fewest) {
        best = option;
        fewest = cost;
      }
      if (cost === 0) {
        break;
      }
    }
    taken.push(boxOf(n, best.right, best.dy));
    names.set(n, { right: best.right, dy: best.dy, name, size });
  };
  const order = [...nodes].sort((a, b) => a.depth - b.depth);
  for (const n of order.filter(reserved)) {
    place(n, () => true);
  }
  for (const n of order.filter((candidate) => !reserved(candidate))) {
    place(n, (other) => other.depth === 1);
  }
  const wanted = (n: ForestNode) => labels === "all" || (labels === "live" && n.state !== "idle") || (labels === "roots" && n.depth === 1);
  return { nodes, links, viewBox, unit, names, shown: new Set(nodes.filter(wanted)) };
}
