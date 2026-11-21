import type { AgentRecord, AgentTask, RoutineList } from "../../../types/hath";
import { formatClock, formatDay } from "../../../shared/lib/ux/time";
import { briefOf, type Standing } from "./brief";
import { activeRoutines } from "./routines";

/** One labelled fact of the agent popover's facts block. */
export type Fact = {
  label: string;
  value: string;
  /** The value is this agent's name, drawn as a link that opens it. */
  agentId?: string;
  /** A quiet second fact after the value. */
  hint?: string;
  tone?: "late";
  /** The value is words (a task) and may take two lines. */
  wrap?: boolean;
  /** A message: a stacked value that may take four lines. */
  long?: boolean;
};

/** How long, in the fewest honest words: `under a minute`, `4 min`, `2 h 10 min`, `3 d`. */
export function duration(ms: number): string {
  const minutes = Math.floor(Math.abs(ms) / 60_000);
  if (minutes < 1) {
    return "under a minute";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return hours < 3 && rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
  }
  return `${Math.floor(hours / 24)} d`;
}

/** `4 min ago` or `in 4 min` for an instant against `now`; `just now` inside a minute. */
export function relative(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (Math.abs(ms) < 60_000) {
    return "just now";
  }
  return ms < 0 ? `${duration(ms)} ago` : `in ${duration(ms)}`;
}

/** The clock time of an instant, with the day when it is not today. */
function clockOf(iso: string, now: number): string {
  const same = new Date(iso).toDateString() === new Date(now).toDateString();
  return same ? formatClock(iso) : `${formatDay(iso)}, ${formatClock(iso)}`;
}

/** What a wait names in words: an agent by name, a helper task by its kind (`a terminal helper`), never an address; the Helper tasks card says what each is for. */
export function targetWords(target: string, tasks: AgentTask[], nameOf: (id: string | null) => string): string {
  if (!target.startsWith("task/")) {
    return nameOf(target);
  }
  const kind = tasks.find((task) => task.id === target)?.kind ?? (target.startsWith("task/terminal/") ? "terminal" : "browser");
  return `a ${kind} helper`;
}

/** The one situation line of the popover: what is true of the agent now, in its tone. */
export type AgentSituation = { tone: "live" | "wait" | "late" | "rest"; text: string };

/**
 * The agent's situation in one line, the most pressing first: it needs Ankur's answer, it is blocked, it was stopped, its answer
 * is overdue, it works (with how long), it waits (with how long), or it is idle (with how long).
 */
export function situationOf(agent: Pick<AgentRecord, "id" | "running" | "updated_at">, standing: Standing | null, now: number): AgentSituation {
  if (standing !== null) {
    return standing.status === "blocked" ? { tone: "late", text: "Blocked" } : { tone: "wait", text: "Needs your input" };
  }
  const brief = briefOf(agent, now);
  const { job, waiting_on: waiting } = agent.running;
  if (brief.tone === "stopped") {
    return { tone: "late", text: `Stopped ${relative(job!.stopped!.at, now)}` };
  }
  if (brief.answerBy?.overdue === true) {
    return { tone: "late", text: brief.answerBy.label };
  }
  if (brief.tone === "working") {
    return { tone: "live", text: job === null ? "Working" : `Working · ${duration(now - Date.parse(job.opened.at))}` };
  }
  if (brief.tone === "waiting" && waiting !== null) {
    return { tone: "wait", text: "Waiting" };
  }
  return { tone: "rest", text: "Idle" };
}

