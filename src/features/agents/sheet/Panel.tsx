import { useRef, type ReactNode } from "react";
import type { AgentRecord, AgentTask, PatchScheduleRequest, ScheduledMessage } from "../../../types/hath";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Disclosure } from "../../../shared/ui/Disclosure";
import { Icon } from "../../../shared/ui/Icon";
import { ChipRow, KeyValue, SectionHeader, SheetHeader, StatusChip, TileList, TileRow } from "../../../shared/components/Module";
import { TaskRow } from "../../../shared/components/Task/TaskRow";
import { AnimatePresence, motion } from "motion/react";
import { AgentName } from "../../../shared/ui/AgentName";
import { REVEAL, RISE } from "../../../shared/motion";
import { Clamp, Truncate } from "../../../shared/ui/Truncate";
import { formatClock, formatDay, formatRelative } from "../../../shared/lib/ux/time";
import type { ActivityWake } from "./activity";
import { ActivityFeed } from "./ActivityFeed";
import { ScheduleRow } from "./ScheduleRow";
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
  wakes: SheetFeed<ActivityWake>;
  /** Saves a schedule's changes; rejects with Hath's reason. */
  onSaveSchedule: (id: string, changes: PatchScheduleRequest) => Promise<void>;
  /** Cancels a schedule; rejects with Hath's reason. */
  onCancelSchedule: (id: string) => Promise<void>;
  /** The agent's parent when it is one of the agents on the page; its name is a link. */
  parent: AgentRecord | null;
  /** Selects the parent agent. */
  onSelectParent: (id: string) => void;
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
    <div data-selectable className="flex flex-col gap-0.5">
      {source.split("\n").flatMap((line, index) => {
        if (line.startsWith("## ")) {
          return [
            <span key={index} className="mt-3 mb-1 block text-[13px] font-semibold">
              {line.slice(3)}
            </span>,
          ];
        }
        if (line.startsWith("- ")) {
          return [
            <div key={index} className="flex items-start gap-2 text-[13px] leading-[20px] text-ink">
              <span className="dot mt-2 size-1 bg-sage" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{line.slice(2)}</span>
            </div>,
          ];
        }
        return line.trim() === "" ? [] : [<span key={index} className="block text-[13px] leading-[20px] [overflow-wrap:anywhere] text-ink">{line}</span>];
      })}
    </div>
  );
}

