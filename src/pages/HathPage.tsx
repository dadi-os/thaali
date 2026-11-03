import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { AgentGraph2D } from "../features/agents/AgentGraph2D";
import { AgentList } from "../features/agents/AgentList";
import { isLive, keepsState, laneState, LANE_FILTERS, type LaneFilter } from "../features/agents/laneState";
import { AgentSheet } from "../features/agents/sheet";
import { hath, isMeshOnline } from "../shared/api";
import { Card } from "../shared/components/Card";
import { Icon } from "../shared/components/Icon";
import { StateView, StaleBanner } from "../shared/components/ModuleState";
import { Pill } from "../shared/components/Button";
import { Skeleton } from "../shared/components/Skeleton";
import { useConnection } from "../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../shared/hooks/useEvents";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useSize } from "../shared/hooks/useSize";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import { agentsMatching, pickedMatch } from "../features/agents/search";
import { getRunning, subscribeRunning } from "../store/running";
import type { AgentRecord } from "../types/hath";

/** More agents than this are drawn small, with only their roots named. */
const MANY_AGENTS = 40;
/** The sheet's width, and the gap between it and the graph. */
const SHEET_WIDTH = 400;
const SHEET_GAP = 16;
/** The page is this wide, or wider, before the sheet sits beside the graph; narrower, it is a drawer over it. */
const DOCK_ABOVE = 800;
/** The page's sides, and what the page keeps above and below the graph's drawing (the header, the chips, the legend, the paddings and the gaps), in px. */
const SIDES = 40;
const CHROME = 190;

/** The filter chips, in the order the page draws them. */
const FILTER_NAMES = Object.keys(LANE_FILTERS) as LaneFilter[];

/** How the page shows the agents: as the graph, or as a list. */
type View = "graph" | "list";

/** The mark of each state in the legend, by what the node looks like. */
const LEGEND = [
  ["working", { background: "var(--sage)", border: "none" }],
  ["processing", { background: "var(--tide)", border: "none" }],
  ["working + processing", { background: "var(--sage)", border: "2px solid var(--tide)" }],
  ["waiting on a task", { background: "var(--bone)", border: "2px solid var(--sage)" }],
  ["idle", { background: "#b6bdac", border: "none" }],
] as const;

/** The graph's grey stand-in while the agents load: two rings of dots round a middle one, in the shape the real graph has. */
function GhostGraph({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const ring = (count: number, radius: number, offset: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = offset + (i / count) * Math.PI * 2;
      return { x: cx + Math.cos(a) * radius * 1.5, y: cy + Math.sin(a) * radius, a };
    });
  const inner = ring(9, Math.min(150, cy * 0.55), -1.2);
  const outer = ring(22, Math.min(290, cy * 0.9), -1.1);
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
        <circle key={`d${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="6" fill="#b9c9ab" opacity="0.7" style={{ animation: pulse(p.a) }} />
      ))}
      {inner.map((p, i) => (
        <circle key={`c${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="10" fill="#b9c9ab" opacity="0.9" style={{ animation: pulse(p.a) }} />
      ))}
      <circle cx={cx} cy={cy} r="16" fill="#b9c9ab" style={{ animation: "ui-pulse 1.6s ease-in-out infinite" }} />
    </svg>
  );
}

