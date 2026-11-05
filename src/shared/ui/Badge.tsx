import type { TaskStatus } from "../../types/hath";
import { Icon } from "./Icon";

export type BadgeProps = {
  status: TaskStatus;
  /** The word to show when it is not the status's own, such as a device waiting to join. */
  label?: string;
};

/** A task asking is waiting on its agent, never on Ankur, so it reads that way. */
const WORD: Record<TaskStatus, string> = {
  working: "working",
  idle: "idle",
  asleep: "asleep",
  asking: "waiting on agent",
  paused: "paused",
};

/** The status word of a helper task: working pulses in sage, waiting on its agent in tide, paused in clay, the rest dashed and quiet. */
export function Badge({ status, label }: BadgeProps) {
  return (
    <span className={`badge badge-${status}`}>
      {status === "working" ? <span className="dot dot-pulse" style={{ width: 6, height: 6, background: "var(--sage)" }} /> : null}
      {status === "asking" ? <span className="dot dot-pulse" style={{ width: 6, height: 6, background: "var(--tide)" }} /> : null}
      {status === "paused" ? <Icon name="pause" size={11} /> : null}
      {label ?? WORD[status]}
    </span>
  );
}
