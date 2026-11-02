import type { ReactNode } from "react";
import type { AgentTask } from "../../types/hath";
import { formatAge, formatClock, formatRelative } from "../lib/ux/time";
import { Badge } from "./Badge";
import { Chevron, Reveal } from "./Disclosure";
import { Icon } from "./Icon";
import { Clamp, NameTruncate, Truncate } from "./Truncate";

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
  /** The expanded content: the task's {@link TaskPreview} and any controls; a page mounts it only while the row is open or easing shut. Unused while the task sleeps. */
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
 */
export function TaskRow({ task, owner, showOwner = false, question, open, onToggle, children, now = Date.now() }: TaskRowProps) {
  const waiting = task.status === "asking";
  const asleep = task.status === "asleep";
  return (
    <div
      className={open ? "trow open" : "trow"}
      style={{
        borderRadius: 14,
        background: waiting ? "var(--tide-wash)" : "transparent",
        border: `1px solid ${waiting ? "var(--tide-line)" : "transparent"}`,
        animation: "rise 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
      }}
    >
      <button
        type="button"
        className="ui-trans ui-hover-fill"
        aria-expanded={open}
        onClick={onToggle}
        style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", padding: "10px 10px 10px 8px", borderRadius: 12, textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", color: "var(--ink-muted)" }}>
            <Chevron />
          </span>
          <span style={{ display: "flex", color: waiting ? "var(--tide-ink)" : "var(--ink-muted)" }}>
            <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={15} />
          </span>
          <Truncate text={shortId(task.id)} style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-numeric)", fontSize: 12.5, color: "var(--ink)" }} />
          {showOwner && owner ? <NameTruncate name={owner} style={{ maxWidth: 150, fontSize: 12.5, color: "var(--ink-muted)" }} /> : null}
          <Badge status={task.status} />
          <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap", flex: "none", width: 30, textAlign: "right" }}>{formatAge(task.last_activity, now)}</span>
        </div>
        <div style={{ paddingLeft: 45 }}>
          <Clamp text={task.purpose} lines={2} style={{ fontSize: 13.5, lineHeight: "19px", color: "var(--ink)" }} />
        </div>
        {!asleep && task.current ? (
          <div style={{ paddingLeft: 45 }}>
            <Truncate text={task.current} className="ui-mono" />
          </div>
        ) : null}
      </button>
      {waiting ? (
        <div style={{ margin: "0 10px 10px 45px", padding: "10px 12px", borderRadius: 11, background: "var(--bone)", border: "1px solid var(--tide-line)", display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="ui-label" style={{ color: "var(--tide-ink)", fontSize: 10.5 }}>{`Asked ${owner ?? "its agent"}`}</span>
          <Clamp text={question || task.current} lines={3} style={{ fontSize: 13.5, lineHeight: "19px" }} />
          <Truncate text={formatRelative(task.last_activity, now)} className="ui-mono" style={{ fontSize: 11.5, fontFamily: "Inter" }} />
        </div>
      ) : null}
      <Reveal>
        <div style={{ padding: "0 10px 10px 8px" }}>
          {asleep ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "var(--sage-fill)", fontSize: 13, color: "var(--ink-muted)" }}>
              <Icon name="clock" size={14} />
              <span>{`Asleep since ${formatClock(task.last_activity)}. It wakes on the next steer.`}</span>
            </div>
          ) : (
            children === undefined ? null : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
