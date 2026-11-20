import { useState } from "react";
import type { AgentRecord, Reminder, Routine } from "../../../types/hath";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { AnimatePresence, motion } from "motion/react";
import { AgentName } from "../../../shared/ui/AgentName";
import { Clamp } from "../../../shared/ui/Truncate";
import { RISE } from "../../../shared/motion";
import { countNoun } from "../../../shared/lib/ux/plural";
import { InsetCard, KeyValue, PopoverActions, PopoverBody, PopoverFacts, PopoverHeader, Situation } from "../../../shared/components/Module";
import type { LiveWake } from "../../../contexts/running";
import { About } from "./About";
import { AgentLink } from "./AgentLink";
import { Activity } from "./Activity";
import { HelperTasks, type SheetTask } from "./HelperTasks";
import type { Standing } from "./brief";
import { agentFacts, situationOf } from "./facts";
import { RoutineRow } from "./RoutineRow";
import { activeRoutines } from "./routines";
import { StopButton, StopConfirm, type StopState } from "./StopRow";

/** What a section that is read on its own can be showing. */
export type SheetFeed<T> = { kind: "ready"; items: T } | { kind: "loading" } | { kind: "error"; message: string };

export type { StopState };

export type AgentSheetPanelProps = {
  agent: AgentRecord;
  /** What the agent's newest message to Ankur leaves open (`needs_input`, `blocked`), or null. */
  standing: Standing | null;
  /** The counts of the wake running now. */
  live: LiveWake | undefined;
  /** When the agent last sent Ankur a message, or null if it never has. */
  lastAnswered: string | null;
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

/** The summary of the routines section: what it holds once read, none while it loads. */
function routinesCount(feed: SheetFeed<{ routines: Routine[]; reminders: Reminder[] }>): string | undefined {
  if (feed.kind !== "ready") {
    return undefined;
  }
  const routines = activeRoutines(feed.items.routines).length;
  const reminders = feed.items.reminders.length;
  return [routines > 0 ? `${routines} ${countNoun(routines, "routine")}` : null, reminders > 0 ? `${reminders} ${countNoun(reminders, "reminder")}` : null].filter((part) => part !== null).join(" · ");
}

/**
 * The agent's popover, on the one anatomy every popover keeps: its name over one situation chip; the facts block (what it was
 * asked, when the answer is due, who it asked, what it told and saved, when it checks back); the actions row (Open thread, Stop);
 * then inset sections: what the thread waits on, helper tasks, wakes, routines and reminders, and what the agent is. It draws what
 * it is given; {@link AgentSheet} reads the agent, routines and tasks, and the timeline reads its own wakes.
 */
export function AgentSheetPanel({ agent, standing, live, lastAnswered, stop, onStop, tasks, onHaltTask, routines, onCancelRoutine, onCancelReminder, parent, onSelectAgent, nameOf, connected, onOpenThread, onClose, now }: AgentSheetPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const situation = situationOf(agent, standing, now);
  const facts = agentFacts({ agent, counts: live?.counts, nameOf, now, parent, routines: routines.kind === "ready" ? routines.items : undefined, lastAnswered });
  const { job, working } = agent.running;
  const stoppable = working || (job !== null && job.stopped === null);
  const names = routines.kind === "ready" ? routines.items : { routines: [], reminders: [] };
  const hasRoutines = routines.kind !== "ready" || activeRoutines(routines.items.routines).length > 0 || routines.items.reminders.length > 0;
  return (
    <Card className="min-h-0 w-full flex-1" style={{ border: "none", background: "transparent", boxShadow: "none", borderRadius: 0 }}>
      <PopoverHeader title={<AgentName name={agent.name} />} situation={<Situation tone={situation.tone}>{situation.text}</Situation>} onClose={onClose} />
      <PopoverBody>
        {facts.length === 0 ? null : (
          <PopoverFacts>
            {facts.map((fact) => (
              <KeyValue key={fact.label} label={fact.label} hint={fact.hint} tone={fact.tone} wrap={fact.wrap} selectable>
                {fact.agentId === undefined ? fact.value : <AgentLink agentId={fact.agentId} name={fact.value} onSelect={onSelectAgent} />}
              </KeyValue>
            ))}
          </PopoverFacts>
        )}
        <PopoverActions below={<StopConfirm stop={stop} confirming={confirming} setConfirming={setConfirming} onStop={onStop} />}>
          <Button tone={standing === null ? "sage" : "fill"} onClick={onOpenThread}>
            {standing === null ? "Open thread" : "Reply"}
          </Button>
          <StopButton agentId={agent.id} stop={stop} stoppable={stoppable} confirming={confirming} setConfirming={setConfirming} />
        </PopoverActions>
        {standing === null ? null : (
          <InsetCard title={standing.status === "blocked" ? "Where it is stuck" : "Waiting for your answer"}>
            <span data-selectable className="text-[13.5px] leading-[19px]">
              <Clamp text={standing.content} lines={5} />
            </span>
          </InsetCard>
        )}
        <HelperTasks owner={agent.name} tasks={tasks} onHalt={onHaltTask} now={now} />
        <Activity agentId={agent.id} connected={connected} nameOf={nameOf} schedules={names} onSelectAgent={onSelectAgent} now={now} />
        {hasRoutines ? (
          <InsetCard title="Routines & reminders" count={routinesCount(routines)}>
            {routines.kind !== "ready" ? (
              <FeedState feed={routines} />
            ) : (
              <div className="flex flex-col gap-2 pt-1">
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
                <span className="text-[12.5px] text-ink-muted">
                  To change or add one,{" "}
                  <button type="button" className="ui-trans font-semibold text-sage-text hover:underline" onClick={onOpenThread}>
                    message the agent
                  </button>
                  .
                </span>
              </div>
            )}
          </InsetCard>
        ) : null}
        <About agent={agent} />
      </PopoverBody>
    </Card>
  );
}
