import type { LogRecord } from "../../../types/hath";

/** One stretch of an agent's work as the sheet lists it: when it began, how many tools it called and the first thing it said. */
export type SheetWake = {
  /** ISO time of the wake's first row. */
  at: string;
  tools: number;
  /** The first text the work lane wrote in the wake; empty when it wrote none. */
  text: string;
};

/** One block of a model response in a log row: text, a tool call, or anything else the model returned. */
type ResponseBlock = { type: string; text?: string };

/** The blocks of a `response` row's content. */
function blocksOf(log: LogRecord): ResponseBlock[] {
  const content = log.payload.content;
  return Array.isArray(content) ? (content as ResponseBlock[]) : [];
}

/**
 * The agent's logs grouped by the wake that wrote them, newest wake first. A row with no wake id is outside any
 * wake and is left out; a wake counts the tool calls in its model responses and keeps the first text any of them wrote.
 */
export function sheetWakes(logs: LogRecord[]): SheetWake[] {
  const byWake = new Map<string, SheetWake>();
  const oldestFirst = [...logs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const log of oldestFirst) {
    if (log.wake_id === null || log.wake_id === undefined) {
      continue;
    }
    const wake = byWake.get(log.wake_id) ?? { at: log.created_at, tools: 0, text: "" };
    byWake.set(log.wake_id, wake);
    if (log.event !== "response") {
      continue;
    }
    for (const block of blocksOf(log)) {
      if (block.type === "tool_use") {
        wake.tools += 1;
      }
      if (block.type === "text" && wake.text === "" && block.text !== undefined) {
        wake.text = block.text;
      }
    }
  }
  return [...byWake.values()].reverse();
}
