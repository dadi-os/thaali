import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, yaad } from "../../shared/api";
import type { NodeKind } from "../../shared/api/types";
import { useConnection } from "../../shared/hooks/useConnection";
import { useHoverDetails } from "../../shared/hooks/useHoverDetails";
import { useThemeTokens } from "../../shared/hooks/useThemeTokens";
import { ForceGraph, syncForceSimulation } from "../../shared/components/ForceGraph";
import { GraphPlaceholder } from "../../shared/components/GraphPlaceholder";
import { GraphSpace } from "../../shared/components/GraphSpace";
import { SearchField } from "../../shared/components/SearchField";
import { POLL_MS } from "../../shared/lib/ux/poll";
import {
  KIND_TOKEN,
  createMemorySimulation,
  mergeGraph,
  nodeRadius,
  truncate,
  type GraphData,
} from "./graph";
import { MemoryPopover } from "./MemoryPopover";
const KIND_TOKENS = Object.values(KIND_TOKEN);
const EMPTY: GraphData = { nodes: [], edges: [] };

export type MemoryGraph3DProps = {
  /** Changes on each arrival at the page; resets the simulation, search, and selection. */
  entranceKey: string;
  /** Page header slot the search box renders into; no search while null. */
  toolbar: HTMLElement | null;
  /** Extra classes on the root element. */
  className?: string;
  /**
   * Node to focus on arrival (`/memory?focus=<id>`, e.g. from the timeline). Its
   * neighborhood is loaded even when it is not among the most-used nodes.
   */
  focusNodeId: string | null;
};

/**
 * Full-page Yaad knowledge network — a live 3D force-directed graph.
 * Polls `POST /graph`; new nodes sprout from the node they attach to and the
 * layout relaxes around them. Every non-memory node is labelled; the search box
 * narrows to matching titles and flies to a lone match.
 */
export function MemoryGraph3D({ entranceKey, toolbar, className, focusNodeId }: MemoryGraph3DProps) {
  const { state: connection } = useConnection();
  const theme = useThemeTokens(KIND_TOKENS);
  const connected = isMeshOnline(connection);
  const rootRef = useRef<HTMLDivElement>(null);

  const details = useHoverDetails(entranceKey);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const ambientQuery = useQuery({
    queryKey: ["yaad", "graph", entranceKey],
    queryFn: () => yaad.graph({}),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const seedQuery = useQuery({
    queryKey: ["yaad", "graph", "seed", focusNodeId],
    queryFn: () => yaad.graph({ seed_ids: [focusNodeId!] }),
    enabled: connected && focusNodeId !== null,
  });

  useEffect(() => {
    setFocusId(focusNodeId);
    setQuery("");
  }, [entranceKey]);

  const clearFocus = useCallback(() => {
    details.close();
    setFocusId(null);
  }, [details.close]);

  const sim = useMemo(() => createMemorySimulation(), [entranceKey]);

  const graph = useMemo(() => {
    const ambient = ambientQuery.data ? mergeGraph(EMPTY, ambientQuery.data) : EMPTY;
    const data = seedQuery.data ? mergeGraph(ambient, seedQuery.data) : ambient;
    return syncForceSimulation(sim, data.nodes, data.edges);
  }, [sim, ambientQuery.data, seedQuery.data]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? new Set(graph.nodes.filter((n) => n.title.toLowerCase().includes(q)).map((n) => n.id))
      : null;
  }, [graph.nodes, query]);
  const onlyMatch = matches?.size === 1 ? [...matches][0]! : null;

  const pinnedLabels = useMemo(
    () => new Set(graph.nodes.filter((n) => n.kind !== "memory").map((n) => n.id)),
    [graph.nodes],
  );

  const revealSeeds = useMemo(
    () =>
      new Set(
        graph.nodes.filter((n) => n.kind === "person" || n.kind === "place").map((n) => n.id),
      ),
    [graph.nodes],
  );

  const selected = graph.nodes.find((n) => n.id === details.id) ?? null;

  if (!connected) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="offline" label="Yaad is offline" detail="Connect to dadi to load memory" />
      </div>
    );
  }

  if (ambientQuery.isError) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="error" label="Could not load Yaad" detail={ambientQuery.error.message} />
      </div>
    );
  }

  if (seedQuery.isError) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="error" label="Could not load that node" detail={seedQuery.error.message} />
      </div>
    );
  }

  if (ambientQuery.isPending) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="loading" label="Loading Yaad" detail="Gathering people, places, and memories" />
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder
          tone="empty"
          label="Nothing remembered yet"
          detail="People, places, and memories appear here as Dadi learns them"
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative h-full min-h-0 w-full ${className ?? ""}`}>
      <GraphSpace
        key={entranceKey}
        interactive
        cameraPosition={[0, 60, 260]}
        onBackgroundClick={clearFocus}
      >
        <ForceGraph
          sim={sim}
          graph={graph}
          focusId={focusId ?? onlyMatch}
          focusScope="neighbors"
          hold={details.open || focusId !== null || matches !== null}
          matches={matches}
          radius={(n) => nodeRadius(n.kind, n.degree)}
          look={(n) => ({
            color: theme[KIND_TOKEN[n.kind]],
            opacity: 1,
            emissiveIntensity: 0.12,
            wireframe: false,
          })}
          labelText={(n) => truncate(n.title, 32)}
          pinnedLabels={pinnedLabels}
          revealSeeds={revealSeeds}
          edgeLabel={(link) => link.type.replace(/_/g, " ")}
          onZoom={clearFocus}
          onNodeHover={(node, at) => details.hover(node.id, at)}
          onNodeLeave={details.leave}
          onNodeClick={(node) => {
            details.close();
            setFocusId(node.id);
          }}
        />
      </GraphSpace>

      {toolbar
        ? createPortal(
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search Yaad"
              matches={matches === null ? null : matches.size}
              onPick={() => {
                if (onlyMatch) {
                  details.close();
                  setFocusId(onlyMatch);
                }
              }}
            />,
            toolbar,
          )
        : null}

      <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 text-[10px] font-medium tracking-[1.5px] uppercase text-ink-muted">
        {(Object.keys(KIND_TOKEN) as NodeKind[]).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: `var(${KIND_TOKEN[kind]})` }} />
            {kind}
          </span>
        ))}
        <span className="text-ink-ghost">
          {graph.nodes.length} nodes · {graph.links.length} links
        </span>
      </div>

      {selected && details.anchor ? (
        <MemoryPopover
          open={details.open}
          node={selected}
          links={graph.links}
          anchor={details.anchor}
          containerRef={rootRef as RefObject<HTMLElement | null>}
          hover={{ onInside: details.keep, onOutside: details.leave }}
          onClose={details.close}
          onSelect={(nodeId) => {
            details.close();
            setFocusId(nodeId);
          }}
        />
      ) : null}
    </div>
  );
}
