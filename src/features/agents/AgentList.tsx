import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { AgentRecord } from "../../types/hath";
import { Card } from "../../shared/ui/Card";
import { AgentName } from "../../shared/ui/AgentName";
import { Truncate } from "../../shared/ui/Truncate";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { useSize } from "../../shared/hooks/useSize";
import { RISE } from "../../shared/motion";
import { formatAge } from "../../shared/lib/ux/time";
import { agentActions } from "./actions";
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

const HEAD = "min-w-0 text-[12.5px] font-semibold text-ink-muted";

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

type AgentListRowProps = {
  row: AgentRow;
  state: LaneState;
  selected: boolean;
  dimmed: boolean;
  showNow: boolean;
  now: number;
  onPick: (agent: AgentRecord) => void;
};

/** One agent's row; right-click offers its thread, its Hath sheet and its name and id. */
function AgentListRow({ row: { agent, depth }, state, selected, dimmed, showNow, now, onPick }: AgentListRowProps) {
  const context = useContextActions(() => agentActions(agent, { onOpenInHath: onPick }));
  const tasks = agent.sessions.tasks.length;
  return (
    <motion.div {...RISE} {...context}>
      <button
        type="button"
        className={`agent-row ui-trans flex min-h-[46px] w-full items-center gap-3.5 border-b border-rule px-[18px] py-1.5 ${dimmed ? "opacity-40" : ""}`}
        aria-current={selected}
        onClick={() => onPick(agent)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-left" style={{ paddingLeft: depth * INDENT }}>
          {depth > 0 ? <span className="-mt-1 size-2.5 flex-none rounded-bl-[4px] border-b border-l border-sage-line" /> : null}
          <span className={`size-2 flex-none rounded-full ${isLive(state) ? "bg-sage" : "bg-ink-ghost"}`} />
          <AgentName name={agent.name} selectable={false} className={`text-[14px] ${depth > 0 ? "font-medium" : "font-semibold"}`} />
        </div>
        <span className="w-[124px] flex-none text-left">
          {state === "idle" ? <span className="text-[13px] text-ink-muted">idle</span> : <span className="text-[13px] font-medium text-sage-text">{LANE_STATE_LABEL[state]}</span>}
        </span>
        {showNow ? <Truncate text={nowOf(agent)} className="ui-mono min-w-0 flex-1 text-ink-muted" /> : null}
        <span className="w-[52px] flex-none text-right text-[13px] text-ink-muted tabular-nums">{tasks === 0 ? "–" : tasks}</span>
        <span className="w-16 flex-none text-right text-[13px] text-ink-muted">{formatAge(agent.updated_at, now)}</span>
      </button>
    </motion.div>
  );
}

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
      <div className="flex h-10 flex-none items-center gap-3.5 border-b border-rule px-[18px]">
        <span className={`${HEAD} w-0 flex-1`}>Agent</span>
        <span className={`${HEAD} w-[124px] flex-none`}>State</span>
        {showNow ? <span className={`${HEAD} w-0 flex-1`}>Now</span> : null}
        <span className={`${HEAD} w-[52px] flex-none text-right`}>Tasks</span>
        <span className={`${HEAD} w-16 flex-none text-right`}>Active</span>
      </div>
      <div className="scroll min-h-0 flex-1">
        {agentRows(agents).map((row) => (
          <AgentListRow key={row.agent.id} row={row} state={stateOf(row.agent)} selected={row.agent.id === selectedId} dimmed={dimmed?.has(row.agent.id) ?? false} showNow={showNow} now={now} onPick={onPick} />
        ))}
      </div>
    </Card>
  );
}
