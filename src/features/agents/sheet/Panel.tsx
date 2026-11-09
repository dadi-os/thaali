import { useState } from "react";
import type { AgentRecord, PatchScheduleRequest, ScheduledMessage } from "../../../types/hath";
import { Button, IconButton } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Disclosure } from "../../../shared/ui/Disclosure";
import { AnimatePresence, motion } from "motion/react";
import { AgentName } from "../../../shared/ui/AgentName";
import { RISE } from "../../../shared/motion";
import { formatRelative } from "../../../shared/lib/ux/time";
import { About } from "./About";
import { Activity } from "./Activity";
import { HelperTasks, type SheetTask } from "./HelperTasks";
import { ScheduleRow } from "./ScheduleRow";
import { StateStrip } from "./StateStrip";

/** What a section that is read on its own can be showing. */
export type SheetFeed<T> = { kind: "ready"; items: T[] } | { kind: "loading" } | { kind: "error"; message: string };

export type AgentSheetPanelProps = {
  agent: AgentRecord;
  /** Messages from the agent Ankur has not read. */
  unread: number;
  /** The agent's helper tasks, with the status Nas reports now; an `asking` one is waiting on this agent. */
  tasks: SheetTask[];
  /** Halts a helper task by its address; rejects with Hath's reason. */
  onHaltTask: (taskId: string) => Promise<void>;
  schedules: SheetFeed<ScheduledMessage>;
  /** Saves a schedule's changes; rejects with Hath's reason. */
  onSaveSchedule: (id: string, changes: PatchScheduleRequest) => Promise<void>;
  /** Cancels a schedule; rejects with Hath's reason. */
  onCancelSchedule: (id: string) => Promise<void>;
  /** The agent's parent when it is one of the agents on the page; its name is a link. */
  parent: AgentRecord | null;
  /** Selects another agent: the parent, or one a wake's reason names. */
  onSelectAgent: (id: string) => void;
  /** An agent's display name by id; null is Ankur. */
  nameOf: (id: string | null) => string;
  /** Whether Hath can be reached; the wakes are not read while it cannot. */
  connected: boolean;
  /** Opens the agent's chat in the rail. */
  onOpenThread: () => void;
  /** Closes the card it sits in; no close control is drawn without it. */
  onClose?: () => void;
  /** The time the sheet's relative words are measured from. */
  now: number;
};

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

/** The summary of the schedules section: its count once read, none while it loads, and `Unavailable` once it failed. */
function scheduleSummary(feed: SheetFeed<ScheduledMessage>): string {
  if (feed.kind === "loading") {
    return "";
  }
  if (feed.kind === "error") {
    return "Unavailable";
  }
  return feed.items.length > 0 ? String(feed.items.length) : "None";
}

/**
 * The agent's popover content: its name and one summary line over what is true of it now, its helper tasks (with Stop), the
 * wake timeline, its schedules and what it is. It draws what it is given; {@link AgentSheet} reads the agent, schedules and
 * tasks, and the timeline reads its own wakes.
 */
export function AgentSheetPanel({ agent, unread, tasks, onHaltTask, schedules, onSaveSchedule, onCancelSchedule, parent, onSelectAgent, nameOf, connected, onOpenThread, onClose, now }: AgentSheetPanelProps) {
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const { work, process, waiting_on: waiting } = agent.running;
  const lanes = [work ? "Working" : null, process ? "Processing" : null].filter((lane) => lane !== null);
  const live = lanes.length > 0;
  const orb = work ? "bg-sage" : process ? "bg-tide" : "bg-ink-ghost";
  const summary = [
    live ? lanes.join(" + ") : waiting === null ? "Idle" : "Waiting on a task",
    tasks.length > 0 ? `${tasks.length} helper ${tasks.length === 1 ? "task" : "tasks"}` : null,
    formatRelative(agent.updated_at, now),
  ]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <Card className="min-h-0 w-full flex-1" style={{ border: "none", background: "transparent", boxShadow: "none", borderRadius: 0 }}>
      <header className="flex flex-none flex-col gap-3.5 px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <span className="relative mt-[9px] flex size-2.5 flex-none">
            {live ? <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${orb}`} /> : null}
            <span className={`relative size-2.5 rounded-full ${orb}`} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <AgentName name={agent.name} className="text-[19px] leading-7 font-semibold tracking-[-0.015em]" />
            <span className="truncate text-[13px] text-ink-muted" title={summary}>
              {summary}
            </span>
          </div>
          {onClose ? <IconButton icon="close" label="Close" onClick={onClose} /> : null}
        </div>
        <Button tone="fill" onClick={onOpenThread} style={{ width: "100%" }}>
          Open thread
        </Button>
      </header>
      <div className="scroll flex min-h-0 flex-1 flex-col gap-4 border-t border-rule px-5 pt-4 pb-6">
        <StateStrip agent={agent} unread={unread} />
        <HelperTasks owner={agent.name} tasks={tasks} onHalt={onHaltTask} now={now} />
        <Activity agentId={agent.id} connected={connected} nameOf={nameOf} onSelectAgent={onSelectAgent} now={now} />
        <Disclosure title="Schedules" summary={scheduleSummary(schedules)} open={schedulesOpen} onToggle={() => setSchedulesOpen(!schedulesOpen)}>
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
        <About agent={agent} parent={parent} onSelectParent={onSelectAgent} now={now} />
      </div>
    </Card>
  );
}
