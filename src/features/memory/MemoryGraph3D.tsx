import { useMemo } from "react";
import { ForceGraph, type SyncedForceGraph } from "../../shared/components/ForceGraph";
import { GraphSpace } from "../../shared/components/GraphSpace";
import { useThemeTokens } from "../../shared/hooks/useThemeTokens";
import type { NodeRecord } from "../../types/yaad";
import { KIND_TOKEN, nodeRadius, truncate, type GraphEdge, type MemorySimulation } from "./graph";

const KIND_TOKENS = Object.values(KIND_TOKEN);

/**
 * How many of the best-connected people and places keep a label at rest; everything else is
 * labelled when hovered, focused or matched, so the graph reads as a quiet field until asked.
 */
const PINNED_HUBS = 12;

export type MemoryGraph3DProps = {
  /** The running simulation `graph` was synced to. */
  sim: MemorySimulation;
  /** Every node and link of the memory network. */
  graph: SyncedForceGraph<NodeRecord, GraphEdge>;
  /** The focused node, which comes forward with its connections; null shows everything. */
  focusId: string | null;
  /** The nodes the kind chips and the search leave lit, or null when neither narrows the graph. */
  matches: Set<string> | null;
  /** A node was clicked, or null when the click, a zoom or Esc left every node. */
  onFocus: (nodeId: string | null) => void;
};

/**
 * The memory network as a live 3D force graph: new nodes sprout from the node they attach to and the layout relaxes
 * around them, a clicked node brings its connections forward, and a search or a kind chip fades what it does not match
 * and flies to a lone match. The page around it owns the data and the focus.
 */
export function MemoryGraph3D({ sim, graph, focusId, matches, onFocus }: MemoryGraph3DProps) {
  const theme = useThemeTokens(KIND_TOKENS);

  const pinnedLabels = useMemo(() => {
    const degree = new Map<string, number>();
    for (const link of graph.links) {
      for (const end of [link.source, link.target]) {
        degree.set(end.id, (degree.get(end.id) ?? 0) + 1);
      }
    }
    return new Set(
      graph.nodes
        .filter((n) => n.kind === "person" || n.kind === "place")
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
        .slice(0, PINNED_HUBS)
        .map((n) => n.id),
    );
  }, [graph.nodes, graph.links]);

  const revealSeeds = useMemo(() => new Set(graph.nodes.filter((n) => n.kind === "person" || n.kind === "place").map((n) => n.id)), [graph.nodes]);
  const onlyMatch = matches?.size === 1 ? [...matches][0]! : null;

  return (
    <GraphSpace interactive cameraPosition={[0, 60, 260]} onBackgroundClick={() => onFocus(null)}>
      <ForceGraph
        sim={sim}
        graph={graph}
        focusId={focusId ?? onlyMatch}
        focusScope="neighbors"
        hold={focusId !== null || matches !== null}
        matches={matches}
        radius={(n) => nodeRadius(n.kind, n.degree)}
        look={(n) => ({ color: theme[KIND_TOKEN[n.kind]], opacity: 1, emissiveIntensity: 0.12, wireframe: false })}
        labelText={(n) => truncate(n.title, 32)}
        pinnedLabels={pinnedLabels}
        revealSeeds={revealSeeds}
        edgeLabel={(link) => link.type.replace(/_/g, " ")}
        onZoom={() => onFocus(null)}
        onNodeClick={(node) => onFocus(node.id)}
      />
    </GraphSpace>
  );
}