/** The helper tasks as one fact: only the counts that are true, working first. Null when the agent has none. */
function helperWords(tasks: AgentTask[]): string | null {
  const working = tasks.filter((task) => task.status === "working" || task.status === "paused").length;
  const asking = tasks.filter((task) => task.status === "asking").length;
  const resting = tasks.length - working - asking;
  const parts = [working > 0 ? `${working} working` : null, asking > 0 ? `${asking} asking it` : null, resting > 0 ? `${resting} resting` : null].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** The routines and reminders as one fact: how many, and when the next routine runs. Null when there are none. */
function routinesFact(list: RoutineList, now: number): Fact | null {
  const routines = activeRoutines(list.routines);
  const next = [...routines].sort((a, b) => Date.parse(a.next_run_at) - Date.parse(b.next_run_at))[0];
  const parts = [routines.length > 0 ? `${routines.length} ${routines.length === 1 ? "routine" : "routines"}` : null, list.reminders.length > 0 ? `${list.reminders.length} ${list.reminders.length === 1 ? "reminder" : "reminders"}` : null].filter((part) => part !== null);
  if (parts.length === 0) {
    return null;
  }
  return { label: "Routines", value: parts.join(" · "), ...(next === undefined ? {} : { hint: `next ${clockOf(next.next_run_at, now)}` }) };
}

/** What the popover's facts block says of the agent. */
export type FactInput = {
  agent: Pick<AgentRecord, "id" | "running" | "updated_at" | "sessions">;
  /** The agent's parent, when it has one the page knows: the "Reports to" fact. */
  parent?: Pick<AgentRecord, "id" | "name"> | null;
  /** Its routines and reminders, once read: the "Routines" fact. */
  routines?: RoutineList;
  /** What the agent's newest message to Ankur leaves open: the first fact, in the agent's own words. */
  standing?: Standing | null;
  /** The counts of the wake running now, when one does. */
  counts: { tool_calls: number; messages_sent: number } | undefined;
  nameOf: (id: string | null) => string;
  now: number;
};

/**
 * The agent's facts: each a label and a value that states something true, in the order the popovers keep. Nothing is
 * listed because hath returned it: no ids, no empty rows, a count only when the agent did that much.
 */
export function agentFacts({ agent, counts, nameOf, now, parent = null, routines, standing = null }: FactInput): Fact[] {
  const brief = briefOf(agent, now);
  const { job, waiting_on: waiting } = agent.running;
  const facts: Fact[] = [];
  if (standing !== null) {
    facts.push({ label: standing.status === "blocked" ? "Stuck on" : "Asked you", value: standing.content.replace(/\s+/g, " ").trim(), hint: relative(standing.at, now), wrap: true, long: true });
  }
  if (job !== null && brief.ask !== null) {
    const routine = brief.ask.routine;
    facts.push({ label: routine ? "Started by" : "Asked by", value: routine ? "Its own routine" : brief.ask.who === "You" ? "You" : nameOf(job.requester), hint: relative(job.opened.at, now) });
    facts.push({ label: routine ? "Procedure" : "Task", value: brief.ask.text.replace(/\s+/g, " ").trim(), wrap: true });
  }
  if (brief.answerBy !== null) {
    const overdue = brief.answerBy.overdue;
    facts.push({ label: overdue ? "Answer was due" : "Answer due", value: relative(job!.answer_by!, now), hint: clockOf(job!.answer_by!, now), ...(overdue ? { tone: "late" as const } : {}) });
  }
  if (brief.tone === "working" && counts !== undefined && (counts.tool_calls > 0 || counts.messages_sent > 0)) {
    const parts = [counts.tool_calls > 0 ? `${counts.tool_calls} tool ${counts.tool_calls === 1 ? "call" : "calls"}` : null, counts.messages_sent > 0 ? `${counts.messages_sent} ${counts.messages_sent === 1 ? "message" : "messages"} sent` : null].filter((part) => part !== null);
    facts.push({ label: "So far", value: parts.join(" · ") });
  }
  if (brief.tone === "waiting" && waiting !== null) {
    facts.push({ label: "Waiting on", value: waiting.targets.map((target) => targetWords(target, agent.sessions.tasks, nameOf)).join(", "), hint: `for ${duration(now - Date.parse(waiting.since))}`, wrap: true });
  }
  if (brief.tone === "stopped" && job?.stopped != null) {
    facts.push({ label: "Stopped", value: `by ${job.stopped.by === "ankur" ? "you" : nameOf(job.stopped.by)}`, hint: relative(job.stopped.at, now) });
  }
  for (const ask of brief.asked) {
    facts.push({ label: `Asked ${nameOf(ask.to)}`, value: ask.replied ? "Replied" : "No reply yet" });
  }
  if (brief.told.length > 0) {
    facts.push({ label: brief.ask?.routine === true ? "Sent" : "Told you", value: brief.told[brief.told.length - 1]!.replace(/\s+/g, " ").trim(), hint: brief.told.length > 1 ? `${brief.told.length} messages` : undefined, wrap: true });
  }
  if (brief.stored.length > 0) {
    facts.push({ label: "Saved to memory", value: brief.stored.join(", "), wrap: true });
  }
  if (brief.checkBacks.length > 0) {
    facts.push({ label: "Checks back", value: relative(brief.checkBacks[0]!, now), hint: clockOf(brief.checkBacks[0]!, now) });
  }
  if (parent !== null) {
    facts.push({ label: "Reports to", value: parent.name, agentId: parent.id });
  }
  const helpers = helperWords(agent.sessions.tasks);
  if (helpers !== null) {
    facts.push({ label: "Helpers", value: helpers });
  }
  const routinesWords = routines === undefined ? null : routinesFact(routines, now);
  if (routinesWords !== null) {
    facts.push(routinesWords);
  }
  facts.push({ label: "Last active", value: relative(agent.updated_at, now) });
  return facts;
}
