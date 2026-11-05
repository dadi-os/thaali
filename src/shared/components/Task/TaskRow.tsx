import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AgentTask } from "../../../types/hath";
import { useContextActions } from "../../interaction/contextMenu";
import { formatClock, formatRelative } from "../../lib/ux/time";
import { REVEAL, RISE } from "../../motion";
import { Chevron } from "../../ui/Disclosure";
import { Icon } from "../../ui/Icon";
import { AgentName } from "../../ui/AgentName";
import { Clamp, Truncate } from "../../ui/Truncate";
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
  open: boolean;
  onToggle: () => void;
  /** The expanded content: the task's {@link TaskView} and any controls; mounted only while the row is open and while it eases shut. Unused while the task sleeps. */
  children?: ReactNode;
  now?: number;
};

/** A helper task's id without its `task/` prefix. */
function shortId(id: string): string {
  return id.replace(/^task\//, "");
}

/**
 * The one row for a helper task, shared by the agent sheet and the System page: its id, owner, status and age,
 * what it is for and where it is now, and an expanding panel for its live view. A task waiting on its agent shows
 * the question it asked, never as a request to Ankur. A task its owner is driving has the `paused` status.
 * Right-click offers the task's actions.
 */
export function TaskRow({ task, owner, showOwner = false, question, open, onToggle, children, now = Date.now() }: TaskRowProps) {
  const waiting = task.status === "asking";
  const asleep = task.status === "asleep";
  const context = useContextActions(() => taskActions({ id: task.id, live: !asleep }));
  return (
    <motion.div {...RISE} {...context} className={`overflow-hidden rounded-[14px] border ${waiting ? "border-tide-line bg-tide-wash" : "border-transparent"}`}>
      <button type="button" className="ui-trans ui-hover-fill flex w-full flex-col gap-1.5 rounded-xl py-2.5 pr-2.5 pl-2 text-left" aria-expanded={open} onClick={onToggle}>
        <div className="flex items-center gap-2">
          <span className="flex text-ink-muted">
            <span className={open ? "open" : ""}>
              <Chevron />
            </span>
          </span>
          <span className={`flex ${waiting ? "text-tide-ink" : "text-ink-muted"}`}>
            <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={15} />
          </span>
          <Truncate text={shortId(task.id)} className="min-w-0 flex-1 font-numeric text-[12.5px] text-ink" />
          {showOwner && owner ? <AgentName name={owner} selectable={false} className="max-w-[40%] text-[12.5px] text-ink-muted" /> : null}
          <TaskStatus status={task.status} lastActivity={task.last_activity} now={now} />
        </div>
        <div className="pl-[45px]">
          <Clamp text={task.purpose} lines={2} style={{ fontSize: 13.5, lineHeight: "19px" }} />
        </div>
        {!asleep && task.current ? (
          <div className="pl-[45px]">
            <Truncate text={task.current} className="ui-mono" />
          </div>
        ) : null}
      </button>
      {waiting ? (
        <div className="mt-0 mr-2.5 mb-2.5 ml-[45px] flex flex-col gap-1.5 rounded-[11px] border border-tide-line bg-bone px-3 py-2.5">
          <span className="ui-label text-tide-ink" style={{ fontSize: 10.5 }}>{`Asked ${owner ?? "its agent"}`}</span>
          <span data-selectable className="text-[13.5px] leading-[19px]">{question || task.current}</span>
          <Truncate text={formatRelative(task.last_activity, now)} className="ui-mono" />
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="body" {...REVEAL} className="overflow-hidden">
            <div className="flex flex-col gap-2 pr-2.5 pb-2.5 pl-2">
              {asleep ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-sage-fill p-3 text-[13px] text-ink-muted">
                  <Icon name="clock" size={14} />
                  <span>{`Asleep since ${formatClock(task.last_activity)}. It wakes on the next steer.`}</span>
                </div>
              ) : (
                children
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