/** The footer of the graph's card: what each look of node means. */
function Legend() {
  return (
    <div style={{ padding: "12px 18px 14px", borderTop: "1px solid var(--rule)", flex: "none", background: "rgba(250, 250, 247, 0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px 18px", flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-muted)" }}>
        {LEGEND.map(([name, mark]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", boxShadow: "none", flex: "none", ...mark }} />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hath page: the active agents as a graph (or a list) under filter chips by what they are doing, with the picked agent's sheet docked
 * beside them, or a drawer over them when the page is narrow. `?agent=` names the picked agent and `?view=list` the list, so the thread's
 * details button, and a link, open the page on an agent. Picking an agent shows its sheet and nothing more: the sheet's Open thread opens the chat.
 */
export function HathPage() {
  const { state: connection } = useConnection();
  const [params, setParams] = useSearchParams();
  const [page, { width, height }] = useSize<HTMLDivElement>();
  const live = useSyncExternalStore(subscribeRunning, getRunning, getRunning);

  const query = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => (await hath.listAgents()).agents,
    enabled: isMeshOnline(connection),
    select: (agents) => agents.filter((agent) => agent.active),
  });
  const state = useModuleState(query, (agents) => agents.length === 0);
  const agents = state.kind === "ready" ? state.data : [];
  const stateOf = (agent: AgentRecord) => laneState(agent, live[agent.id]);
  const states = agents.map(stateOf);
  const view: View = params.get("view") === "list" ? "list" : "graph";
  const selectedId = params.get("agent");
  const filter = FILTER_NAMES.find((name) => name === params.get("filter")) ?? "All";
  const sheeted = state.kind === "ready" && selectedId !== null && agents.some((agent) => agent.id === selectedId);
  const docked = width > DOCK_ABOVE;
  const search = params.get("q") ?? "";
  const found = agentsMatching(agents, search);
  const dimmed = filter === "All" && found === null ? null : new Set(agents.filter((agent, i) => !keepsState(filter, states[i]!) || (found !== null && !found.includes(agent))).map((agent) => agent.id));
  const many = agents.length > MANY_AGENTS;
  const room = { width: width - SIDES - (sheeted && docked ? SHEET_WIDTH + SHEET_GAP : 0), height: height - CHROME };

  const setParam = useCallback(
    (name: string, value: string | null) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === null) {
            next.delete(name);
          } else {
            next.set(name, value);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const pick = (agent: AgentRecord) => setParam("agent", agent.id);

  useEffect(() => {
    if (!sheeted || docked) {
      return undefined;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setParam("agent", null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sheeted, docked, setParam]);

  let content;
  if (state.kind === "loading") {
    content = (
      <Card style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <GhostGraph width={room.width} height={room.height} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 18px 14px", borderTop: "1px solid var(--rule)", flex: "none", background: "rgba(250, 250, 247, 0.5)" }}>
          <Skeleton width={70} height={12} />
          <Skeleton width={86} height={12} />
          <Skeleton width={110} height={12} />
          <Skeleton width={76} height={12} />
        </div>
      </Card>
    );
  } else if (state.kind === "offline") {
    content = (
      <Card style={{ flex: 1, minHeight: 0 }}>
        <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
      </Card>
    );
  } else if (state.kind === "error" || state.kind === "module-offline") {
    content = (
      <Card style={{ flex: 1, minHeight: 0 }}>
        <StateView kind="error" title="Hath failed to answer" {...failureProps(state.error)} onRetry={() => void query.refetch()} />
      </Card>
    );
  } else if (state.kind === "empty") {
    content = (
      <Card style={{ flex: 1, minHeight: 0 }}>
        <StateView kind="empty" title="No agents yet" detail="Agents appear here once Hath creates one." />
      </Card>
    );
  } else if (view === "list") {
    content = <AgentList agents={agents} stateOf={stateOf} selectedId={selectedId} dimmed={dimmed} onPick={pick} />;
  } else {
    content = (
      <Card style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <AgentGraph2D
            agents={agents}
            stateOf={stateOf}
            width={room.width}
            height={room.height}
            labels={many ? "roots" : "all"}
            nodeScale={many ? 0.75 : 1.1}
            fontScale={1.05}
            layout={{ r1: many ? 120 : 130, step: many ? 70 : 115 }}
            selectedId={selectedId}
            dimmed={dimmed}
            onPick={pick}
          />
        </div>
        <Legend />
      </Card>
    );
  }

  const working = states.filter(isLive).length;
  const sheet = sheeted ? <AgentSheet agentId={selectedId} onSelect={(id) => setParam("agent", id)} /> : null;
  return (
    <div ref={page} data-page="hath" style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 16, padding: "18px 20px 20px", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 12, minHeight: 0 }}>
        <PageHeader
          title="Hath"
          meta={state.kind === "ready" ? `${working} working · ${agents.length} agents` : undefined}
          trailing={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {state.kind === "ready" ? (
                <div style={{ width: 260 }}>
                  <label className="search-field">
                    <Icon name="search" size={15} />
                    <input
                      type="search"
                      className="sfi"
                      placeholder="Search agents"
                      aria-label="Search agents"
                      value={search}
                      onChange={(event) => setParam("q", event.target.value === "" ? null : event.target.value)}
                      onKeyDown={(event) => {
                        const picked = pickedMatch(found, search);
                        if (event.key === "Escape") {
                          setParam("q", null);
                        } else if (event.key === "Enter" && picked !== null) {
                          pick(picked);
                        }
                      }}
                    />
                  </label>
                </div>
              ) : null}
              <div style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 999, background: "var(--sage-fill)", border: "1px solid var(--glass-border)" }}>
              {(
                [
                  ["graph", "Graph"],
                  ["list", "List"],
                ] as const
              ).map(([name, title]) => (
                <button
                  key={name}
                  type="button"
                  className="ui-trans"
                  aria-label={`${title} view`}
                  aria-pressed={name === view}
                  title={`${title} view`}
                  onClick={() => setParam("view", name === "list" ? "list" : null)}
                  style={{ width: 44, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: name === view ? "var(--bone)" : "transparent", color: name === view ? "var(--ink)" : "var(--ink-muted)", boxShadow: name === view ? "0 1px 2px rgba(92, 107, 82, 0.15)" : "none" }}
                >
                  <Icon name={name} size={16} />
                </button>
              ))}
              </div>
            </div>
          }
        />
        {state.kind === "ready" && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Hath reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={() => void query.refetch()} /> : null}
        {state.kind === "ready" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {FILTER_NAMES.map((name) => (
              <Pill key={name} active={name === filter} count={states.filter((state) => keepsState(name, state)).length} onClick={() => setParam("filter", name === "All" ? null : name)}>
                {name}
              </Pill>
            ))}
          </div>
        ) : null}
        {width === 0 ? null : content}
      </div>
      {docked ? sheet : null}
      {docked || sheet === null ? null : (
        <>
          <div onClick={() => setParam("agent", null)} style={{ position: "absolute", inset: 0, zIndex: 4 }} />
          <div style={{ position: "absolute", top: 18, right: 20, bottom: 20, display: "flex", zIndex: 5 }}>{sheet}</div>
        </>
      )}
    </div>
  );
}
