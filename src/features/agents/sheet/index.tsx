import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../../shared/api";
import type { AgentRecord } from "../../../types/hath";
import { useConnection } from "../../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../../shared/hooks/useEvents";
import { openAgent } from "../../../store/chat";
import { getRunning, subscribeRunning } from "../../../store/running";
import { autoLiveTaskId, showsLiveView } from "../sessions";
import { TaskPreviewLive } from "../TaskLive";
import { AgentSheetPanel, type SheetFeed, type SheetSection, type SheetTask } from "./Panel";
import { sheetWakes } from "./wakes";

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
};

/**
 * The sheet of one agent, docked beside the Hath graph: it reads the agent from the agents list the page already holds, its
 * schedule, its newest wakes and the helper tasks Nas holds, keeps which sections and task rows are open, and hands the
 * panel what it draws. Nothing is drawn until the agent is in the list.
 */
export function AgentSheet({ agentId }: AgentSheetProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const running = useSyncExternalStore(subscribeRunning, getRunning);
  const [now, setNow] = useState(() => Date.now());
  const [openSections, setOpenSections] = useState<Partial<Record<SheetSection, boolean>>>({});
  const [taskOverrides, setTaskOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setOpenSections({});
    setTaskOverrides({});
  }, [agentId]);

  const agents = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: async () => (await hath.listAgents()).agents, enabled: connected });
  const schedules = useQuery({ queryKey: ["agent-schedules", agentId], queryFn: async () => (await hath.listSchedules(agentId)).schedules, enabled: connected });
  const logs = useQuery({ queryKey: ["agent-logs", agentId, "activity"], queryFn: async () => sheetWakes((await hath.getAgentLogs(agentId, { wakes: ACTIVITY_WAKES })).logs), enabled: connected });
  const tasks = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: connected });

  const listed = agents.data?.find((candidate) => candidate.id === agentId);
  if (listed === undefined) {
    return null;
  }
  const agent: AgentRecord = { ...listed, running: { ...listed.running, ...running[agentId] } };
  const autoId = autoLiveTaskId(agent.sessions.tasks);
  const sheetTasks = agent.sessions.tasks.map((row): SheetTask => {
    const live = tasks.data?.find((candidate) => candidate.task === row.id);
    const shortId = row.id.replace(/^task\//, "");
    return {
      task: live === undefined ? row : { ...row, status: live.status },
      question: live?.state ?? "",
      preview:
        live?.resource === undefined || live.status === "asleep" ? null : (
          <TaskPreviewLive
            task={row.id}
            kind={row.kind}
            resource={live.resource}
            caption={row.kind === "browser" ? row.current : `${shortId} · ${live.resource}`}
            paused={live.status === "paused"}
          />
        ),
    };
  });

  return (
    <AgentSheetPanel
      agent={agent}
      tasks={sheetTasks}
      schedules={feedOf(schedules)}
      wakes={feedOf(logs)}
      isOpen={(section) => openSections[section] === true}
      onToggle={(section) => setOpenSections((open) => ({ ...open, [section]: open[section] !== true }))}
      isTaskOpen={(taskId) => showsLiveView(taskId, autoId, taskOverrides)}
      onToggleTask={(taskId) => setTaskOverrides((overrides) => ({ ...overrides, [taskId]: !showsLiveView(taskId, autoId, overrides) }))}
      onOpenThread={() => openAgent(agentId)}
      now={now}
    />
  );
}
