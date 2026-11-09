import type { Lane } from "../../../types/hath";
import type { ActivityTool, ActivityWake, MessageStep } from "./activity";

/** Quiet stretch between two entries that earns a time separator. */
const SEPARATOR_GAP_MS = 10 * 60_000;

/** One entry of a lane's thread. */
export type ThreadEntry =
  | { kind: "thought"; key: string; at: string; text: string }
  | { kind: "tool"; key: string; at: string; tool: ActivityTool }
  | { kind: "message"; key: string; at: string; step: MessageStep }
  | { kind: "notice"; key: string; at: string; step: MessageStep };

/** A thread's row: an entry, or the quiet separator before it. */
export type ThreadItem = ThreadEntry | { kind: "separator"; key: string; at: string; day: boolean };

/**
 * One lane's thread: every wake's rows of `lane` flattened into entries, oldest first. A model call's thinking and its
 * written text are thoughts, its shown tool calls are tools, and the runtime's wake-stopped report is a notice.
 */
export function flattenLane(wakes: ActivityWake[], lane: Lane): ThreadEntry[] {
  const entries: ThreadEntry[] = [];
  for (const wake of [...wakes].reverse()) {
    for (const step of wake.steps) {
      if (step.lane !== lane) {
        continue;
      }
      if (step.kind === "message") {
        entries.push({ kind: step.wakeStopped ? "notice" : "message", key: step.key, at: step.at, step });
        continue;
      }
      if (step.thought !== null) {
        entries.push({ kind: "thought", key: `${step.key}:thought`, at: step.at, text: step.thought.text });
      }
      for (const part of step.parts) {
        entries.push(part.kind === "text" ? { kind: "thought", key: part.key, at: step.at, text: part.text } : { kind: "tool", key: part.key, at: step.at, tool: part.tool });
      }
    }
  }
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Whether two instants fall on different calendar days of the device's zone. */
function otherDay(a: string, b: string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

/** `entries` with a day separator where the day changes and a time separator where more than ten minutes pass. */
export function withSeparators(entries: ThreadEntry[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    if (previous !== undefined) {
      const day = otherDay(previous.at, entry.at);
      if (day || Date.parse(entry.at) - Date.parse(previous.at) > SEPARATOR_GAP_MS) {
        items.push({ kind: "separator", key: `sep:${entry.key}`, at: entry.at, day });
      }
    }
    items.push(entry);
  });
  return items;
}

/** The tab an agent's sheet opens on: Work when its work lane runs or has entries, else Process, else About. */
export function defaultTab(workRunning: boolean, workCount: number, processCount: number): "Work" | "Process" | "About" {
  if (workRunning || workCount > 0) {
    return "Work";
  }
  return processCount > 0 ? "Process" : "About";
}
