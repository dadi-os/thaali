import type { AgentRecord, DurableMessage, JobLedger, MessageStatus, WakeDetail } from "../../../types/hath";
import { formatClock, formatRelative, formatSpan } from "../../../shared/lib/ux/time";

/** The one word the sheet's top reads as. */
export type BriefTone = "working" | "waiting" | "idle" | "stopped";

/** Where the answer stands against its due time. */
export type AnswerBy = { overdue: boolean; label: string };

/** Who gave the agent the job, as the sheet words it. */
export type BriefAsk = {
  /** `You`, an agent id, or `Routine` when the agent started the run itself. */
  who: string;
  at: string;
  text: string;
  routine: boolean;
};

/** The job ledger as the sheet's top card reads it: one headline, the ask, the clock, and what the agent has done for it. */
export type Brief = {
  tone: BriefTone;
  /** What the agent is doing now, in one sentence. */
  headline: string;
  ask: BriefAsk | null;
  /** Null once the requester has been told, and for jobs that carry no answer time. */
  answerBy: AnswerBy | null;
  /** The agents it asked, and whether each has answered. */
  asked: { to: string; replied: boolean }[];
  /** The helper tasks it steered in the job. */
  helpers: string[];
  /** What it told the requester, oldest first. */
  told: string[];
  /** What it saved to memory. */
  stored: string[];
  /** When it will check back, soonest first (ISO). */
  checkBacks: string[];
};

/** Who stopped a job: Ankur's own stop reads as `you`. */
function stoppedBy(by: string): string {
  return by === "ankur" ? "you" : by;
}

/** The answer-by clock: `Answer due in 3m`, or `Answer 2m overdue` once it passed. */
export function answerByOf(job: JobLedger, now: number): AnswerBy | null {
  if (job.answer_by === null || job.told.length > 0) {
    return null;
  }
  const ms = Date.parse(job.answer_by) - now;
  return ms >= 0 ? { overdue: false, label: `Answer due in ${formatSpan(ms)}` } : { overdue: true, label: `Answer ${formatSpan(-ms)} overdue` };
}

/** The ask of a job: whose message opened it, and what it said. */
export function askOf(job: JobLedger, agentId: string): BriefAsk {
  const routine = job.requester === agentId;
  return { who: routine ? "Routine" : job.requester === null ? "You" : job.requester, at: job.opened.at, text: job.opened.content, routine };
}

/** What the agent is doing now: working on its job, waiting on its targets, stopped, or at rest. */
function headlineOf(agent: Pick<AgentRecord, "id" | "running" | "updated_at">, tone: BriefTone, now: number): string {
  const { job, waiting_on: waiting } = agent.running;
  switch (tone) {
    case "stopped":
      return `Stopped by ${stoppedBy(job!.stopped!.by)} at ${formatClock(job!.stopped!.at)}`;
    case "working":
      if (job === null) {
        return "Working";
      }
      return job.requester === agent.id ? "Running its routine" : job.requester === null ? "Working on your request" : `Working for ${job.requester}`;
    case "waiting":
      return `Waiting on ${waiting!.targets.join(", ")} since ${formatClock(waiting!.since)}`;
    case "idle":
      return `Idle · last active ${formatRelative(agent.updated_at, now)}`;
  }
}

/**
 * The agent's job ledger as copy for the sheet's top card. Stopped wins over a wait; a running loop wins
 * over a stopped job it has moved past; the ledger's rows read as given, never as a count of what needs Ankur.
 */
export function briefOf(agent: Pick<AgentRecord, "id" | "running" | "updated_at">, now: number): Brief {
  const { job, working, waiting_on: waiting } = agent.running;
  const tone: BriefTone = working ? "working" : job !== null && job.stopped !== null ? "stopped" : waiting !== null ? "waiting" : "idle";
  return {
    tone,
    headline: headlineOf(agent, tone, now),
    ask: job === null ? null : askOf(job, agent.id),
    answerBy: job === null || tone === "stopped" ? null : answerByOf(job, now),
    asked: job?.asks.map((ask) => ({ to: ask.to, replied: ask.answered_seq !== null })) ?? [],
    helpers: job?.helpers ?? [],
    told: job?.told.map((entry) => entry.preview) ?? [],
    stored: job?.stored ?? [],
    checkBacks: job?.reminders ?? [],
  };
}

