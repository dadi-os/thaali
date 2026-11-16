import type { AgentRecord, AgentRunning, HathEvent, WakeCounts } from "../types/hath";

/** Each agent's `running` block: seeded from GET /agents, and moved by wake events between refetches. */
export type RunningMap = Record<string, AgentRunning>;

/** A wake that is running now and what it has done so far. */
export type LiveWake = { wakeId: string; counts: WakeCounts };

type Listener = (running: RunningMap) => void;

/** What an agent that was never listed reads as. */
const QUIET: AgentRunning = { working: false, waiting_on: null, job: null };
const NO_COUNTS: WakeCounts = { tool_calls: 0, messages_sent: 0, messages_received: 0 };

let running: RunningMap = {};
/** The running wake of each agent, with the counts `wake_activity` last reported. */
let liveWakes: Record<string, LiveWake> = {};
/** Router runs Hath reported in flight, by run id. */
let routerRuns = new Set<string>();
/** This device's own POST /router calls in flight. */
let localSends = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener(running);
  }
}

/** What each agent is running, per agent. */
export function getRunning(): RunningMap {
  return running;
}

/** The running wake of an agent, or undefined while it has none. */
export function getLiveWake(agentId: string): LiveWake | undefined {
  return liveWakes[agentId];
}

/** The counts of every running wake; changes identity whenever one moves, for `useSyncExternalStore`. */
export function getLiveWakes(): Record<string, LiveWake> {
  return liveWakes;
}

/** Listens for running changes; returns the unsubscribe function. */
export function subscribeRunning(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Seed from GET /agents (or reconnect refetch). An agent that is not working has no live wake. */
export function seedRunningFromAgents(agents: AgentRecord[]): void {
  const next: RunningMap = {};
  for (const agent of agents) {
    next[agent.id] = agent.running;
  }
  const nextLive = Object.fromEntries(Object.entries(liveWakes).filter(([id]) => next[id]?.working === true));
  if (JSON.stringify(running) === JSON.stringify(next) && Object.keys(nextLive).length === Object.keys(liveWakes).length) {
    return;
  }
  running = next;
  liveWakes = nextLive;
  emit();
}

/** The wake events that move an agent's running state without a refetch. */
export type WakeEvent = Extract<HathEvent, { type: "wake_started" | "wake_ended" | "wake_activity" }>;

/** Applies one wake event: a start marks the loop working, an end marks it idle, activity updates the counts. */
export function applyWakeEvent(event: WakeEvent): void {
  const current = running[event.agent_id] ?? QUIET;
  if (event.type === "wake_started") {
    running = { ...running, [event.agent_id]: { ...current, working: true } };
    liveWakes = { ...liveWakes, [event.agent_id]: { wakeId: event.wake_id, counts: NO_COUNTS } };
  } else if (event.type === "wake_ended") {
    running = { ...running, [event.agent_id]: { ...current, working: false } };
    liveWakes = Object.fromEntries(Object.entries(liveWakes).filter(([id]) => id !== event.agent_id));
  } else {
    liveWakes = { ...liveWakes, [event.agent_id]: { wakeId: event.wake_id, counts: event.counts } };
  }
  emit();
}

/** True while the router has a run in flight anywhere, or this device's own POST /router has not answered. */
export function isRouting(): boolean {
  return routerRuns.size > 0 || localSends > 0;
}

/** True while this device's own POST /router has not answered; its rejection toasts there, so the event for the same failure stays quiet. */
export function hasLocalSend(): boolean {
  return localSends > 0;
}

/** Replaces the known runs with Hath's list: on connect, since a device that joins mid-run gets no event for the run. */
export function seedRouterRuns(runIds: string[]): void {
  routerRuns = new Set(runIds);
  running = { ...running };
  emit();
}

/** Records a `router_started` run. */
export function startRouterRun(runId: string): void {
  routerRuns = new Set(routerRuns).add(runId);
  running = { ...running };
  emit();
}

/** Records the end of a run, finished or failed; a run it never heard start is ignored. */
export function endRouterRun(runId: string): void {
  if (!routerRuns.has(runId)) {
    return;
  }
  const next = new Set(routerRuns);
  next.delete(runId);
  routerRuns = next;
  running = { ...running };
  emit();
}

/** Counts this device's own POST /router while it is in flight, so routing shows before and without its events. */
export function setLocalSend(inFlight: boolean): void {
  localSends = Math.max(0, localSends + (inFlight ? 1 : -1));
  running = { ...running };
  emit();
}

/** Forgets every run: the mesh went away, so none of them can be known to still be running. */
export function clearRouterRuns(): void {
  if (routerRuns.size === 0) {
    return;
  }
  routerRuns = new Set();
  running = { ...running };
  emit();
}
