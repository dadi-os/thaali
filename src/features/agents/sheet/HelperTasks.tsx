import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { REVEAL } from "../../../shared/motion";
import { isActiveTask } from "../sessions";
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
 * The agent's helper tasks: a row each for the ones doing something (a click opens its live view) and, while the task can still
 * be stopped, a Stop that asks first. Idle, asleep and stopped ones wait behind a `Show N idle` toggle that eases them open, and all
 * of them do when none is active. A refused stop is a toast with the reason in plain words, and the row stays as it was.
 */
export function HelperTasks({ owner, tasks, onHalt, now }: HelperTasksProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [halting, setHalting] = useState<string | null>(null);
  const [showIdle, setShowIdle] = useState(false);
  if (tasks.length === 0) {
    return null;
  }
  const active = tasks.filter(({ task }) => isActiveTask(task.status));
  const idle = tasks.filter(({ task }) => !isActiveTask(task.status));
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
  const row = ({ task, question }: SheetTask) => (
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
  );
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="Helper tasks" count={active.length === tasks.length ? `${active.length} active` : `${active.length} of ${tasks.length} active`} />
      {active.map(row)}
      {idle.length === 0 ? null : (
        <>
          <AnimatePresence initial={false}>
            {showIdle ? (
              <motion.div key="idle" {...REVEAL} className="flex flex-col overflow-hidden">
                {idle.map(row)}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <Button tone="quiet" size="sm" aria-expanded={showIdle} style={{ alignSelf: "flex-start" }} onClick={() => setShowIdle(!showIdle)}>
            {showIdle ? "Hide idle" : `Show ${idle.length} idle`}
          </Button>
        </>
      )}
    </div>
  );
}