/** What a feed shows in place of its content while it loads or fails: bars the size of rows, or the error's own message. */
function FeedState({ feed }: { feed: SheetFeed<unknown> }) {
  if (feed.kind === "error") {
    return <span data-selectable className="text-[13px] text-error">{feed.message}</span>;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="sk h-3 w-full" />
      <span className="sk h-3 w-[70%]" />
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
export function AgentSheetPanel({ agent, tasks, schedules, wakes, onSaveSchedule, onCancelSchedule, parent, onSelectParent, isOpen, onToggle, isTaskOpen, onToggleTask, onOpenThread, now }: AgentSheetPanelProps) {
  const status = agent.running.status;
  const waiting = agent.running.waiting_on;
  const lanes = [agent.running.work ? "Working" : null, agent.running.process ? "Processing" : null].filter((lane) => lane !== null);
  const active = tasks.filter(({ task }) => task.status === "working" || task.status === "asking" || task.status === "paused").length;
  const calls = status?.recent ?? [];
  const pending = status?.pending ?? [];
  const who = (id: string | null) => (id === null ? "Ankur" : id);
  const scroll = useRef<HTMLDivElement>(null);
  return (
    <Card className="min-h-0 w-[400px] flex-none bg-glass-sheet shadow-deep">
      <SheetHeader
        name={<AgentName name={agent.name} className="text-[20px] font-semibold tracking-[-0.015em]" />}
        status={
          <ChipRow wrap>
            {lanes.map((lane) => (
              <StatusChip key={lane} pulse>
                {lane}
              </StatusChip>
            ))}
            {lanes.length === 0 ? (
              <StatusChip key="idle" tone="quiet">
                {waiting === null ? "Idle" : "Waiting"}
              </StatusChip>
            ) : null}
          </ChipRow>
        }
        action={
          <Button tone="fill" onClick={onOpenThread}>
            Open thread
          </Button>
        }
      />
      <div ref={scroll} className="scroll flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        <div className="flex flex-col gap-2 rounded-[14px] bg-sage-fill px-4 py-3">
          <SectionHeader title="Right now" />
          <span data-selectable className={status === null ? "text-[14px] text-ink-muted" : "text-[14px] leading-5 font-medium"}>
            {workLine(agent, now)}
          </span>
          {status?.step ? <Truncate text={status.step} className="ui-mono" /> : null}
          {status?.job ? (
            <div className="flex items-start gap-2 text-[13px] leading-[20px] text-ink-muted">
              <span className="mt-1 flex"><Icon name="user" size={13} /></span>
              <span data-selectable className="min-w-0 flex-1">
                <Clamp text={`${who(status.job.from)} asked at ${formatClock(status.job.at)}: ${status.job.content}`} lines={3} />
              </span>
            </div>
          ) : null}
        </div>
        <AnimatePresence initial={false}>
          {tasks.length > 0 ? (
            <motion.div key="tasks" {...REVEAL} className="overflow-hidden">
              <div className="flex flex-col gap-0.5">
                <SectionHeader title="Helper tasks" count={`${tasks.length} · ${active} active`} />
                {tasks.map(({ task, question, preview }) => (
                  <TaskRow key={task.id} task={task} owner={agent.name} question={question} open={isTaskOpen(task.id)} onToggle={() => onToggleTask(task.id)} now={now}>
                    {preview}
                  </TaskRow>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="flex flex-col">
          {calls.length > 0 ? (
            <Disclosure title="Last calls" summary={`${calls.length} · ${calls[calls.length - 1]!.name}`} open={isOpen("calls")} onToggle={() => onToggle("calls")}>
              <TileList>
                {[...calls].reverse().map((call, index) => (
                  <TileRow key={index} size="sm" ruled={false} trail={<span className={`flex-none text-[12px] font-semibold ${call.ok === false ? "text-error" : "text-ink-muted"}`}>{call.ok === null ? "running" : call.ok ? "ok" : "error"}</span>}>
                    <span data-selectable>
                      <Truncate text={call.arg ? `${call.name} ${call.arg}` : call.name} className="ui-mono" />
                    </span>
                  </TileRow>
                ))}
              </TileList>
            </Disclosure>
          ) : null}
          {pending.length > 0 ? (
            <Disclosure title="Queued to send" summary={String(pending.length)} open={isOpen("queued")} onToggle={() => onToggle("queued")}>
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {pending.map((message) => (
                    <motion.span key={message.id} {...RISE} layout="position" data-selectable className="text-[13px] text-ink-muted">
                      <Clamp text={`To ${who(message.to)}${message.expects_reply ? " (expects a reply)" : ""}: ${message.preview}`} lines={2} />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </Disclosure>
          ) : null}
          <Disclosure title="Scheduled" summary={feedSummary(schedules, (items) => (items.length > 0 ? String(items.length) : "None"))} open={isOpen("scheduled")} onToggle={() => onToggle("scheduled")}>
            {schedules.kind !== "ready" ? (
              <FeedState feed={schedules} />
            ) : schedules.items.length === 0 ? (
              <span className="text-[13px] text-ink-muted">Nothing scheduled.</span>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {schedules.items.map((schedule, index) => (
                    <motion.div key={schedule.id} {...RISE} layout="position">
                      <ScheduleRow schedule={schedule} agentId={agent.id} position={index + 1} onSave={onSaveSchedule} onCancel={onCancelSchedule} />
                    </motion.div>
                  ))}
                </AnimatePresence>
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
              <ActivityFeed wakes={wakes.items} running={agent.running} scrollRef={scroll} now={now} />
            )}
          </Disclosure>
        </div>
        <div className="flex flex-col px-1 pt-1">
          <KeyValue label="Parent" selectable={parent === null}>
            {parent === null ? (
              (agent.parent_agent_id ?? "none")
            ) : (
              <button type="button" className="ui-trans ui-hover-fill -mx-1 inline rounded-[6px] px-1 font-semibold text-sage-text" title={`Show ${parent.name}`} onClick={() => onSelectParent(parent.id)}>
                {parent.name}
              </button>
            )}
          </KeyValue>
          <KeyValue label="Created">{formatDay(agent.created_at)}</KeyValue>
          <KeyValue label="Active">{formatRelative(agent.updated_at, now)}</KeyValue>
        </div>
      </div>
    </Card>
  );
}
