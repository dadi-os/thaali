import type { TaskStatus as Status } from "../../../types/hath";
import { formatAge } from "../../lib/ux/time";
import { Badge } from "../../ui/Badge";

export type TaskStatusProps = {
  status: Status;
  /** ISO time of the task's last activity. */
  lastActivity: string;
  now?: number;
};

/** A task's status badge and how long ago it was last active, as every task row and header shows them. */
export function TaskStatus({ status, lastActivity, now = Date.now() }: TaskStatusProps) {
  return (
    <>
      <Badge status={status} />
      <span className="w-[30px] flex-none text-right text-[12px] whitespace-nowrap text-ink-muted">{formatAge(lastActivity, now)}</span>
    </>
  );
}
