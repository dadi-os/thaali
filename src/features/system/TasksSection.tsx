import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../shared/api";
import type { NasTask } from "../../shared/api/nas";
import { useConnection } from "../../shared/hooks/useConnection";
import { Tooltip } from "../../shared/components/Tooltip";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { taskLiveView } from "../agents/sessions";
import { TaskLive, TaskStatusBadge } from "../agents/TaskLive";

/** The slot or terminal a task holds in Nas, or an em dash while it sleeps. */
export function taskResourceLabel(task: NasTask): string {
  if (task.resource === undefined) {
    return "—";
  }
  return task.kind === "browser" ? `slot ${task.resource}` : task.resource;
}

/**
 * Every browser and terminal helper task Nas holds, newest activity first: its kind and
 * id, owning agent, current step or state summary, status, slot and time since it last
 * did anything. Opening one shows its live browser or terminal screen (its state summary
 * while it sleeps). Refetched whenever Nas says its tasks changed.
 */
export function TasksSection() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const [openId, setOpenId] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["nas", "tasks"],
    queryFn: () => nas.listTasks(),
    enabled: connected,
  });
  const agentsQuery = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => (await hath.listAgents()).agents,
    enabled: connected,
  });

  const tasks = tasksQuery.data;
  const names = new Map((agentsQuery.data ?? []).map((a) => [a.id, a.name]));
  const card =
    "rounded-[18px] border border-(--glass-border) bg-(--glass-veil) shadow-[0_1px_2px_rgba(92,107,82,0.05),0_10px_30px_rgba(44,48,42,0.05)]";

  return (
    <ul className={`flex flex-col px-3.5 py-1 ${card}`}>
      {tasks === undefined ? (
        <li className="flex flex-col gap-2 py-3">
          <span className="skeleton h-3 w-1/3" />
          <span className="skeleton h-2.5 w-1/4" />
        </li>
      ) : tasks.length === 0 ? (
        <li className="py-3 text-[13px] text-ink-ghost">No tasks</li>
      ) : (
        tasks.map((task) => {
          const open = openId === task.task;
          return (
            <li key={task.task} className="border-b border-rule/50 last:border-b-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : task.task)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-mono text-[13px] font-semibold text-ink">{task.task}</span>
                    <span className="shrink-0 text-[12px] text-ink-ghost">{names.get(task.owner) ?? task.owner}</span>
                  </span>
                  <span className="truncate text-[12.5px] text-ink-muted" title={task.state}>
                    {task.state}
                  </span>
                  <span className="truncate font-mono text-[11.5px] text-ink-ghost">{taskResourceLabel(task)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <TaskStatusBadge status={task.status} />
                  <Tooltip content={formatAbsolute(task.last_activity)}>
                    <span className="text-[11.5px] text-ink-ghost">{formatRelative(task.last_activity)}</span>
                  </Tooltip>
                </span>
              </button>
              {open ? (
                <div className="pb-3">
                  <TaskLive view={taskLiveView(task)} summary={task.state} tall />
                </div>
              ) : null}
            </li>
          );
        })
      )}
    </ul>
  );
}
