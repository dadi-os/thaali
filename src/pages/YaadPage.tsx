import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { createMemorySimulation, KIND_TOKEN, mergeGraph, type GraphData } from "../features/memory/graph";
import { MemoryGraph3D } from "../features/memory/MemoryGraph3D";
import { NodeSheet } from "../features/memory/NodeSheet";
import { isMeshOnline, yaad } from "../shared/api";
import { Pill } from "../shared/components/Button";
import { Card } from "../shared/components/Card";
import { syncForceSimulation } from "../shared/components/ForceGraph";
import { Icon } from "../shared/components/Icon";
import { StateView, StaleBanner } from "../shared/components/ModuleState";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useSize } from "../shared/hooks/useSize";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { NodeKind } from "../types/yaad";

/** The page is wider than this before the sheet sits beside the graph; narrower, it is a drawer over it. */
const DOCK_ABOVE = 900;

/** The kind chips after Everything, in the order the page draws them. */
const KINDS = Object.keys(KIND_TOKEN) as NodeKind[];
/** The name each kind's chip carries. */
const KIND_CHIP = { person: "People", place: "Places", memory: "Memories", plan: "Plans" } as const satisfies Record<NodeKind, string>;
/** The graph before Yaad has answered. */
const EMPTY: GraphData = { nodes: [], edges: [] };

/**
 * Yaad page: everything Yaad remembers as a live 3D graph under the kind chips, and the focused node's sheet docked beside it,
 * or a drawer over it when the page is narrow. The search box narrows the graph to the nodes matching it. `?focus=` names the
 * node to open on, `?kind=` the chip to start on, so the timeline's links and a link open the page on a node.
 */
export function YaadPage() {
  const { state: connection } = useConnection();
  const location = useLocation();
  const [params] = useSearchParams();
  const [page, { width }] = useSize<HTMLDivElement>();
  const [focusId, setFocusId] = useState<string | null>(params.get("focus"));
  const [kind, setKind] = useState<NodeKind | null>(KINDS.find((k) => k === params.get("kind")) ?? null);
  const [query, setQuery] = useState("");

  const graphQuery = useQuery({
    queryKey: ["yaad", "graph", location.key],
    queryFn: () => yaad.graph({}),
    enabled: isMeshOnline(connection),
  });
  const state = useModuleState(graphQuery, (data) => data.nodes.length === 0);
  const sim = useMemo(() => createMemorySimulation(), [location.key]);
  const graph = useMemo(() => {
    const data = graphQuery.data ? mergeGraph(EMPTY, graphQuery.data) : EMPTY;
    return syncForceSimulation(sim, data.nodes, data.edges);
  }, [sim, graphQuery.data]);

  const focused = focusId === null ? null : (graph.nodes.find((n) => n.id === focusId) ?? null);
  const docked = width > DOCK_ABOVE;

  const sheeted = focused !== null;
  useEffect(() => {
    if (!sheeted) {
      return undefined;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocusId(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sheeted]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle && kind === null) {
      return null;
    }
    return new Set(graph.nodes.filter((n) => (kind === null || n.kind === kind) && (!needle || n.title.toLowerCase().includes(needle))).map((n) => n.id));
  }, [graph.nodes, query, kind]);
  const counts = useMemo(() => {
    const byKind = new Map<NodeKind, number>();
    for (const n of graph.nodes) {
      byKind.set(n.kind, (byKind.get(n.kind) ?? 0) + 1);
    }
    return byKind;
  }, [graph.nodes]);
  const picked = matches?.size === 1 ? [...matches][0]! : (graph.nodes.find((n) => n.title.toLowerCase() === query.trim().toLowerCase())?.id ?? null);

  let content;
  if (state.kind === "loading") {
    content = (
      <Card style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="22" fill="none" stroke="#c9d4bf" strokeWidth="1.2" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#8fa382" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="22 116" style={{ transformOrigin: "32px 32px", animation: "ui-spin 2.4s linear infinite" }} />
          <circle cx="32" cy="32" r="5" fill="#8fa382" />
        </svg>
        <span className="ui-label">Loading memory</span>
      </Card>
    );
  } else if (state.kind === "offline") {
    content = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
      </Card>
    );
  } else if (state.kind === "module-offline") {
    content = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView
          kind="module-offline"
          title="Yaad isn’t answering"
          detail="Memory comes from Yaad. Your other modules still work."
          service={`${state.error.service}.dadi`}
          status={state.error.status}
          onRetry={() => void graphQuery.refetch()}
        />
      </Card>
    );
  } else if (state.kind === "error") {
    content = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="error" title="Yaad failed to answer" {...failureProps(state.error)} onRetry={() => void graphQuery.refetch()} />
      </Card>
    );
  } else if (state.kind === "empty") {
    content = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="empty" title="Nothing remembered yet" detail="Memory fills in as agents learn about your world." />
      </Card>
    );
  } else {
    content = (
      <Card style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <MemoryGraph3D sim={sim} graph={graph} focusId={focusId} matches={matches} onFocus={setFocusId} />
        </div>
      </Card>
    );
  }

  const ready = state.kind === "ready";
  const sheet = focused === null ? null : <NodeSheet node={focused} links={graph.links} onSelect={setFocusId} onClose={() => setFocusId(null)} />;
  return (
    <div ref={page} data-page="yaad" style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 16, padding: "18px 20px 20px", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 12, minHeight: 0 }}>
        <PageHeader
          title="Yaad"
          meta={ready ? `${graph.nodes.length} things remembered · ${graph.links.length} connections` : undefined}
          trailing={
            ready ? (
              <div style={{ width: 260 }}>
                <label className="search-field">
                  <Icon name="search" size={15} />
                  <input
                    type="search"
                    className="sfi"
                    placeholder="Search memory"
                    aria-label="Search memory"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setQuery("");
                      } else if (event.key === "Enter" && picked !== null) {
                        setFocusId(picked);
                      }
                    }}
                  />
                </label>
              </div>
            ) : undefined
          }
        />
        {ready && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Yaad reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={() => void graphQuery.refetch()} /> : null}
        {ready ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pill active={kind === null} count={graph.nodes.length} onClick={() => setKind(null)}>
              Everything
            </Pill>
            {KINDS.map((k) => (
              <Pill key={k} active={kind === k} count={counts.get(k) ?? 0} onClick={() => setKind(kind === k ? null : k)}>
                {KIND_CHIP[k]}
              </Pill>
            ))}
          </div>
        ) : null}
        {content}
      </div>
      {docked ? sheet : null}
      {docked || sheet === null ? null : (
        <>
          <div onClick={() => setFocusId(null)} style={{ position: "absolute", inset: 0, zIndex: 4 }} />
          <div style={{ position: "absolute", top: 18, right: 20, bottom: 20, display: "flex", zIndex: 5 }}>{sheet}</div>
        </>
      )}
    </div>
  );
}
