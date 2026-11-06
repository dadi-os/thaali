import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../../shared/api";
import type { AgentRecord, PatchScheduleRequest } from "../../../types/hath";
import { useConnection } from "../../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../../shared/hooks/useEvents";
import { POLL_MS } from "../../../shared/lib/ux/poll";
import { openAgent } from "../../../contexts/chat";
import { getRunning, subscribeRunning } from "../../../contexts/running";
import { AgentSheetPanel, type SheetFeed, type SheetSection, type SheetTask } from "./Panel";
import { buildActivity, carryWakeKeys, type ActivityWake } from "./activity";

/** How many of an agent's newest wakes the sheet reads, every row of each. */
const ACTIVITY_WAKES = 10;
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
  /** Selects another agent, as the sheet's parent link does. */
  onSelect: (agentId: string) => void;
  /** Closes the surface the sheet is in; the sheet draws a close control when given. */
  onClose?: () => void;
};

/**
 * The sheet of one agent, docked beside the Hath graph: it reads the agent from the agents list the page already holds, its
 * schedule, its newest wakes and the helper tasks Nas holds, keeps which sections and task rows are open, and hands the
 * panel what it draws. Nothing is drawn until the agent is in the list.
 */
export function AgentSheet({ agentId, onSelect, onClose }: AgentSheetProps) {
  const queryClient = useQueryClient();
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const running = useSyncExternalStore(subscribeRunning, getRunning);
  const [now, setNow] = useState(() => Date.now());
  const [openSections, setOpenSections] = useState<Partial<Record<SheetSection, boolean>>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setOpenSections({});
  }, [agentId]);

  const agents = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: async () => (await hath.listAgents()).agents, enabled: connected });
  const schedules = useQuery({ queryKey: ["agent-schedules", agentId], queryFn: async () => (await hath.listSchedules(agentId)).schedules, enabled: connected });
  const detail = useQuery({ queryKey: ["agent", agentId], queryFn: () => hath.getAgent(agentId), enabled: connected });
  const busy = running[agentId]?.work === true || running[agentId]?.process === true;
  const logs = useQuery({ queryKey: ["agent-logs", agentId, "activity"], queryFn: async () => (await hath.getAgentLogs(agentId, { wakes: ACTIVITY_WAKES })).logs, enabled: connected, refetchInterval: busy ? POLL_MS : false });
  const previousWakes = useRef<ActivityWake[]>([]);
  const wakes = useMemo(() => {
    if (logs.data === undefined) {
      return undefined;
    }
    const built = carryWakeKeys(previousWakes.current, buildActivity(logs.data));
    previousWakes.current = built;
    return built;
  }, [logs.data]);
  const tasks = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: connected });

  const listed = agents.data?.find((candidate) => candidate.id === agentId);
  if (listed === undefined) {
    return null;
  }
  const agent: AgentRecord = { ...listed, ...detail.data, running: { ...listed.running, ...detail.data?.running, ...running[agentId] } };
  const parent = agents.data?.find((candidate) => candidate.id === agent.parent_agent_id && candidate.active) ?? null;
  const refreshSchedules = () => queryClient.invalidateQueries({ queryKey: ["agent-schedules"] });
  const saveSchedule = async (id: string, changes: PatchScheduleRequest) => {
    await hath.patchSchedule(id, changes);
    await refreshSchedules();
  };
  const cancelSchedule = async (id: string) => {
    await hath.cancelSchedule(id);
    await refreshSchedules();
  };
  const sheetTasks = agent.sessions.tasks.map((row): SheetTask => {
    const live = tasks.data?.find((candidate) => candidate.task === row.id);
    return { task: live === undefined ? row : { ...row, status: live.status }, question: live?.state ?? "" };
  });

  return (
    <AgentSheetPanel
      agent={agent}
      tasks={sheetTasks}
      schedules={feedOf(schedules)}
      wakes={logs.error !== null ? { kind: "error", message: logs.error.message } : wakes === undefined ? { kind: "loading" } : { kind: "ready", items: wakes }}
      onSaveSchedule={saveSchedule}
      onCancelSchedule={cancelSchedule}
      parent={parent}
      onSelectParent={onSelect}
      isOpen={(section) => openSections[section] === true}
      onToggle={(section) => setOpenSections((open) => ({ ...open, [section]: open[section] !== true }))}
      onOpenThread={() => openAgent(agentId)}
      onClose={onClose}
      now={now}
    />
  );
}
