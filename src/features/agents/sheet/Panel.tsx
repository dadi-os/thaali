import type { ReactNode } from "react";
import type { AgentRecord, AgentTask, ScheduledMessage } from "../../../types/hath";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { Disclosure } from "../../../shared/components/Disclosure";
import { Icon } from "../../../shared/components/Icon";
import { TaskRow } from "../../../shared/components/TaskRow";
import { Clamp, NameTruncate, Truncate } from "../../../shared/components/Truncate";
import { formatClock, formatDay, formatRelative } from "../../../shared/lib/ux/time";
import type { SheetWake } from "./wakes";
import { workLine } from "./workLine";

/** Characters per token Hath measured for the model's text; a charter's size in tokens is its characters over this. */
const CHARS_PER_TOKEN = 2.37;

/** The sections of the sheet that open and shut. */
export type SheetSection = "calls" | "queued" | "scheduled" | "charter" | "activity";

/** A helper task of the agent as the sheet lists it. */
export type SheetTask = {
  /** Hath's session row, with the status Nas reports now. */
  task: AgentTask;
  /** The helper's own words when it is waiting on its agent. */
  question: string;
  /** The task's {@link TaskPreview}; unused while the task sleeps. */
  preview: ReactNode;
};

/** What a section that is read on its own can be showing. */
export type SheetFeed<T> = { kind: "ready"; items: T[] } | { kind: "loading" } | { kind: "error"; message: string };

export type AgentSheetPanelProps = {
  agent: AgentRecord;
  /** The agent's helper tasks, with the status Nas reports now; an `asking` one is waiting on this agent. */
  tasks: SheetTask[];
  schedules: SheetFeed<ScheduledMessage>;
  /** The agent's newest wakes, newest first. */
  wakes: SheetFeed<SheetWake>;
  /** Whether a section is open. */
  isOpen: (section: SheetSection) => boolean;
  onToggle: (section: SheetSection) => void;
  /** Whether a task's row is open, showing its preview. */
  isTaskOpen: (taskId: string) => boolean;
  onToggleTask: (taskId: string) => void;
  /** Opens the agent's chat in the rail. */
  onOpenThread: () => void;
  /** The time the sheet's relative words are measured from. */
  now: number;
};

/** A count of thousands as `1.2k`, below that the number. */
function kilo(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** A markdown charter as the sheet draws it: `##` headings, `-` bullets and paragraphs, with nothing else interpreted. */
function CharterText({ source }: { source: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {source.split("\n").flatMap((line, index) => {
        if (line.startsWith("## ")) {
          return [
            <span key={index} style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "10px 0 3px" }}>
              {line.slice(3)}
            </span>,
          ];
        }
        if (line.startsWith("- ")) {
          return [
            <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: "19px", color: "var(--ink)" }}>
              <span className="dot" style={{ width: 4, height: 4, background: "var(--sage)", marginTop: 8 }} />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{line.slice(2)}</span>
            </div>,
          ];
        }
        return line.trim() === ""
          ? []
          : [
              <span key={index} style={{ display: "block", fontSize: 13, lineHeight: "19px", color: "var(--ink)", overflowWrap: "anywhere" }}>
                {line}
              </span>,
            ];
      })}
    </div>
  );
}

/** What a feed shows in place of its content while it loads or fails: bars the size of rows, or the error's own message. */
function FeedState({ feed }: { feed: SheetFeed<unknown> }) {
  if (feed.kind === "error") {
    return <span style={{ fontSize: 13, color: "var(--error)" }}>{feed.message}</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="sk" style={{ width: "100%", height: 12 }} />
      <span className="sk" style={{ width: "70%", height: 12 }} />
    </div>
  );
}

/** The summary of a feed's section: its own words once read, none while it loads, and `Unavailable` once it failed. */
function feedSummary<T>(feed: SheetFeed<T>, ready: (items: T[]) => string): string {
  if (feed.kind === "loading") {
    return "";
  }
  return feed.kind === "error" ? "Unavailable" : ready(feed.items);
}

/**
 * The agent's sheet: a glass card docked beside the graph with its name and lanes, what it is doing now, the helper
 * tasks it owns, and sections for its last calls, queued messages, schedule, charter and activity. It draws what it is
 * given; {@link AgentSheet} reads the data and holds the open sections.
 */
