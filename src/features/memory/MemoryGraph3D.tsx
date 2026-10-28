import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, yaad } from "../../shared/api";
import type { NodeKind } from "../../types/yaad";
import { useConnection } from "../../shared/hooks/useConnection";
import { useHoverDetails } from "../../shared/hooks/useHoverDetails";
import { useThemeTokens } from "../../shared/hooks/useThemeTokens";
import { ForceGraph, syncForceSimulation } from "../../shared/components/ForceGraph";
import { GraphPlaceholder } from "../../shared/components/GraphPlaceholder";
import { GraphSpace } from "../../shared/components/GraphSpace";
import { SearchField } from "../../shared/components/SearchField";
import {
  KIND_TOKEN,
  createMemorySimulation,
  mergeGraph,
  nodeRadius,
  truncate,
  type GraphData,
  type MemoryLink,
} from "./graph";
import { MemoryPopover } from "./MemoryPopover";
import { MemorySheet } from "./MemorySheet";
const KIND_TOKENS = Object.values(KIND_TOKEN);
const KINDS = Object.keys(KIND_TOKEN) as NodeKind[];

/** Each kind's chip label. */
const KIND_LABEL = { person: "People", place: "Places", memory: "Memories", plan: "Plans" } as const satisfies Record<NodeKind, string>;
const EMPTY: GraphData = { nodes: [], edges: [] };

/**
 * How many of the best-connected people and places keep a label at rest; everything else is
 * labelled when hovered, focused or matched, so the graph reads as a quiet field until asked.
 */
const PINNED_HUBS = 12;

export type MemoryGraph3DProps = {
  /** Changes on each arrival at the page; resets the simulation, search, and selection. */
  entranceKey: string;
  /** Page header slot the search box renders into; no search while null. */
  toolbar: HTMLElement | null;
  /** Slot under the header the kind chips render into. */
  filters: HTMLElement | null;
  /** Slot at the page's right edge the focused node's sheet docks into. */
  sheet: HTMLElement | null;
  /** Extra classes on the root element. */
  className?: string;
  /** Node to focus on arrival (`/yaad?focus=<id>`, e.g. from the timeline). */
  focusNodeId: string | null;
};

/**
 * Full-page Yaad knowledge network — a live 3D force-directed graph.
 * Polls `POST /graph` for every node and edge; new nodes sprout from the node they attach to and the
 * layout relaxes around them. The kind chips and the search box narrow to matching nodes and
 * fly to a lone match; a clicked node brings its connections forward and docks its sheet,
 * hovering one floats its details, and Esc goes back to everything.
 */
