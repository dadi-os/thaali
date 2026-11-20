import type { TaskStatus as Status } from "../../../types/hath";
import { formatAge } from "../../lib/ux/time";
import { Badge } from "../../ui/Badge";

export type TaskStatusProps = {
  status: Status;
  /** ISO time of the task's last activity. */
  lastActivity: string;
  now?: number;
  /** Plain type with a dot instead of a badge, for popovers. */
  plain?: boolean;
};

/** The words of a status in plain type. */
const WORD: Record<Status, string> = { working: "working", idle: "idle", asleep: "asleep", asking: "waiting on its agent", paused: "you are driving", stopped: "stopped" };
const DOT: Record<Status, string> = { working: "bg-sage", idle: "bg-ink-ghost", asleep: "bg-ink-ghost", asking: "bg-tide", paused: "bg-[var(--due-ink)]", stopped: "bg-[var(--late-ink)]" };

/** A task's status badge and how long ago it was last active, as every task row and header shows them. */
export function TaskStatus({ status, lastActivity, now = Date.now(), plain = false }: TaskStatusProps) {
  if (plain) {
    return (
      <span className="flex flex-none items-center gap-1.5 text-[12px] text-ink-muted">
        <span className={`size-1.5 rounded-full ${DOT[status]} ${status === "working" ? "dot-pulse" : ""}`} />
        {WORD[status]}
        <span className="text-ink-ghost">{`· ${formatAge(lastActivity, now)}`}</span>
      </span>
    );
  }
  return (
    <>
      <Badge status={status} />
      <span className="w-[30px] flex-none text-right text-[12px] whitespace-nowrap text-ink-muted">{formatAge(lastActivity, now)}</span>
    </>
  );
}
