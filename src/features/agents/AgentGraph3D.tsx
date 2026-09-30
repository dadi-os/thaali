import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../shared/api";
import type { AgentRecord } from "../../shared/api/types";
import { useConnection } from "../../shared/hooks/useConnection";
import { useHoverDetails } from "../../shared/hooks/useHoverDetails";
import { useThemeTokens } from "../../shared/hooks/useThemeTokens";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { POLL_MS } from "../../shared/lib/ux/poll";
import {
  ForceGraph,
  syncForceSimulation,
  type ForceGraphNodeLook,
} from "../../shared/components/ForceGraph";
import { GraphPlaceholder } from "../../shared/components/GraphPlaceholder";
import { GraphSpace } from "../../shared/components/GraphSpace";
import { SearchField } from "../../shared/components/SearchField";
import { openAgent } from "../../store/chat";
import { getRunning, seedRunningFromAgents, subscribeRunning } from "../../store/running";
import { AgentPopover, agentActivityQuery, agentDetailQuery } from "./AgentPopover";
import { pickLiveBrowser, pickLiveTerminal } from "./sessions";
import {
  agentGraph,
  agentRadius,
  createAgentSimulation,
  isLiveVisual,
  visualState,
  type NodeVisual,
} from "./tree";

const THEME = ["--sage", "--sage-deep", "--ink-faint", "--bone"] as const;

/** Resolved theme colors the agent scene draws with. */
type AgentTheme = Record<(typeof THEME)[number], string>;

export type AgentGraph3DProps = {
  /** Changes on each arrival at the page; resets the simulation and open details. */
  entranceKey: string;
  /**
   * Page mode: orbit, hover details, click to focus and open chat, and a label on every
   * agent. Off for the home tile, which labels live agents only.
   */
  interactive: boolean;
  /** Agent to focus (and open in chat) on each arrival at the page, e.g. one picked on the home tile. */
  focusOnEntry: string | null;
  /** Home tile: an agent node was clicked. Clicks that miss every node fall through to the tile. */
  onPick?: (agentId: string) => void;
  /** Page header slot the search box renders into; null on the home tile. */
  toolbar: HTMLElement | null;
  /** Extra classes on the root element. */
  className?: string;
};

/** Resting surface for each agent lane. */
function agentLook(theme: AgentTheme, visual: NodeVisual): ForceGraphNodeLook {
  if (visual === "dormant") {
    return { color: theme["--ink-faint"], opacity: 0.8, emissiveIntensity: 0, wireframe: true };
  }
  if (visual === "idle") {
    return { color: theme["--sage"], opacity: 1, emissiveIntensity: 0.1, wireframe: false };
  }
  if (visual === "reasoning") {
    return { color: theme["--sage-deep"], opacity: 0.6, emissiveIntensity: 0.4, wireframe: false };
  }
  return { color: theme["--sage-deep"], opacity: 1, emissiveIntensity: 0.5, wireframe: false };
}

/** Breathing translucent shell around an agent that is mid-flight. */
function LiveHalo({ radius, color }: { radius: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    ref.current?.scale.setScalar(radius * 1.7 * (1 + Math.sin(clock.getElapsedTime() * 2.2) * 0.08));
  });
  return (
    <mesh ref={ref} scale={radius * 1.7}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
    </mesh>
  );
}

/**
 * Agent forest as a live 3D force graph: top-level threads spread over an inner
 * shell, sub-agents settle on outer shells toward their parent, and a newly spawned
 * sub-agent grows out of its parent. Used full-page and as the home tile.
 */
