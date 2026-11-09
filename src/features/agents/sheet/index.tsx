import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../../shared/api";
import type { AgentRecord, PatchScheduleRequest } from "../../../types/hath";
import { useConnection } from "../../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../../shared/hooks/useEvents";
import { getChatState, openAgent, subscribeChat } from "../../../contexts/chat";
import { getRunning, subscribeRunning } from "../../../contexts/running";
import { AgentSheetPanel, type SheetFeed } from "./Panel";
import type { SheetTask } from "./HelperTasks";

/** How often the sheet's relative words are measured again. */
const TICK_MS = 30_000;

/** What a query is showing as a {@link SheetFeed}: its items once read, nothing while it loads, or its error. */
function feedOf<T>(query: { data: T[] | undefined; error: Error | null }): SheetFeed<T> {
  if (query.error !== null) {
    return { kind: "error", message: query.error.message };
  }
  return query.data === undefined ? { kind: "loading" } : { kind: "ready", items: query.data };
}

export type AgentSheetProps = {
  agentId: string;
  /** Selects another agent, as the sheet's parent link and a wake's reason do. */
  onSelect: (agentId: string) => void;
  /** Closes the surface the sheet is in; the sheet draws a close control when given. */
  onClose?: () => void;
};

/**
 * The sheet of one agent: it reads the agent from the agents list the page already holds, its schedule and the helper tasks
 * Nas holds, and hands the panel what it draws; the panel's timeline reads the agent's wakes. Nothing is drawn until the
 * agent is in the list.
 */
export function AgentSheet({ agentId, onSelect, onClose }: AgentSheetProps) {
  const queryClient = useQueryClient();
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const running = useSyncExternalStore(subscribeRunning, getRunning);
  const unread = useSyncExternalStore(subscribeChat, getChatState).unread[agentId] ?? 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const agents = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: async () => (await hath.listAgents()).agents, enabled: connected });
  const schedules = useQuery({ queryKey: ["agent-schedules", agentId], queryFn: async () => (await hath.listSchedules(agentId)).schedules, enabled: connected });
  const detail = useQuery({ queryKey: ["agent", agentId], queryFn: () => hath.getAgent(agentId), enabled: connected });
  const tasks = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: connected });

  const listed = agents.data?.find((candidate) => candidate.id === agentId);
  if (listed === undefined) {
    return null;
  }
  const agent: AgentRecord = { ...listed, ...detail.data, running: { ...listed.running, ...detail.data?.running, ...running[agentId] } };
  const parent = agents.data?.find((candidate) => candidate.id === agent.parent_agent_id && candidate.active) ?? null;
  const nameOf = (id: string | null) => (id === null ? "Ankur" : (agents.data?.find((candidate) => candidate.id === id)?.name ?? id));
  const refreshSchedules = () => queryClient.invalidateQueries({ queryKey: ["agent-schedules"] });
  const saveSchedule = async (id: string, changes: PatchScheduleRequest) => {
    await hath.patchSchedule(id, changes);
    await refreshSchedules();
  };
  const cancelSchedule = async (id: string) => {
    await hath.cancelSchedule(id);
    await refreshSchedules();
  };
  const haltTask = async (taskId: string) => {
    await hath.haltSession(agentId, taskId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] }),
      queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] }),
    ]);
  };
  const sheetTasks = agent.sessions.tasks.map((row): SheetTask => {
    const live = tasks.data?.find((candidate) => candidate.task === row.id);
    return { task: live === undefined ? row : { ...row, status: live.status }, question: live?.state ?? "" };
  });

  return (
    <AgentSheetPanel
      key={agentId}
      agent={agent}
      unread={unread}
      tasks={sheetTasks}
      onHaltTask={haltTask}
      schedules={feedOf(schedules)}
      onSaveSchedule={saveSchedule}
      onCancelSchedule={cancelSchedule}
      parent={parent}
      onSelectAgent={onSelect}
      nameOf={nameOf}
      connected={connected}
      onOpenThread={() => openAgent(agentId)}
      onClose={onClose}
      now={now}
    />
  );
}
