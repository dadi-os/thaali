import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";
import { useThemeTokens } from "../../shared/hooks/useThemeTokens";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import {
  ForceGraph,
  syncForceSimulation,
  type ForceGraphNodeLook,
} from "../../shared/components/ForceGraph";
import { GraphPlaceholder } from "../../shared/components/GraphPlaceholder";
import { GraphSpace } from "../../shared/components/GraphSpace";
import { Glider } from "../../shared/components/Glider";
import { SearchField } from "../../shared/components/SearchField";
import { getRunning, seedRunningFromAgents, subscribeRunning } from "../../store/running";
import {
  agentGraph,
  agentRadius,
  createAgentSimulation,
  isLiveVisual,
  visualState,
  type NodeVisual,
} from "./tree";

const THEME = ["--sage", "--sage-deep", "--ink-faint", "--bone"] as const;

/** Which agents the page brings forward: every one, the ones processing (process lane running), or the ones working (work lane running). */
type AgentShow = "all" | "processing" | "working";

const SHOW_OPTIONS: Array<{ value: AgentShow; label: string }> = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "working", label: "Working" },
];

/** Resolved theme colors the agent scene draws with. */
type AgentTheme = Record<(typeof THEME)[number], string>;

export type AgentGraph3DProps = {
  /** Changes on each arrival at the page; resets the simulation and open details. */
  entranceKey: string;
  /**
   * Page mode: orbit, click to focus and select, and a label on every live,
   * top-level or parent agent (a leaf sub-agent, usually a one-shot worker, is labelled when
   * hovered, focused or matched). Off for the home tile, which labels live agents only.
   */
  interactive: boolean;
  /** Agent to focus and select on each arrival at the page, e.g. one picked on the home tile. */
  focusOnEntry: string | null;
  /** Page mode: the agent a click focused, or null once the focus is cleared. The page docks that agent's sheet. */
  onSelect?: (agentId: string | null) => void;
  /** Home tile: an agent node was clicked. Clicks that miss every node fall through to the tile. */
  onPick?: (agentId: string) => void;
  /** Page header slot the search box renders into; null on the home tile. */
  toolbar: HTMLElement | null;
  /** Extra classes on the root element. */
  className?: string;
};

/** Resting surface for each agent lane. */
function agentLook(theme: AgentTheme, visual: NodeVisual): ForceGraphNodeLook {
  if (visual === "retired") {
    return { color: theme["--ink-faint"], opacity: 0.8, emissiveIntensity: 0, wireframe: true };
  }
  if (visual === "idle") {
    return { color: theme["--sage"], opacity: 1, emissiveIntensity: 0.1, wireframe: false };
  }
  if (visual === "work") {
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
 * Active agent forest as a live 3D force graph (inactive agents are left out, and a
 * sub-agent of an inactive parent becomes a root): top-level threads spread over an inner
 * shell, sub-agents settle on outer shells toward their parent, and a newly spawned
 * sub-agent grows out of its parent. Used full-page and as the home tile.
 */
export function AgentGraph3D({
  entranceKey,
  interactive,
  focusOnEntry,
  onSelect,
  onPick,
  toolbar,
  className,
}: AgentGraph3DProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const runningMap = useSyncExternalStore(subscribeRunning, getRunning, getRunning);
  const theme = useThemeTokens(THEME);

  const agentsQuery = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const { agents } = await hath.listAgents();
      seedRunningFromAgents(agents);
      return agents;
    },
    enabled: connected,
  });

  const agents = useMemo(() => agentsQuery.data?.filter((a) => a.active), [agentsQuery.data]);

  const sim = useMemo(() => createAgentSimulation(), [entranceKey]);

  const graph = useMemo(() => {
    const { nodes, edges } = agentGraph(agents ?? []);
    return syncForceSimulation(sim, nodes, edges);
  }, [sim, agents]);

  const pinnedLabels = useMemo(() => {
    const parents = new Set(graph.nodes.map((n) => n.parent_agent_id));
    return new Set(
      graph.nodes
        .filter(
          (n) =>
            isLiveVisual(visualState(n, runningMap[n.id])) ||
            (interactive && (n.depth === 0 || parents.has(n.id))),
        )
        .map((n) => n.id),
    );
  }, [graph.nodes, runningMap, interactive]);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<AgentShow>("all");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && show === "all") {
      return null;
    }
    const kept = (n: (typeof graph.nodes)[number]) =>
      show === "all" ||
      (show === "processing" && runningMap[n.id]?.process === true) ||
      (show === "working" && runningMap[n.id]?.work === true);
    return new Set(graph.nodes.filter((n) => kept(n) && (!q || n.name.toLowerCase().includes(q))).map((n) => n.id));
  }, [graph.nodes, query, show, runningMap]);
  const onlyMatch = matches?.size === 1 ? [...matches][0]! : null;

  const roots = useMemo(
    () => new Set(graph.nodes.filter((n) => n.depth === 0).map((n) => n.id)),
    [graph.nodes],
  );

  useEffect(() => {
    setFocusId(focusOnEntry);
    setQuery("");
    onSelect?.(focusOnEntry);
  }, [entranceKey, focusOnEntry]);

  const clearFocus = useCallback(() => {
    setFocusId(null);
    onSelect?.(null);
  }, [onSelect]);

  const focusAgent = (agentId: string) => {
    setFocusId(agentId);
    onSelect?.(agentId);
  };

  if (!connected && !agentsQuery.data) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder
          tone="offline"
          label="Hath is offline"
          detail={interactive ? "Connect to dadi to load agents" : undefined}
        />
      </div>
    );
  }

  if (agentsQuery.isError && !agentsQuery.data) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder tone="error" label="Could not load Hath" detail={agentsQuery.error.message} />
      </div>
    );
  }

  if (!agents) {
    return (
      <div className={`h-full ${className ?? ""}`}>
        <GraphPlaceholder
          tone="loading"
          label="Loading Hath"
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
          label="No active agents"
          detail={interactive ? "Agents appear here while they are active" : undefined}
        />
      </div>
    );
  }

  return (
    <div className={`relative h-full min-h-0 w-full ${className ?? ""}`}>
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
          hold={focusId !== null || matches !== null}
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
          onNodeClick={
            interactive ? (n) => focusAgent(n.id) : onPick ? (n) => onPick(n.id) : undefined
          }
        />
      </GraphSpace>

      {interactive && toolbar
        ? createPortal(
            <>
              <Glider options={SHOW_OPTIONS} value={show} onChange={setShow} label="Show agents" />
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
            />
            </>,
            toolbar,
          )
        : null}

    </div>
  );
}