export function AgentGraph3D({
  entranceKey,
  interactive,
  focusOnEntry,
  onPick,
  toolbar,
  className,
}: AgentGraph3DProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const runningMap = useSyncExternalStore(subscribeRunning, getRunning, getRunning);
  const theme = useThemeTokens(THEME);
  const rootRef = useRef<HTMLDivElement>(null);

  const agentsQuery = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const { agents } = await hath.listAgents();
      seedRunningFromAgents(agents);
      return agents;
    },
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const browsersQuery = useQuery({
    queryKey: ["nas", "browsers"],
    queryFn: () => nas.listBrowsers(),
    enabled: connected && interactive,
    refetchInterval: POLL_MS,
  });

  const terminalsQuery = useQuery({
    queryKey: ["nas", "terminals"],
    queryFn: () => nas.listTerminals(),
    enabled: connected && interactive,
    refetchInterval: POLL_MS,
  });

  const agents = agentsQuery.data;
  const agentsById = useMemo(() => {
    const map = new Map<string, AgentRecord>();
    for (const a of agents ?? []) {
      map.set(a.id, a);
    }
    return map;
  }, [agents]);

  const sim = useMemo(() => createAgentSimulation(), [entranceKey]);

  const graph = useMemo(() => {
    const { nodes, edges } = agentGraph(agents ?? []);
    return syncForceSimulation(sim, nodes, edges);
  }, [sim, agents]);

  const pinnedLabels = useMemo(
    () =>
      new Set(
        graph.nodes
          .filter((n) => interactive || isLiveVisual(visualState(n, runningMap[n.id])))
          .map((n) => n.id),
      ),
    [graph.nodes, runningMap, interactive],
  );

  const details = useHoverDetails(entranceKey);
  const queryClient = useQueryClient();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? new Set(graph.nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id))
      : null;
  }, [graph.nodes, query]);
  const onlyMatch = matches?.size === 1 ? [...matches][0]! : null;

  const roots = useMemo(
    () => new Set(graph.nodes.filter((n) => n.depth === 0).map((n) => n.id)),
    [graph.nodes],
  );

  useEffect(() => {
    setFocusId(focusOnEntry);
    setQuery("");
    if (focusOnEntry !== null) {
      openAgent(focusOnEntry);
    }
  }, [entranceKey, focusOnEntry]);

  const clearFocus = useCallback(() => {
    details.close();
    setFocusId(null);
  }, [details.close]);

  const focusAgent = (agentId: string) => {
    details.close();
    setFocusId(agentId);
    openAgent(agentId);
  };

  if (!connected) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder
          tone="offline"
          label="Agents offline"
          detail={interactive ? "Connect to dadi to load agents" : undefined}
        />
      </div>
    );
  }

  if (agentsQuery.isError) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="error" label="Could not load agents" detail={agentsQuery.error.message} />
      </div>
    );
  }

  if (!agents) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder
          tone="loading"
          label="Loading agents"
          detail={interactive ? "Tracing threads and sub-agents" : undefined}
        />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder
          tone="empty"
          label="No agents yet"
          detail={interactive ? "Agents appear here as soon as Dadi starts one" : undefined}
        />
      </div>
    );
  }

  const detailAgent = details.id ? agentsById.get(details.id) : undefined;
  const detailBrowserId =
    detailAgent && browsersQuery.isSuccess
      ? pickLiveBrowser(detailAgent.sessions.browsers, browsersQuery.data)
      : null;
  const detailTerminal =
    detailAgent && terminalsQuery.isSuccess
      ? pickLiveTerminal(detailAgent.sessions.terminals, terminalsQuery.data)
      : null;

  return (
    <div ref={rootRef} className={`relative h-full min-h-0 w-full ${className ?? ""}`}>
      <GraphSpace
        key={entranceKey}
        interactive={interactive}
        pickable={onPick !== undefined}
        cameraPosition={[0, 60, 300]}
        onBackgroundClick={clearFocus}
      >
        <ForceGraph
          sim={sim}
          graph={graph}
          focusId={focusId ?? onlyMatch}
          focusScope="lineage"
          hold={details.open || focusId !== null || matches !== null}
          matches={matches}
          radius={(n) => agentRadius(n.depth, !n.active)}
          look={(n) => agentLook(theme, visualState(n, runningMap[n.id]))}
          edgeLabel={(link, id) =>
            link.target.id === id ? "parent" : link.source.id === id ? "sub-agent" : null
          }
          labelText={(n) => (n.name.length > 30 ? `${n.name.slice(0, 29)}…` : n.name)}
          pinnedLabels={pinnedLabels}
          revealSeeds={roots}
          decorate={(n, r) => {
            const visual = visualState(n, runningMap[n.id]);
            return (
              <>
                {isLiveVisual(visual) ? <LiveHalo radius={r} color={theme["--sage"]} /> : null}
                {visual === "both" ? (
                  <mesh scale={r * 0.42}>
                    <sphereGeometry args={[1, 16, 12]} />
                    <meshStandardMaterial color={theme["--bone"]} roughness={0.55} />
                  </mesh>
                ) : null}
              </>
            );
          }}
          onZoom={interactive ? clearFocus : undefined}
          onNodeHover={
            interactive
              ? (n, at) => {
                  details.hover(n.id, at);
                  void queryClient.prefetchQuery({ ...agentDetailQuery(n.id), staleTime: POLL_MS });
                  void queryClient.prefetchQuery({ ...agentActivityQuery(n.id), staleTime: POLL_MS });
                }
              : undefined
          }
          onNodeLeave={interactive ? details.leave : undefined}
          onNodeClick={
            interactive ? (n) => focusAgent(n.id) : onPick ? (n) => onPick(n.id) : undefined
          }
        />
      </GraphSpace>

      {interactive && toolbar
        ? createPortal(
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search agents"
              matches={matches === null ? null : matches.size}
              onPick={() => {
                if (onlyMatch) {
                  focusAgent(onlyMatch);
                }
              }}
            />,
            toolbar,
          )
        : null}

      {interactive ? (
        <AgentPopover
          open={details.open}
          agentId={details.id}
          agentsById={agentsById}
          runningMap={runningMap}
          anchor={details.anchor}
          containerRef={rootRef as RefObject<HTMLElement | null>}
          browserId={detailBrowserId}
          terminal={detailTerminal}
          hover={{ onInside: details.keep, onOutside: details.leave }}
          onClose={details.close}
          onSelectParent={focusAgent}
        />
      ) : null}
    </div>
  );
}
