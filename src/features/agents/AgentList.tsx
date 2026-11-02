import { useEffect, useState, type CSSProperties } from "react";
import type { AgentRecord } from "../../types/hath";
import { Card } from "../../shared/components/Card";
import { NameTruncate, Truncate } from "../../shared/components/Truncate";
import { useSize } from "../../shared/hooks/useSize";
import { formatAge } from "../../shared/lib/ux/time";
import { isLive, LANE_STATE_LABEL, type LaneState } from "./laneState";

/** How often the ages in the list are read again. */
const TICK_MS = 30_000;
/** The card is this wide before the column that says what each agent is doing on its own has room. */
const NOW_COLUMN_FROM = 760;
/** What each indent step moves a child under its parent. */
const INDENT = 16;

/** One row of the list: an agent and how many parents it sits under. */
export type AgentRow = { agent: AgentRecord; depth: number };

/**
 * The agents in tree order, each under its parent and in the order the list gave them. An agent whose parent is not in the list is a root,
 * as in the graph.
 */
export function agentRows(agents: AgentRecord[]): AgentRow[] {
  const ids = new Set(agents.map((agent) => agent.id));
  const children = new Map<string | null, AgentRecord[]>();
  for (const agent of agents) {
    const parent = agent.parent_agent_id !== null && ids.has(agent.parent_agent_id) ? agent.parent_agent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), agent]);
  }
  const rows: AgentRow[] = [];
  const walk = (agent: AgentRecord, depth: number) => {
    rows.push({ agent, depth });
    for (const child of children.get(agent.id) ?? []) {
      walk(child, depth + 1);
    }
  };
  for (const root of children.get(null) ?? []) {
    walk(root, 0);
  }
  return rows;
}

/** What an agent says it is doing: its current step, or what it waits on. */
function nowOf(agent: AgentRecord): string {
  if (agent.running.status?.step) {
    return agent.running.status.step;
  }
  return agent.running.waiting_on === null ? "" : `Waiting on ${agent.running.waiting_on.targets.join(", ")}`;
}

const HEAD: CSSProperties = { minWidth: 0, fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: "var(--ink-muted)" };

export type AgentListProps = {
  agents: AgentRecord[];
  /** What each agent is doing. */
  stateOf: (agent: AgentRecord) => LaneState;
  /** The agent whose row is marked. */
  selectedId: string | null;
  /** The agents a filter leaves out, drawn faint. */
  dimmed: ReadonlySet<string> | null;
  onPick: (agent: AgentRecord) => void;
};

/** Every agent as a row in tree order: its state, what it is doing now when the card is wide enough, how many helper tasks it has and when it was last active. */
export function AgentList({ agents, stateOf, selectedId, dimmed, onPick }: AgentListProps) {
  const [card, { width }] = useSize<HTMLDivElement>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  const showNow = width > NOW_COLUMN_FROM;
  return (
    <Card ref={card} style={{ flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, height: 40, padding: "0 18px", borderBottom: "1px solid var(--rule)", flex: "none" }}>
        <span style={{ ...HEAD, width: 0, flex: 1 }}>Agent</span>
        <span style={{ ...HEAD, width: 124, flex: "none" }}>State</span>
        {showNow ? <span style={{ ...HEAD, width: 0, flex: 1 }}>Now</span> : null}
        <span style={{ ...HEAD, width: 52, flex: "none", textAlign: "right" }}>Tasks</span>
        <span style={{ ...HEAD, width: 64, flex: "none", textAlign: "right" }}>Active</span>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {agentRows(agents).map(({ agent, depth }) => {
          const state = stateOf(agent);
          const tasks = agent.sessions.tasks.length;
          return (
            <button
              key={agent.id}
              type="button"
              className="agent-row ui-trans"
              aria-current={agent.id === selectedId}
              onClick={() => onPick(agent)}
              style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", height: 46, padding: "0 18px", opacity: dimmed?.has(agent.id) ? 0.4 : 1, borderBottom: "1px solid var(--rule)" }}
            >
              <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: 8, paddingLeft: depth * INDENT }}>
                {depth > 0 ? <span style={{ width: 10, height: 10, borderLeft: "1px solid var(--sage-line)", borderBottom: "1px solid var(--sage-line)", borderBottomLeftRadius: 4, marginTop: -4, flex: "none" }} /> : null}
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: isLive(state) ? "var(--sage)" : "var(--ink-ghost)", flex: "none" }} />
                <NameTruncate name={agent.name} style={{ fontSize: 14, fontWeight: depth > 0 ? 500 : 600 }} />
              </div>
              <span style={{ width: 124, flex: "none" }}>
                {state === "idle" ? <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>idle</span> : <span style={{ fontSize: 13, fontWeight: 500, color: "var(--sage-text)" }}>{LANE_STATE_LABEL[state]}</span>}
              </span>
              {showNow ? <Truncate text={nowOf(agent)} className="ui-mono" style={{ flex: 1, minWidth: 0, color: "var(--ink-muted)" }} /> : null}
              <span style={{ width: 52, flex: "none", textAlign: "right", fontSize: 13, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{tasks === 0 ? "–" : tasks}</span>
              <span style={{ width: 64, flex: "none", textAlign: "right", fontSize: 12.5, color: "var(--ink-muted)" }}>{formatAge(agent.updated_at, now)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
