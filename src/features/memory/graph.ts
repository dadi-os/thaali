import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
} from "d3-force-3d";
import type { EdgeRecord, NodeKind, NodeRecord } from "../../types/yaad";
import type {
  ForceGraphSimulation,
  ForceLinkDatum,
  ForceLinkResolved,
  ForceNode,
} from "../../shared/components/ForceGraph";

/** Theme token that colors each node kind, in the scene, the legend, and the popover. */
export const KIND_TOKEN = {
  person: "--sage-deep",
  place: "--sage",
  memory: "--ink-faint",
  plan: "--clay",
} as const satisfies Record<NodeKind, string>;

/** Undirected-render edge between two Yaad node ids. */
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
};

/** Nodes + edges held by the memory network view. */
export type GraphData = {
  nodes: NodeRecord[];
  edges: GraphEdge[];
};

/** Yaad node living in the memory force simulation. */
export type MemoryNode = ForceNode<NodeRecord>;

/** The memory network's 3D force simulation. */
export type MemorySimulation = ForceGraphSimulation<NodeRecord, GraphEdge>;

/** Edge in the memory simulation, with both endpoints resolved to nodes. */
export type MemoryLink = ForceLinkResolved<NodeRecord, GraphEdge>;

/** A node's neighbor across one edge, as the popover lists it. */
export type Connection = {
  /** Edge id. */
  id: string;
  node: MemoryNode;
  /** Edge type, e.g. `knows` or `happened_at`. */
  type: string;
  /** The edge points from the node to this neighbor. */
  outgoing: boolean;
};

/** Order connections read in: people, then places, plans, and memories. */
export const KIND_ORDER: Record<NodeKind, number> = { person: 0, place: 1, plan: 2, memory: 3 };

/** Every neighbor of `nodeId` across `links`, people first, then by title. */
export function connectionsOf(nodeId: string, links: MemoryLink[]): Connection[] {
  return links
    .flatMap((l) =>
      l.source.id === nodeId
        ? [{ id: l.id, node: l.target, type: l.type, outgoing: true }]
        : l.target.id === nodeId
          ? [{ id: l.id, node: l.source, type: l.type, outgoing: false }]
          : [],
    )
    .sort(
      (a, b) =>
        KIND_ORDER[a.node.kind] - KIND_ORDER[b.node.kind] || a.node.title.localeCompare(b.node.title),
    );
}

/** Sphere radius by kind, grown by connectedness so hubs read at a glance. */
export function nodeRadius(kind: NodeKind, degree: number): number {
  const base = kind === "person" ? 3.4 : kind === "place" ? 3 : 2.4;
  return base + Math.min(Math.sqrt(degree) * 0.8, 4);
}

/**
 * Union `incoming` into `current` by id (incoming wins), then drop edges whose
 * endpoints are not both present.
 */
export function mergeGraph(
  current: GraphData,
  incoming: { nodes: NodeRecord[]; edges: EdgeRecord[] },
): GraphData {
  const byId = new Map(current.nodes.map((n) => [n.id, n]));
  for (const n of incoming.nodes) {
    byId.set(n.id, n);
  }
  const edgeById = new Map(current.edges.map((e) => [e.id, e]));
  for (const e of incoming.edges) {
    edgeById.set(e.id, {
      id: e.id,
      source: e.src_id,
      target: e.dst_id,
      type: e.type,
      confidence: e.confidence,
    });
  }
  const edges = [...edgeById.values()].filter(
    (e) => byId.has(e.source) && byId.has(e.target),
  );
  return { nodes: [...byId.values()], edges };
}

/**
 * Stopped 3D simulation: n-body repulsion, springs on edges, collision, and a weak
 * pull to the origin so disconnected islands stay in frame. Fed by
 * `syncForceSimulation` and ticked by `ForceGraph`.
 */
export function createMemorySimulation(): MemorySimulation {
  return forceSimulation<MemoryNode, ForceLinkDatum<NodeRecord, GraphEdge>>([], 3)
    .stop()
    .force("charge", forceManyBody<MemoryNode>().strength(-180).distanceMax(600))
    .force(
      "link",
      forceLink<MemoryNode, ForceLinkDatum<NodeRecord, GraphEdge>>([])
        .id((n) => n.id)
        .distance(48)
        .strength((l) => 0.25 + 0.5 * l.confidence),
    )
    .force("collide", forceCollide<MemoryNode>((n) => nodeRadius(n.kind, n.degree) + 4))
    .force("x", forceX<MemoryNode>(0).strength(0.02))
    .force("y", forceY<MemoryNode>(0).strength(0.02))
    .force("z", forceZ<MemoryNode>(0).strength(0.02));
}

/** Collapse whitespace and ellipsize for graph labels. */
export function truncate(text: string, max = 120): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) {
    return one;
  }
  return `${one.slice(0, max - 1)}…`;
}
