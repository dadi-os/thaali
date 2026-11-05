import type { AgentRecord } from "../../types/hath";
import { isLive, type LaneState } from "./laneState";

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

/** Which names are written beside their nodes. */
export type GraphLabels = "all" | "live" | "roots";

export type GraphView = {
  nodes: ForestNode[];
  links: ForestLink[];
  /** The viewBox: x, y, width and height, in graph units. */
  viewBox: [number, number, number, number];
  /** Graph units per pixel. */
  unit: (px: number) => number;
  /** The nodes that have a label, with which side it is on. */
  labels: Map<ForestNode, { right: boolean; name: string; size: number }>;
};

export type ViewOptions = {
  labels: GraphLabels;
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

/**
 * Fits a forest into `width` x `height` px: stretches a short forest to fill a tall container, widens the box for the
 * labels that stick out (twice over, since the labels change the scale that changes the labels), then writes each
 * label that has room on the side its node faces, or the other, and none where it would cover another node or label.
 */
export function viewForest(forest: { nodes: ForestNode[]; links: ForestLink[] }, { labels, width, height, nodeScale = 1, fontScale = 1, pad = 30 }: ViewOptions): GraphView {
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
        .filter((n) => (Math.cos(n.ang) >= -0.05) === right && (labels === "all" || (labels === "live" ? isLive(n.state) : n.depth === 1)))
        .reduce((most, n) => Math.max(most, n.x * (right ? 1 : -1) + unit(18) + graphName(n.agent.name).length * letter * 0.6), -Infinity);
    const room = (maxX - minX + pad * 2) * MAX_LABEL_MARGIN;
    ext = { l: Math.min(room, Math.max(0, widest(false) - -minX)), r: Math.min(room, Math.max(0, widest(true) - maxX)) };
  }
  const priority = (n: ForestNode) => (isLive(n.state) ? 1 : n.state === "waiting" ? 2 : n.depth === 1 ? 3 : 4 + n.depth);
  const matters = (n: ForestNode) => n.depth === 1 || isLive(n.state) || n.state === "waiting";
  const boxes = nodes.map((n) => {
    const r = unit(nodeRadius(n.depth, nodeScale)) + unit(2);
    return { x0: n.x - r, x1: n.x + r, y0: n.y - r, y1: n.y + r, own: n as ForestNode | null, solid: matters(n) };
  });
  const covered = (box: { x0: number; x1: number; y0: number; y1: number }, self: ForestNode) =>
    boxes.some((other) => other.own !== self && (other.solid || !matters(self)) && box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0);
  const written = new Map<ForestNode, { right: boolean; name: string; size: number }>();
  for (const n of [...nodes].sort((a, b) => priority(a) - priority(b))) {
    const live = isLive(n.state);
    const wanted = labels === "all" || (labels === "live" && live) || (labels === "roots" && n.depth === 1);
    if (!wanted) {
      continue;
    }
    const r = unit(nodeRadius(n.depth, nodeScale));
    const size = unit((n.depth === 1 ? 12.5 : 11.5) * fontScale);
    const name = graphName(n.agent.name);
    const wide = name.length * size * 0.6;
    const facing = Math.cos(n.ang) >= -0.05;
    for (const right of [facing, !facing]) {
      const start = right ? n.x + r + unit(7) : n.x - r - unit(7) - wide;
      const box = { x0: start, x1: start + wide, y0: n.y - size * 0.75, y1: n.y + size * 0.45 };
      if (!covered(box, n)) {
        boxes.push({ ...box, own: null, solid: true });
        written.set(n, { right, name, size });
        break;
      }
    }
  }
  return { nodes, links, viewBox, unit, labels: written };
}
