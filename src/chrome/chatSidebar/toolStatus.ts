/** Resolve the in-flight tool from durable agent logs for the chat tool preview. */

import type { LogRecord } from "../../shared/api/types";
import { LANE_LABEL } from "../../shared/lib/ux/lanes";

/** Tool turn-exit name — not shown as a live tool preview. */
const YIELD = "yield";

export type ActiveTool = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Response rows land before their tools run and list every `tool_use` for the round.
 * The first tool_use whose result is not yet logged is the one currently
 * executing (tools run sequentially).
 */
export function findActiveTool(logs: LogRecord[]): ActiveTool | null {
  const completed = new Set<string>();
  for (const log of logs) {
    if (log.event !== "tool_result") {
      continue;
    }
    const id = log.payload.tool_use_id;
    if (typeof id === "string") {
      completed.add(id);
    }
  }

  const chronological = [...logs].reverse();
  for (const log of chronological) {
    if (log.event !== "response") {
      continue;
    }
    const content = log.payload.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const block of content) {
      const row = asRecord(block);
      if (!row || row.type !== "tool_use") {
        continue;
      }
      if (typeof row.id !== "string" || typeof row.name !== "string") {
        continue;
      }
      if (row.name === YIELD) {
        continue;
      }
      if (completed.has(row.id)) {
        continue;
      }
      const input =
        row.input === undefined || row.input === null
          ? {}
          : asRecord(row.input);
      if (input === null) {
        continue;
      }
      return {
        id: row.id,
        name: row.name,
        input,
      };
    }
  }
  return null;
}

/** Lane chip copy from conversation / reasoning occupancy. */
export type LaneChipLabel =
  | (typeof LANE_LABEL)[keyof typeof LANE_LABEL]
  | `${typeof LANE_LABEL.conversation} + ${typeof LANE_LABEL.reasoning}`;

/** Lane chip copy from conversation / reasoning occupancy. */
export function laneChipLabel(
  conversation: boolean,
  reasoning: boolean,
): LaneChipLabel | null {
  if (conversation && reasoning) {
    return `${LANE_LABEL.conversation} + ${LANE_LABEL.reasoning}`;
  }
  if (conversation) {
    return LANE_LABEL.conversation;
  }
  if (reasoning) {
    return LANE_LABEL.reasoning;
  }
  return null;
}
