import { useState } from "react";
import type { AgentTask } from "../../../types/hath";
import { SectionHeader } from "../../../shared/components/Module";
import { TaskRow } from "../../../shared/components/Task/TaskRow";
import { pushToast } from "../../../contexts/toasts";
import { Button } from "../../../shared/ui/Button";
import { haltSentence } from "./wakes";

/** A helper task of the agent as the sheet lists it. */
export type SheetTask = {
  /** Hath's session row, with the status Nas reports now. */
  task: AgentTask;
  /** The helper's own words when it is waiting on its agent. */
  question: string;
};

/** The statuses of a task that Stop can still end. */
const STOPPABLE: ReadonlySet<AgentTask["status"]> = new Set(["working", "paused", "idle", "asking"]);

/** Props of {@link HelperTasks}. */
export type HelperTasksProps = {
  /** The agent's name, for the rows' words. */
  owner: string;
  /** The agent's helper tasks, most recently active first. */
  tasks: SheetTask[];
  /** Halts the task with this address; rejects with Hath's reason. */
  onHalt: (taskId: string) => Promise<void>;
  /** The time the rows' relative words are measured from. */
  now: number;
};

/**
 * The agent's helper tasks: a row each (a click opens its live view) and, while the task can still be stopped, a Stop that asks
 * first. A refused stop is a toast with the reason in plain words, and the row stays as it was.
 */
export function HelperTasks({ owner, tasks, onHalt, now }: HelperTasksProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [halting, setHalting] = useState<string | null>(null);
  if (tasks.length === 0) {
    return null;
  }
  const active = tasks.filter(({ task }) => STOPPABLE.has(task.status)).length;
  const stop = async (taskId: string) => {
    setHalting(taskId);
    try {
      await onHalt(taskId);
    } catch (error) {
      pushToast({ key: `task-halt:${taskId}`, tone: "error", module: "hath", title: `Could not stop ${taskId.replace(/^task\//, "")}`, body: haltSentence(error) });
    } finally {
      setHalting(null);
      setConfirming(null);
    }
  };
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="Helper tasks" count={`${tasks.length} · ${active} active`} />
      {tasks.map(({ task, question }) => (
        <div key={task.id} className="flex flex-col">
          <TaskRow task={task} owner={owner} question={question} now={now} />
          {STOPPABLE.has(task.status) ? (
            <div className="flex items-center justify-end gap-2 px-3 pb-1">
              {confirming === task.id ? (
                <>
                  <span className="mr-auto text-[12.5px] text-ink-muted">Stop this task?</span>
                  <Button tone="danger" size="sm" disabled={halting === task.id} onClick={() => void stop(task.id)}>
                    Stop
                  </Button>
                  <Button tone="quiet" size="sm" disabled={halting === task.id} onClick={() => setConfirming(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button tone="quiet" size="sm" aria-label={`Stop ${task.id}`} onClick={() => setConfirming(task.id)}>
                  Stop
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