export function MemoryGraph3D({ entranceKey, toolbar, filters, sheet, className, focusNodeId }: MemoryGraph3DProps) {
  const { state: connection } = useConnection();
  const theme = useThemeTokens(KIND_TOKENS);
  const connected = isMeshOnline(connection);
  const rootRef = useRef<HTMLDivElement>(null);

  const details = useHoverDetails(entranceKey);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<NodeKind | null>(null);

  const graphQuery = useQuery({
    queryKey: ["yaad", "graph", entranceKey],
    queryFn: () => yaad.graph({}),
    enabled: connected,
  });

  useEffect(() => {
    setFocusId(focusNodeId);
    setQuery("");
    setKind(null);
  }, [entranceKey]);

  const clearFocus = useCallback(() => {
    details.close();
    setFocusId(null);
  }, [details.close]);

  const sim = useMemo(() => createMemorySimulation(), [entranceKey]);

  const graph = useMemo(() => {
    const data = graphQuery.data ? mergeGraph(EMPTY, graphQuery.data) : EMPTY;
    return syncForceSimulation(sim, data.nodes, data.edges);
  }, [sim, graphQuery.data]);

  useEffect(() => {
    if (focusId === null) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId, clearFocus]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && kind === null) {
      return null;
    }
    return new Set(
      graph.nodes.filter((n) => (kind === null || n.kind === kind) && (!q || n.title.toLowerCase().includes(q))).map((n) => n.id),
    );
  }, [graph.nodes, query, kind]);
  const counts = useMemo(() => {
    const byKind = new Map<NodeKind, number>();
    for (const n of graph.nodes) {
      byKind.set(n.kind, (byKind.get(n.kind) ?? 0) + 1);
    }
    return byKind;
  }, [graph.nodes]);
  const onlyMatch = matches?.size === 1 ? [...matches][0]! : null;
  /** What Enter in the search focuses: the lone match, else the node titled exactly as typed. */
  const picked = onlyMatch ?? graph.nodes.find((n) => n.title.toLowerCase() === query.trim().toLowerCase())?.id ?? null;

  const pinnedLabels = useMemo(() => {
    const degree = new Map<string, number>();
    for (const link of graph.links) {
      for (const end of [link.source, link.target]) {
        const id = typeof end === "string" ? end : end.id;
        degree.set(id, (degree.get(id) ?? 0) + 1);
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

  const revealSeeds = useMemo(
    () =>
      new Set(
        graph.nodes.filter((n) => n.kind === "person" || n.kind === "place").map((n) => n.id),
      ),
    [graph.nodes],
  );

  const focused = focusId === null ? null : (graph.nodes.find((n) => n.id === focusId) ?? null);
  const hovered = focusId === null ? (graph.nodes.find((n) => n.id === details.id) ?? null) : null;

  if (!connected && !graphQuery.data) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="offline" label="Yaad is offline" detail="Connect to dadi to load memory" />
      </div>
    );
  }

  if (graphQuery.isError && !graphQuery.data) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="error" label="Could not load Yaad" detail={graphQuery.error.message} />
      </div>
    );
  }

  if (graphQuery.isPending) {
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
              placeholder="Search people, places, memories"
              matches={matches === null ? null : matches.size}
              onPick={() => {
                if (picked) {
                  details.close();
                  setFocusId(picked);
                }
              }}
            />,
            toolbar,
          )
        : null}

      {filters
        ? createPortal(
            <div role="toolbar" aria-label="Kinds" className="flex flex-wrap gap-2">
              <KindChip selected={kind === null} label="Everything" count={graph.nodes.length} onClick={() => setKind(null)} />
              {KINDS.map((k) => (
                <KindChip
                  key={k}
                  selected={kind === k}
                  label={KIND_LABEL[k]}
                  count={counts.get(k) ?? 0}
                  token={KIND_TOKEN[k]}
                  onClick={() => setKind(kind === k ? null : k)}
                />
              ))}
            </div>,
            filters,
          )
        : null}

      {sheet
        ? createPortal(
            <AnimatePresence mode="popLayout">
              {focused ? (
                <MemorySheet
                  key="sheet"
                  node={focused}
                  links={graph.links}
                  onSelect={(nodeId) => {
                    details.close();
                    setFocusId(nodeId);
                  }}
                />
              ) : null}
            </AnimatePresence>,
            sheet,
          )
        : null}

      <div
        className={`pointer-events-none absolute bottom-4 left-4 flex items-center justify-between gap-4 ${focused ? "right-[380px]" : "right-4"}`}
      >
        <span className="truncate text-[12.5px] text-ink-ghost">
          {graph.nodes.length.toLocaleString()} things · {graph.links.length.toLocaleString()} links
          {focused ? ` · showing ${truncate(focused.title, 40)} and its ${connectionsCount(focused.id, graph.links)} connections` : ""}
        </span>
        <AnimatePresence>
          {focused ? (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={clearFocus}
              className="pointer-events-auto shrink-0 rounded-full border border-dashed border-sage-line bg-bone/80 px-3.5 py-1.5 text-[13px] font-semibold text-sage-deep hover:border-sage"
            >
              Esc · back to everything
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {hovered && details.anchor ? (
        <MemoryPopover
          open={details.open}
          node={hovered}
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

/** How many edges touch `nodeId`. */
function connectionsCount(nodeId: string, links: MemoryLink[]): number {
  return links.filter((link) => link.source.id === nodeId || link.target.id === nodeId).length;
}

type KindChipProps = {
  selected: boolean;
  label: string;
  count: number;
  /** The kind's color token; Everything has none. */
  token?: string;
  onClick: () => void;
};

/** A kind filter chip with its dot and count; the chosen one is filled sage. */
function KindChip({ selected, label, count, token, onClick }: KindChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors duration-slow ease-dadi ${
        selected ? "bg-sage-deep text-bone" : "bg-sage-fill text-ink hover:bg-sage-active"
      }`}
    >
      {token ? <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${token})` }} /> : null}
      {label}
      <span className={`text-[12.5px] font-medium tabular-nums ${selected ? "text-bone/75" : "text-ink-muted"}`}>{count.toLocaleString()}</span>
    </button>
  );
}