export function AgentSheetPanel({ agent, tasks, schedules, wakes, isOpen, onToggle, isTaskOpen, onToggleTask, onOpenThread, now }: AgentSheetPanelProps) {
  const status = agent.running.status;
  const waiting = agent.running.waiting_on;
  const lanes = [agent.running.work ? "Working" : null, agent.running.process ? "Processing" : null].filter((lane) => lane !== null);
  const active = tasks.filter(({ task }) => task.status === "working" || task.status === "asking" || task.status === "paused").length;
  const calls = status?.recent ?? [];
  const pending = status?.pending ?? [];
  const who = (id: string | null) => (id === null ? "Ankur" : id);
  return (
    <Card style={{ width: 400, flex: "none", background: "var(--glass-sheet)", boxShadow: "var(--shadow-deep)", minHeight: 0, animation: "slide-in 550ms var(--ease) both" }}>
      <div style={{ padding: "18px 18px 12px", display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <NameTruncate name={agent.name} style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {lanes.map((lane) => (
                <span key={lane} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 999, background: "var(--sage-active)", color: "var(--sage-text)", fontSize: 12.5, fontWeight: 600 }}>
                  <span className="dot dot-pulse" style={{ width: 6, height: 6, background: "var(--sage)" }} />
                  {lane}
                </span>
              ))}
              {lanes.length === 0 ? <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{waiting === null ? "Idle" : "Waiting"}</span> : null}
            </div>
          </div>
          <Button tone="fill" onClick={onOpenThread}>
            Open thread
          </Button>
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--sage-fill)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="ui-label" style={{ fontSize: 10.5 }}>
            Right now
          </span>
          {status === null ? (
            <span style={{ fontSize: 14, color: "var(--ink-muted)" }}>{workLine(agent, now)}</span>
          ) : (
            <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500 }}>{workLine(agent, now)}</span>
          )}
          {status?.step ? <Truncate text={status.step} className="ui-mono" /> : null}
          {status?.job ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink-muted)", lineHeight: "18px" }}>
              <Icon name="user" size={13} style={{ marginTop: 3 }} />
              <Clamp text={`${who(status.job.from)} asked at ${formatClock(status.job.at)}: ${status.job.content}`} lines={3} style={{ flex: 1, minWidth: 0 }} />
            </div>
          ) : null}
        </div>
        {tasks.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 4px 4px" }}>
              <span className="ui-label">Helper tasks</span>
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)", marginLeft: "auto" }}>{`${tasks.length} · ${active} active`}</span>
            </div>
            {tasks.map(({ task, question, preview }) => (
              <TaskRow key={task.id} task={task} owner={agent.name} question={question} open={isTaskOpen(task.id)} onToggle={() => onToggleTask(task.id)} now={now}>
                {preview}
              </TaskRow>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {calls.length > 0 ? (
            <Disclosure title="Last calls" summary={`${calls.length} · ${calls[calls.length - 1]!.name}`} open={isOpen("calls")} onToggle={() => onToggle("calls")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[...calls].reverse().map((call, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Truncate text={call.arg ? `${call.name} ${call.arg}` : call.name} className="ui-mono" style={{ flex: 1, minWidth: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: call.ok === false ? "var(--error)" : "var(--ink-muted)" }}>{call.ok === null ? "running" : call.ok ? "ok" : "error"}</span>
                  </div>
                ))}
              </div>
            </Disclosure>
          ) : null}
          {pending.length > 0 ? (
            <Disclosure title="Queued to send" summary={String(pending.length)} open={isOpen("queued")} onToggle={() => onToggle("queued")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pending.map((message) => (
                  <Clamp key={message.id} text={`To ${who(message.to)}${message.expects_reply ? " (expects a reply)" : ""}: ${message.preview}`} lines={2} style={{ fontSize: 13, color: "var(--ink-muted)" }} />
                ))}
              </div>
            </Disclosure>
          ) : null}
          <Disclosure title="Scheduled" summary={feedSummary(schedules, (items) => (items.length > 0 ? String(items.length) : "None"))} open={isOpen("scheduled")} onToggle={() => onToggle("scheduled")}>
            {schedules.kind !== "ready" ? (
              <FeedState feed={schedules} />
            ) : schedules.items.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Nothing scheduled.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {schedules.items.map((schedule) => (
                  <div key={schedule.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Clamp text={schedule.content} lines={2} style={{ flex: 1, minWidth: 0, fontSize: 13 }} />
                    <span style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{`${formatDay(schedule.run_at)}, ${formatClock(schedule.run_at)}`}</span>
                  </div>
                ))}
              </div>
            )}
          </Disclosure>
          <Disclosure
            title="Charter"
            summary={`~${kilo(Math.round(agent.system_prompt.length / CHARS_PER_TOKEN))} tokens · ${kilo(agent.system_prompt.length)} chars`}
            open={isOpen("charter")}
            onToggle={() => onToggle("charter")}
          >
            <CharterText source={agent.system_prompt} />
          </Disclosure>
          <Disclosure title="Activity" summary={feedSummary(wakes, (items) => (items.length > 0 ? `${items.length} wakes` : "None"))} open={isOpen("activity")} onToggle={() => onToggle("activity")}>
            {wakes.kind !== "ready" ? (
              <FeedState feed={wakes} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {wakes.items.slice(0, 4).map((wake) => (
                  <div key={wake.at} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 11px", borderRadius: 11, background: "var(--sage-fill)" }}>
                    <div style={{ display: "flex", alignItems: "center", fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{`${formatDay(wake.at)}, ${formatClock(wake.at)}`}</span>
                      <span style={{ marginLeft: "auto", color: "var(--ink-muted)" }}>{`${wake.tools} ${wake.tools === 1 ? "tool" : "tools"}`}</span>
                    </div>
                    <Clamp text={wake.text || "No message"} lines={2} style={{ fontSize: 12.5, color: "var(--ink-muted)" }} />
                  </div>
                ))}
              </div>
            )}
          </Disclosure>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-muted)", padding: "4px 4px 0" }}>
          <span>{`Parent ${agent.parent_agent_id ?? "none"}`}</span>
          <span>{`Created ${formatDay(agent.created_at)}`}</span>
          <span>{`Active ${formatRelative(agent.updated_at, now)}`}</span>
        </div>
      </div>
    </Card>
  );
}
