import { useState } from "react";
import type { AgentRecord, Reminder, Routine } from "../../../types/hath";
import { Button, IconButton } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Disclosure } from "../../../shared/ui/Disclosure";
import { AnimatePresence, motion } from "motion/react";
import { AgentName } from "../../../shared/ui/AgentName";
import { RISE } from "../../../shared/motion";
import { countNoun } from "../../../shared/lib/ux/plural";
import { formatRelative } from "../../../shared/lib/ux/time";
import type { LiveWake } from "../../../contexts/running";
import { About } from "./About";
import { Activity } from "./Activity";
import { HelperTasks, type SheetTask } from "./HelperTasks";
import { briefOf, stateSince, stateWord, type Standing } from "./brief";
import { NowCard, type StopState } from "./NowCard";
import { RoutineRow } from "./RoutineRow";
import { activeRoutines } from "./routines";
import { StandingCard } from "./StandingCard";

/** What a section that is read on its own can be showing. */
export type SheetFeed<T> = { kind: "ready"; items: T } | { kind: "loading" } | { kind: "error"; message: string };

export type { StopState };

export type AgentSheetPanelProps = {
  agent: AgentRecord;
  /** What the agent's newest message to Ankur leaves open (`needs_input`, `blocked`), or null. */
  standing: Standing | null;
  /** The counts of the wake running now. */
  live: LiveWake | undefined;
  stop: StopState;
  /** Stops the agent's run and job; hath halts the job's helper tasks. */
  onStop: () => void;
  /** The agent's helper tasks, with the status Nas reports now; an `asking` one is waiting on this agent. */
  tasks: SheetTask[];
  /** Halts a helper task by its address; rejects with Hath's reason. */
  onHaltTask: (taskId: string) => Promise<void>;
  /** The agent's routines and reminders. */
  routines: SheetFeed<{ routines: Routine[]; reminders: Reminder[] }>;
  /** Cancels a routine or a reminder; reject with Hath's reason. */
  onCancelRoutine: (id: string) => Promise<void>;
  onCancelReminder: (id: string) => Promise<void>;
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

/** The summary of the routines section: what it holds once read, none while it loads, and `Unavailable` once it failed. */
function routinesSummary(feed: SheetFeed<{ routines: Routine[]; reminders: Reminder[] }>): string {
  if (feed.kind === "loading") {
    return "";
  }
  if (feed.kind === "error") {
    return "Unavailable";
  }
  const routines = activeRoutines(feed.items.routines).length;
  const reminders = feed.items.reminders.length;
  const parts = [routines > 0 ? `${routines} ${countNoun(routines, "routine")}` : null, reminders > 0 ? `${reminders} ${countNoun(reminders, "reminder")}` : null].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "None";
}

/**
 * The agent's popover content: its name and one summary line, what it is doing now (the job ledger), a card when its newest
 * message waits on Ankur, its helper tasks (with Stop), the wake timeline, its routines and reminders, and what it is. It draws what
 * it is given; {@link AgentSheet} reads the agent, routines and tasks, and the timeline reads its own wakes.
 */
export function AgentSheetPanel({ agent, standing, live, stop, onStop, tasks, onHaltTask, routines, onCancelRoutine, onCancelReminder, parent, onSelectAgent, nameOf, connected, onOpenThread, onClose, now }: AgentSheetPanelProps) {
  const [routinesOpen, setRoutinesOpen] = useState(true);
  const brief = briefOf(agent, now);
  const working = brief.tone === "working";
  const orb = working ? "bg-sage" : brief.tone === "waiting" ? "bg-tide" : brief.tone === "stopped" ? "bg-[var(--late-ink)]" : "bg-ink-ghost";
  const summary = [
    stateWord(brief, agent.running.waiting_on),
    formatRelative(stateSince(agent, brief), now),
    tasks.length > 0 ? `${tasks.length} helper ${tasks.length === 1 ? "task" : "tasks"}` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const names = routines.kind === "ready" ? routines.items : { routines: [], reminders: [] };
  return (
    <Card className="min-h-0 w-full flex-1" style={{ border: "none", background: "transparent", boxShadow: "none", borderRadius: 0 }}>
      <header className="flex flex-none flex-col gap-3.5 px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <span className="relative mt-[9px] flex size-2.5 flex-none">
            {working ? <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${orb}`} /> : null}
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
        {standing === null ? null : <StandingCard standing={standing} agentName={agent.name} onOpenThread={onOpenThread} now={now} />}
        <NowCard agent={agent} brief={brief} live={live} stop={stop} onStop={onStop} />
        <HelperTasks owner={agent.name} tasks={tasks} onHalt={onHaltTask} now={now} />
        <Activity agentId={agent.id} connected={connected} nameOf={nameOf} schedules={names} onSelectAgent={onSelectAgent} now={now} />
        <Disclosure title="Routines & reminders" summary={routinesSummary(routines)} open={routinesOpen} onToggle={() => setRoutinesOpen(!routinesOpen)}>
          {routines.kind !== "ready" ? (
            <FeedState feed={routines} />
          ) : (
            <div className="flex flex-col gap-2">
              {activeRoutines(routines.items.routines).length === 0 && routines.items.reminders.length === 0 ? <span className="text-[13px] text-ink-muted">No routines or reminders.</span> : null}
              <AnimatePresence initial={false}>
                {activeRoutines(routines.items.routines).map((routine) => (
                  <motion.div key={routine.id} {...RISE} layout="position">
                    <RoutineRow item={{ kind: "routine", routine }} onCancel={onCancelRoutine} now={now} />
                  </motion.div>
                ))}
                {routines.items.reminders.map((reminder) => (
                  <motion.div key={reminder.id} {...RISE} layout="position">
                    <RoutineRow item={{ kind: "reminder", reminder }} onCancel={onCancelReminder} now={now} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12.5px] text-ink-muted">The agent owns its routines. To change or add one, message it.</span>
                <Button tone="sage" size="sm" onClick={onOpenThread}>
                  Message agent
                </Button>
              </div>
            </div>
          )}
        </Disclosure>
        <About agent={agent} parent={parent} onSelectParent={onSelectAgent} now={now} />
      </div>
    </Card>
  );
}
