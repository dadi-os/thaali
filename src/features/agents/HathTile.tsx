import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline } from "../../shared/api";
import { NameTruncate } from "../../shared/components/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { Skeleton } from "../../shared/components/Skeleton";
import { getRunning, subscribeRunning } from "../../store/running";
import type { AgentRecord } from "../../types/hath";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { AgentGraph2D } from "./AgentGraph2D";
import { isLive, laneState, LANE_STATE_LABEL, type LaneState } from "./laneState";

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
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: "block" }} aria-hidden="true">
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
};

/** The agent graph over a row of chips, one per running agent as many as fit and a count of the rest. */
function Body({ agents, stateOf, geometry }: BodyProps) {
  const running = agents.map((agent) => ({ agent, state: stateOf(agent) })).filter((entry) => isLive(entry.state));
  const shown: typeof running = [];
  let used = 0;
  for (const entry of running) {
    const width = 14 + 7 + 8 + Math.min(200, `${entry.agent.name} · ${LANE_STATE_LABEL[entry.state]}`.length * 6.6) + 10;
    if (used + width > geometry.iw - 30 && shown.length > 0) {
      break;
    }
    shown.push(entry);
    used += width + 8;
  }
  const many = agents.length > MANY_AGENTS;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
        <AgentGraph2D agents={agents} stateOf={stateOf} width={geometry.iw} height={Math.max(60, geometry.bh - 42)} labels={many ? "roots" : "active"} nodeScale={many ? 0.7 : geometry.iw > 420 ? 1 : 0.85} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", height: 30, overflow: "hidden", flex: "none" }}>
        {shown.map(({ agent, state }) => (
          <span key={agent.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 12px", borderRadius: 999, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto", background: "var(--sage-fill)", color: "var(--sage-text)", border: "1px solid transparent" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sage)", flex: "none" }} />
            <NameTruncate name={agent.name} style={{ minWidth: 0 }} />
            <span style={{ flex: "none" }}>{`· ${LANE_STATE_LABEL[state]}`}</span>
          </span>
        ))}
        {running.length > shown.length ? <span style={{ fontSize: 13, color: "var(--ink-muted)", whiteSpace: "nowrap", flex: "none" }}>{`+${running.length - shown.length}`}</span> : null}
        {running.length === 0 ? <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Nothing running</span> : null}
      </div>
    </div>
  );
}

/** Home's Hath tile: the agents as a graph, who is running, and how many agents there are. */
export function HathTile({ order }: { order: number }) {
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
      summary={agents.length > 0 ? `${working} working · ${agents.length} agents` : undefined}
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Hath", request: "GET /agents", empty: ["No agents yet", "Agents appear here once Hath creates one."] }, () => void query.refetch())}
      skeleton={(g) => (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
            <GhostGraph width={g.iw} height={Math.max(60, g.bh - 42)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30 }}>
            <Skeleton width={150} height={28} radius={999} />
            <Skeleton width={120} height={28} radius={999} />
          </div>
        </div>
      )}
    >
      {(g) => <Body agents={agents} stateOf={stateOf} geometry={g} />}
    </Tile>
  );
}
