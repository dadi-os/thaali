import type { AgentRecord, Lane } from "../types/hath";

export type RunningMap = Record<string, { work: boolean; process: boolean }>;

type Listener = (running: RunningMap) => void;

let running: RunningMap = {};
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

/** Which lanes are running, per agent. */
export function getRunning(): RunningMap {
  return running;
}

/** Listens for running-lane changes; returns the unsubscribe function. */
export function subscribeRunning(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Seed from GET /agents (or reconnect refetch). */
export function seedRunningFromAgents(agents: AgentRecord[]): void {
  const next: RunningMap = {};
  for (const agent of agents) {
    next[agent.id] = { work: agent.running.work, process: agent.running.process };
  }
  if (runningMapsEqual(running, next)) {
    return;
  }
  running = next;
  emit();
}

function runningMapsEqual(a: RunningMap, b: RunningMap): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const id of aKeys) {
    const left = a[id];
    const right = b[id];
    if (
      !right ||
      left.work !== right.work ||
      left.process !== right.process
    ) {
      return false;
    }
  }
  return true;
}

/** Records whether one agent lane is running and notifies listeners. */
export function setLaneRunning(
  agentId: string,
  lane: Lane,
  isRunning: boolean,
): void {
  const current = running[agentId] ?? { work: false, process: false };
  running = {
    ...running,
    [agentId]: { ...current, [lane]: isRunning },
  };
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
