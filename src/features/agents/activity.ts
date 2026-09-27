/** Shape durable agent logs into model turns for the agent popover's activity feed. */

import type { Lane, LogRecord } from "../../shared/api/types";

/** A tool call's logged result. */
export type ToolOutcome = { content: string; isError: boolean };

/** One block of a model turn, in the order the model produced it. */
export type ActivityBlock =
  | { kind: "thinking"; key: string; text: string }
  | { kind: "redacted"; key: string }
  | { kind: "text"; key: string; text: string }
  | {
      kind: "tool";
      key: string;
      id: string;
      name: string;
      input: Record<string, unknown>;
      /** null while the tool is still running. */
      result: ToolOutcome | null;
    };

/** One model call: its blocks in the order the model produced them. */
export type ActivityTurn = {
  key: string;
  lane: Lane;
  at: string;
  blocks: ActivityBlock[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** Index every `tool_result` row by the tool call it answers. */
function resultsById(logs: LogRecord[]): Map<string, ToolOutcome> {
  const results = new Map<string, ToolOutcome>();
  for (const log of logs) {
    if (log.event !== "tool_result") {
      continue;
    }
    const id = log.payload.tool_use_id;
    if (typeof id !== "string") {
      continue;
    }
    results.set(id, {
      content: typeof log.payload.content === "string" ? log.payload.content : "",
      isError: log.payload.is_error === true,
    });
  }
  return results;
}

/** The displayable blocks of one `response` row; blank thinking and text are skipped. */
function turnBlocks(
  log: LogRecord,
  results: Map<string, ToolOutcome>,
): ActivityBlock[] {
  const content = log.payload.content;
  if (!Array.isArray(content)) {
    return [];
  }
  const blocks: ActivityBlock[] = [];
  content.forEach((raw, index) => {
    const block = asRecord(raw);
    if (!block) {
      return;
    }
    const key = `${log.id}:${index}`;
    if (block.type === "thinking" && typeof block.thinking === "string") {
      const text = block.thinking.trim();
      if (text) {
        blocks.push({ kind: "thinking", key, text });
      }
    } else if (block.type === "redacted_thinking") {
      blocks.push({ kind: "redacted", key });
    } else if (block.type === "text" && typeof block.text === "string") {
      const text = block.text.trim();
      if (text) {
        blocks.push({ kind: "text", key, text });
      }
    } else if (
      block.type === "tool_use" &&
      typeof block.id === "string" &&
      typeof block.name === "string"
    ) {
      blocks.push({
        kind: "tool",
        key,
        id: block.id,
        name: block.name,
        input: asRecord(block.input) ?? {},
        result: results.get(block.id) ?? null,
      });
    }
  });
  return blocks;
}

/**
 * buildActivity turns logs (any order) into model turns, newest first. Each
 * `response` row is one turn; each tool call in it is paired with its
 * `tool_result` by tool_use_id.
 */
export function buildActivity(logs: LogRecord[]): ActivityTurn[] {
  const results = resultsById(logs);
  const turns: ActivityTurn[] = [];
  for (const log of logs) {
    if (log.event !== "response") {
      continue;
    }
    const blocks = turnBlocks(log, results);
    if (blocks.length === 0) {
      continue;
    }
    turns.push({ key: log.id, lane: log.lane, at: log.created_at, blocks });
  }
  return turns.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
