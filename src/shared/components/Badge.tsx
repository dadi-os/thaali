import type { TaskStatus } from "../../types/hath";
import { Icon } from "./Icon";

/** A helper task's status, or `paused` while its owner is driving it. */
export type BadgeStatus = TaskStatus | "paused";

export type BadgeProps = {
  status: BadgeStatus;
};

/** A task asking is waiting on its agent, never on Ankur, so it reads that way. */
const WORD: Record<BadgeStatus, string> = {
  working: "working",
  idle: "idle",
  asleep: "asleep",
  asking: "waiting on agent",
  paused: "paused",
};

/** The status word of a helper task: working pulses in sage, waiting on its agent in tide, paused in clay, the rest dashed and quiet. */
export function Badge({ status }: BadgeProps) {
  return (
    <span className={`badge badge-${status}`}>
      {status === "working" ? <span className="dot dot-pulse" style={{ width: 6, height: 6, background: "var(--sage)" }} /> : null}
      {status === "asking" ? <span className="dot dot-pulse" style={{ width: 6, height: 6, background: "var(--tide)" }} /> : null}
      {status === "paused" ? <Icon name="pause" size={11} /> : null}
      {WORD[status]}
    </span>
  );
}
