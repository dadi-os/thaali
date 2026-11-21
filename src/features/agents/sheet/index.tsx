import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../../shared/api";
import type { AgentRecord } from "../../../types/hath";
import { useConnection } from "../../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY, fetchAgents } from "../../../shared/hooks/useEvents";
import { openAgent } from "../../../contexts/chat";
import { getLiveWakes, getRunning, subscribeRunning } from "../../../contexts/running";
import { standingOf } from "./brief";
import { AgentSheetPanel, type SheetFeed, type StopState } from "./Panel";
import { useWakeList, useWake } from "./useWakes";
import type { SheetTask } from "./HelperTasks";

/** How often the sheet's relative words are measured again. */
const TICK_MS = 30_000;

/** How many of the newest human-thread messages are read for what the thread still waits on. */
const STANDING_MESSAGES = 5;
/** How many of the newest wakes are read for it when the thread route carries no message status. */
const STANDING_WAKES = 3;

/** What a query is showing as a {@link SheetFeed}: its data once read, nothing while it loads, or its error. */
function feedOf<T>(query: { data: T | undefined; error: Error | null }): SheetFeed<T> {
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
 * The sheet of one agent: it reads the agent from the agents list the page already holds, its routines, the newest messages
 * and wakes (for what the thread still waits on) and the helper tasks Nas holds, and hands the panel what it draws; the panel's timeline reads the agent's wakes. Nothing is drawn until the
 * agent is in the list.
 */
export function AgentSheet({ agentId, onSelect, onClose }: AgentSheetProps) {
  const queryClient = useQueryClient();
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const running = useSyncExternalStore(subscribeRunning, getRunning);
  const liveWakes = useSyncExternalStore(subscribeRunning, getLiveWakes);
  const [stop, setStop] = useState<StopState>({ pending: false, result: null, error: null });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setStop({ pending: false, result: null, error: null });
  }, [agentId]);

  const agents = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: fetchAgents, enabled: connected });
  const routines = useQuery({ queryKey: ["agent-routines", agentId], queryFn: () => hath.listRoutines(agentId), enabled: connected });
  const thread = useQuery({ queryKey: ["agent-messages", agentId, "standing"], queryFn: async () => (await hath.listMessages(agentId, { limit: STANDING_MESSAGES })).messages, enabled: connected });
  const wakes = useWakeList(agentId, connected);
  const recent = (wakes.data?.pages[0]?.wakes ?? []).slice(0, STANDING_WAKES);
  const wakeDetails = [useWake(agentId, recent[0]?.id ?? null, connected), useWake(agentId, recent[1]?.id ?? null, connected), useWake(agentId, recent[2]?.id ?? null, connected)];
  const detail = useQuery({ queryKey: ["agent", agentId], queryFn: () => hath.getAgent(agentId), enabled: connected });
  const tasks = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: connected });

  const listed = agents.data?.find((candidate) => candidate.id === agentId);
  if (listed === undefined) {
    return null;
  }
  const agent: AgentRecord = { ...listed, ...detail.data, running: running[agentId] ?? detail.data?.running ?? listed.running };
  const parent = agents.data?.find((candidate) => candidate.id === agent.parent_agent_id && candidate.active) ?? null;
  const nameOf = (id: string | null) => (id === null ? "Ankur" : (agents.data?.find((candidate) => candidate.id === id)?.name ?? id));
  const standing = thread.data === undefined ? null : standingOf(thread.data, wakeDetails.flatMap((query) => query.data ?? []));
  const refreshRoutines = () => queryClient.invalidateQueries({ queryKey: ["agent-routines"] });
  const stopAgent = async () => {
    setStop({ pending: true, result: null, error: null });
    try {
      const result = await hath.stopAgent(agentId);
      setStop({ pending: false, result, error: null });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] }),
        queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] }),
      ]);
    } catch (failure) {
      setStop({ pending: false, result: null, error: failure instanceof Error ? failure.message : String(failure) });
    }
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
      tasks={sheetTasks}
      onHaltTask={haltTask}
      standing={standing}
      live={liveWakes[agentId]}
      stop={stop}
      onStop={() => void stopAgent()}
      routines={feedOf(routines)}
      onCancelRoutine={async (id) => {
        await hath.cancelRoutine(id);
        await refreshRoutines();
      }}
      onCancelReminder={async (id) => {
        await hath.cancelReminder(id);
        await refreshRoutines();
      }}
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
