import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { hath, isMeshOnline } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { getRunning, subscribeRunning } from "../../contexts/running";
import type { AgentRecord } from "../../types/hath";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { AgentGraph2D } from "./AgentGraph2D";
import { isLive, laneState, type LaneState } from "./laneState";

/** More agents than this are drawn small and only their roots are named. */
const MANY_AGENTS = 40;

/** The graph's grey stand-in: two rings of dots round a middle one, in the shape the real graph has. */
function GhostGraph({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy);
  const stretch = Math.min(1.6, (width / height) * 0.9);
  const ring = (count: number, r: number, offset: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = offset + (i / count) * Math.PI * 2;
      return { x: cx + Math.cos(a) * r * stretch, y: cy + Math.sin(a) * r, a };
    });
  const inner = ring(9, radius * 0.42, -1.2);
  const outer = ring(22, radius * 0.82, -1.1);
  const pulse = (a: number) => `ui-pulse 1.6s ease-in-out ${(Math.abs(a * 0.3) % 1).toFixed(2)}s infinite`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="block" aria-hidden="true">
      {inner.map((p, i) => (
        <line key={`i${i}`} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="#e4ebdc" strokeWidth="1.5" />
      ))}
      {outer.map((p, i) => {
        const q = inner[Math.floor((i * inner.length) / outer.length)]!;
        return <line key={`o${i}`} x1={q.x.toFixed(1)} y1={q.y.toFixed(1)} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="#e4ebdc" strokeWidth="1" />;
      })}
      {outer.map((p, i) => (
        <circle key={`d${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="5" fill="#b9c9ab" opacity="0.7" style={{ animation: pulse(p.a) }} />
      ))}
      {inner.map((p, i) => (
        <circle key={`c${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="8" fill="#b9c9ab" opacity="0.9" style={{ animation: pulse(p.a) }} />
      ))}
      <circle cx={cx} cy={cy} r="13" fill="#b9c9ab" style={{ animation: "ui-pulse 1.6s ease-in-out infinite" }} />
    </svg>
  );
}

type BodyProps = {
  agents: AgentRecord[];
  stateOf: (agent: AgentRecord) => LaneState;
  geometry: TileGeometry;
  /** A node was clicked: take Ankur to that agent on the Hath page. */
  onPick: (agent: AgentRecord) => void;
};

/** The agent graph alone: live agents pulse in their state's colors and a click on a node opens it on the Hath page. */
function Body({ agents, stateOf, geometry, onPick }: BodyProps) {
  const many = agents.length > MANY_AGENTS;
  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <AgentGraph2D agents={agents} stateOf={stateOf} width={geometry.iw} height={Math.max(60, geometry.bh)} labels="live" nodeScale={many ? 0.7 : geometry.iw > 420 ? 1 : 0.85} onPick={onPick} />
    </div>
  );
}

/** Home's Hath tile: the agents as a graph, who is running, and how many agents there are; a node opens its agent on the Hath page. */
export function HathTile({ order }: { order: number }) {
  const navigate = useNavigate();
  const { state: connection } = useConnection();
  const query = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => (await hath.listAgents()).agents,
    enabled: isMeshOnline(connection),
    select: (agents) => agents.filter((agent) => agent.active),
  });
  const live = useSyncExternalStore(subscribeRunning, getRunning, getRunning);
  const state = useModuleState(query, (agents) => agents.length === 0);
  const stateOf = (agent: AgentRecord) => laneState(agent, live[agent.id]);
  const agents = state.kind === "ready" ? state.data : [];
  const working = agents.filter((agent) => isLive(stateOf(agent))).length;
  return (
    <Tile
      area="hath"
      title="Hath"
      to="/hath"
      order={order}
      summary={agents.length === 0 ? undefined : working > 0 ? `${working} working · ${agents.length} agents` : `${agents.length} agents`}
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Hath", request: "GET /agents", empty: ["No agents yet", "Agents appear here once Hath creates one."] }, () => void query.refetch())}
      skeleton={(g) => (
        <div className="relative min-h-0 min-w-0 flex-1">
          <GhostGraph width={g.iw} height={Math.max(60, g.bh)} />
        </div>
      )}
    >
      {(g) => <Body agents={agents} stateOf={stateOf} geometry={g} onPick={(agent) => navigate(`/hath?agent=${encodeURIComponent(agent.id)}`)} />}
    </Tile>
  );
}