/** What the thread still waits on from the agent's newest message to Ankur. */
export type Standing = { status: Extract<MessageStatus, "needs_input" | "blocked">; content: string; at: string };

/** `status` as a standing, or null for anything that leaves nothing open. */
function standing(status: MessageStatus | null | undefined, content: string, at: string): Standing | null {
  return status === "needs_input" || status === "blocked" ? { status, content, at } : null;
}

/**
 * What the agent's newest message in the human thread leaves open: `needs_input` (it is parked on Ankur's
 * answer) or `blocked`. A newer message from Ankur settles it; `done` or a plain message leaves nothing open.
 * Read from the thread when hath's thread route carries `status`; otherwise from the human messages in `wakes`
 * (newest first), where the wake routes do carry it: the first one found, sent to Ankur or received from him, decides.
 */
export function standingOf(messages: DurableMessage[], wakes: WakeDetail[]): Standing | null {
  const human = messages.filter((message) => message.kind !== "notice");
  const newest = human.reduce<DurableMessage | null>((best, message) => (best === null || message.seq > best.seq ? message : best), null);
  if (newest !== null && newest.status !== undefined) {
    return newest.from_agent_id === null ? null : standing(newest.status, newest.content, newest.created_at);
  }
  for (const { entries } of wakes) {
    for (const entry of [...entries].reverse()) {
      if (entry.type !== "message" || entry.message.kind !== "message") {
        continue;
      }
      const { message } = entry;
      if (message.from_agent_id === null) {
        return null;
      }
      if (message.to_agent_id === null) {
        return standing(message.status, message.content, message.created_at);
      }
    }
  }
  return null;
}

/**
 * What an agent is doing, in the one line the agent list's Now column has room for: the ask while it works on
 * one, what it waits on, who stopped it; nothing at rest.
 */
export function nowLine(agent: Pick<AgentRecord, "id" | "running" | "updated_at">, now: number): string {
  const brief = briefOf(agent, now);
  if (brief.tone === "working") {
    return agent.running.job === null ? "" : agent.running.job.opened.content.replace(/\s*\n+\s*/g, " ");
  }
  return brief.tone === "idle" ? "" : brief.headline;
}

/** What a wait is on in words: `a task`, `an agent` or both, from the addresses it names (`task/...` is a helper task). */
function waitTarget(targets: string[]): string {
  const tasks = targets.some((target) => target.startsWith("task/"));
  const agents = targets.some((target) => !target.startsWith("task/"));
  return tasks && agents ? "a task and an agent" : agents ? "an agent" : "a task";
}

/** The agent's state as the popover's header says it: `Working`, `Waiting on a task`, `Stopped` or `Idle`. */
export function stateWord(brief: Pick<Brief, "tone">, waiting: AgentRecord["running"]["waiting_on"]): string {
  switch (brief.tone) {
    case "working":
      return "Working";
    case "waiting":
      return waiting === null ? "Waiting" : `Waiting on ${waitTarget(waiting.targets)}`;
    case "stopped":
      return "Stopped";
    case "idle":
      return "Idle";
  }
}

/** The ISO time the agent has been in its state since, as far as hath says: the start of its wait, when it was stopped, the job's opening, or its last update. */
export function stateSince(agent: Pick<AgentRecord, "running" | "updated_at">, brief: Pick<Brief, "tone">): string {
  const { job, waiting_on: waiting } = agent.running;
  if (brief.tone === "waiting" && waiting !== null) {
    return waiting.since;
  }
  if (brief.tone === "stopped" && job !== null && job.stopped !== null) {
    return job.stopped.at;
  }
  if (brief.tone === "working" && job !== null) {
    return job.opened.at;
  }
  return agent.updated_at;
}
