import { motion } from "motion/react";
import type { AgentTask } from "../../../types/hath";
import { useContextActions } from "../../interaction/contextMenu";
import { formatClock, formatRelative } from "../../lib/ux/time";
import { RISE } from "../../motion";
import { Icon } from "../../ui/Icon";
import { AgentName } from "../../ui/AgentName";
import { Clamp, Truncate } from "../../ui/Truncate";
import { pushToast } from "../../../contexts/toasts";
import { setTakeover } from "../../../contexts/takeover";
import { taskActions } from "./actions";
import { TaskStatus } from "./TaskStatus";

export type TaskRowProps = {
  task: AgentTask;
  /** The owning agent's id; it names the row on the System page and who a waiting task asked. */
  owner?: string;
  /** Show the owner in the row, for lists that mix agents. */
  showOwner?: boolean;
  /** The helper's own words when it is waiting on its agent. */
  question?: string;
  now?: number;
};

/** A helper task's id without its `task/` prefix. */
function shortId(id: string): string {
  return id.replace(/^task\//, "");
}

/**
 * The one row for a helper task, shared by the agent sheet and the System page: its id, owner, status and age,
 * what it is for and where it is now. A click opens the task's live view at once; a task that is asleep has none, so it
 * says so in a toast instead. A task waiting on its agent shows the question it asked, never as a request to Ankur. A
 * task its owner is driving has the `paused` status. Right-click offers the task's actions.
 */
export function TaskRow({ task, owner, showOwner = false, question, now = Date.now() }: TaskRowProps) {
  const waiting = task.status === "asking";
  const asleep = task.status === "asleep";
  const context = useContextActions(() => taskActions({ id: task.id, live: !asleep }));
  const open = () => {
    if (asleep) {
      pushToast({
        key: `task-asleep:${task.id}`,
        tone: "info",
        module: "system",
        title: `${owner ?? "This agent"}'s task is asleep`,
        body: `Asleep since ${formatClock(task.last_activity)}. It wakes on the next steer.`,
      });
      return;
    }
    setTakeover(task.id);
  };
  return (
    <motion.div {...RISE} {...context} className={`overflow-hidden rounded-[14px] border ${waiting ? "border-tide-line bg-tide-wash" : "border-transparent"}`}>
      <button type="button" className="ui-trans ui-hover-fill flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left" onClick={open}>
        <div className="flex items-center gap-2">
          <span className={`flex ${waiting ? "text-tide-ink" : "text-ink-muted"}`}>
            <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={15} />
          </span>
          <Truncate text={shortId(task.id)} className="min-w-0 flex-1 font-numeric text-[13px] text-ink" />
          {showOwner && owner ? <AgentName name={owner} selectable={false} className="max-w-[40%] text-[13px] text-ink-muted" /> : null}
          <TaskStatus status={task.status} lastActivity={task.last_activity} now={now} />
        </div>
        <div className="pl-[23px]">
          <Clamp text={task.purpose} lines={2} style={{ fontSize: 14, lineHeight: "19px" }} />
        </div>
        {!asleep && task.current ? (
          <div className="pl-[23px]">
            <Truncate text={task.current} className="ui-mono" />
          </div>
        ) : null}
      </button>
      {waiting ? (
        <div className="mt-0 mr-2.5 mb-2.5 ml-[35px] flex flex-col gap-1.5 rounded-[12px] border border-tide-line bg-bone px-3 py-2.5">
          <span className="ui-label text-tide-ink">{`Asked ${owner ?? "its agent"}`}</span>
          <span data-selectable className="text-[14px] leading-[19px]">{question || task.current}</span>
          <Truncate text={formatRelative(task.last_activity, now)} className="ui-mono" />
        </div>
      ) : null}
    </motion.div>
  );
}
