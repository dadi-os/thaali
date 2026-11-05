import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../shared/api";
import type { NasTask } from "../../shared/api/nas";
import { Card } from "../../shared/ui/Card";
import { Pill } from "../../shared/ui/Button";
import { StateView } from "../../shared/states/ModuleState";
import { Skeleton } from "../../shared/ui/Skeleton";
import { TaskRow } from "../../shared/components/Task/TaskRow";
import { TaskView } from "../../shared/components/Task/TaskView";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { failureProps } from "../../shared/lib/ux/moduleState";
import { POLL_MS } from "../../shared/lib/ux/poll";
import type { AgentTask } from "../../types/hath";
import { SectionLabel } from "./SectionLabel";
import { filterCounts, listedTasks, slotLabel, TASK_FILTERS, type TaskFilter } from "./taskList";

type TaskItemProps = {
  task: NasTask;
  /** Where the task is now, from its owner's session row in Hath. */
  current: string;
  open: boolean;
  onToggle: () => void;
};

/** One helper task as a row; its live view is mounted by the row only while it is open, since a mounted view holds a capture on the box. */
function TaskItem({ task, current, open, onToggle }: TaskItemProps) {
  const row: AgentTask = { id: task.task, kind: task.kind, status: task.status, purpose: task.purpose, current, last_activity: task.last_activity };
  const slot = slotLabel(task);
  return (
    <TaskRow task={row} owner={task.owner} showOwner question={task.state} open={open} onToggle={onToggle}>
      {task.resource !== undefined ? (
        <>
          {slot === null ? null : (
            <div className="flex items-center gap-2.5 px-1">
              <span data-selectable className="min-w-0 flex-1">
                <Truncate text={slot} className="ui-mono" />
              </span>
            </div>
          )}
          <TaskView
            task={task.task}
            kind={task.kind}
            resource={task.resource}
            caption={task.kind === "browser" ? current : `${task.id} · ${task.resource}`}
            paused={task.status === "paused"}
            variant="tall"
          />
        </>
      ) : undefined}
    </TaskRow>
  );
}

/**
 * Every browser and terminal helper task Nas holds: a filter chip row, then one row per task with its owner, status,
 * purpose and where it is now, and a tall live view when it is opened. A task waiting on its agent is listed first.
 * Nas's list is refetched whenever it says its tasks changed.
 */
export function TasksBlock() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const [filter, setFilter] = useState<TaskFilter>("All");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const tasksQuery = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: connected, refetchInterval: POLL_MS });
  const agentsQuery = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: async () => (await hath.listAgents()).agents, enabled: connected });
  const state = useModuleState(tasksQuery, (tasks) => tasks.length === 0);

  const currentOf = (id: string): string => {
    for (const agent of agentsQuery.data ?? []) {
      const row = agent.sessions.tasks.find((candidate) => candidate.id === id);
      if (row !== undefined) {
        return row.current;
      }
    }
    return "";
  };
  const toggle = (id: string) =>
    setOpenIds((open) => {
      const next = new Set(open);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  const tasks = state.kind === "ready" ? state.data : [];
  const counts = filterCounts(tasks);
  let body: ReactNode;
  switch (state.kind) {
    case "loading":
      body = (
        <div className="flex flex-col gap-3.5 p-3.5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <Skeleton width={160} height={14} />
                <Skeleton width={60} height={20} radius={10} style={{ marginLeft: "auto" }} />
              </div>
              <Skeleton width="70%" height={12} />
              <Skeleton width="40%" height={11} />
            </div>
          ))}
        </div>
      );
      break;
    case "offline":
      body = <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />;
      break;
    case "module-offline":
    case "error":
      body = <StateView kind="error" title="Nas couldn’t list the tasks" {...failureProps(state.error)} detail="GET /tasks failed; the rest of this page is current." onRetry={() => void tasksQuery.refetch()} />;
      break;
    case "empty":
      body = <div className="px-4 py-5 text-[13.5px] text-ink-muted">None in flight. Tasks appear here while an agent’s browser or terminal helper is running.</div>;
      break;
    case "ready":
      body = (
        <div className="flex flex-col p-1.5">
          {listedTasks(tasks, filter).map((task) => (
            <TaskItem key={task.task} task={task} current={currentOf(task.task)} open={openIds.has(task.task)} onToggle={() => toggle(task.task)} />
          ))}
        </div>
      );
      break;
  }
  const waiting = counts.Waiting;
  return (
    <>
      <SectionLabel right={state.kind === "ready" ? <span className="text-[12.5px] text-ink-muted">{`${tasks.length} · ${waiting} waiting on an agent`}</span> : null}>Tasks</SectionLabel>
      {state.kind === "ready" ? (
        <div className="flex flex-wrap items-center gap-2">
          {TASK_FILTERS.map((name) => (
            <Pill key={name} active={name === filter} count={counts[name]} onClick={() => setFilter(name)}>
              {name}
            </Pill>
          ))}
        </div>
      ) : null}
      <Card style={{ borderRadius: 16 }}>{body}</Card>
    </>
  );
}
