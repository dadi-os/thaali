/**
 * Shape an agent's durable logs into wakes for the agent popover's activity feed. A wake
 * is one stretch of work: from a received message (or a lane starting cold) until both
 * lanes have yielded, with the thinking and working lanes' turns interleaved in the
 * order they happened.
 */

import type { Lane, LogRecord } from "../../../types/hath";

/**
 * Longest quiet stretch inside one wake. Only reasoning failures are logged, so a lane
 * that died any other way never reads as idle; a gap this long ends its wake regardless.
 */
const WAKE_GAP_MS = 10 * 60_000;

/**
 * How Hath's reportReasoningFailure (hath `src/runtime/engine.ts`) opens the message it
 * sends when an agent's reasoning lane dies: the only logged sign of a lane failure.
 */
const REASONING_FAILED_PREFIX = "[runtime] My reasoning lane failed";

/**
 * Tools that hand work to the other lane, which then runs once the caller stops:
 * thinking steers working, and working asks thinking to message someone.
 */
const HANDOFF: Partial<Record<string, Lane>> = {
  steer_reasoning: "reasoning",
  send_message: "conversation",
};

/** A tool call's logged result. */
export type ToolOutcome = { content: string; isError: boolean };

/** One tool call, paired with its `tool_result` row by tool_use_id. */
export type ActivityTool = {
  key: string;
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** null until the tool's result is logged. */
  result: ToolOutcome | null;
};

/** What a model call wrote or called, in the order it produced them. */
export type TurnPart =
  | { kind: "text"; key: string; text: string }
  | { kind: "tool"; key: string; tool: ActivityTool };

/** The model's thinking for one call. */
export type Thought = {
  /** One line that stands for the thought: its first bold heading, else its first line. */
  gist: string;
  text: string;
};

/** One model call that wrote something or called a shown tool. */
export type TurnStep = {
  kind: "turn";
  key: string;
  lane: Lane;
  at: string;
  /** The call's thinking, joined; null when it had none or only redacted thinking. */
  thought: Thought | null;
  parts: TurnPart[];
};

/** A message this agent received or sent. */
export type MessageStep = {
  kind: "message";
  key: string;
  lane: Lane;
  at: string;
  direction: "receive" | "send";
  /** The other side: an agent id, or null for Ankur. */
  peer: string | null;
  /** True when Hath's scheduler delivered it. */
  scheduled: boolean;
  /** True for the runtime's report that this agent's reasoning lane died. */
  laneFailure: boolean;
  content: string;
};

/** One entry on a wake's timeline. */
export type ActivityStep = TurnStep | MessageStep;

/** One stretch of work, its steps oldest first. */
export type ActivityWake = {
  /** The wake's first row id, so it keeps its identity while it grows. */
  key: string;
  startedAt: string;
  /** The newest step's time. */
  at: string;
  steps: ActivityStep[];
  /** Lanes that took a model turn in this wake. */
  lanes: Lane[];
  /** Tool calls made, yield excluded. */
  toolCount: number;
  /** Tool calls whose logged result is an error. */
  errorCount: number;
};

/** `value` as a plain object, or null for anything else (arrays included). */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * thoughtGist picks the line that stands for a thought. Gemini's thought summaries open
 * with filler and carry their point in a bold heading line; Claude's thinking is plain
 * prose, so its first line serves. `text` is non-blank.
 */
export function thoughtGist(text: string): string {
  const heading = /^\s*\*\*(.+?)\*\*\s*$/m.exec(text);
  if (heading) {
    return heading[1].trim();
  }
  return text.trimStart().split("\n")[0].replace(/[*_`#>]/g, "").trim();
}

/** Index every `tool_result` row by the tool call it answers. */
function resultsById(logs: LogRecord[]): Map<string, ToolOutcome> {
  const results = new Map<string, ToolOutcome>();
  for (const log of logs) {
    if (log.event !== "tool_result") {
      continue;
    }
    const { tool_use_id: id, content } = log.payload;
    if (typeof id !== "string" || typeof content !== "string") {
      continue;
    }
    results.set(id, { content, isError: log.payload.is_error === true });
  }
  return results;
}

/**
 * Whether a tool call is left off the timeline: yield ends every lane turn, and a
 * delivered dispatch_message already shows as its own sent message. Failures always show.
 */
function isHiddenTool(tool: ActivityTool): boolean {
  if (tool.result?.isError) {
    return false;
  }
  return tool.name === "yield" || tool.name === "dispatch_message";
}

/** What one `response` row adds to its wake. */
type ParsedTurn = {
  /** null when the call wrote nothing and called only hidden tools. */
  step: TurnStep | null;
  tools: ActivityTool[];
  /** True when the lane stopped after this call: it yielded or ended its turn. */
  ends: boolean;
};

/**
 * Split one `response` row into its thought, the text and tool calls it shows, and every
 * tool it called; malformed blocks are skipped.
 */
function parseTurn(log: LogRecord, results: Map<string, ToolOutcome>): ParsedTurn {
  const content = Array.isArray(log.payload.content) ? log.payload.content : [];
  const thoughts: string[] = [];
  const parts: TurnPart[] = [];
  const tools: ActivityTool[] = [];
  content.forEach((raw, index) => {
    const block = asRecord(raw);
    if (!block) {
      return;
    }
    const key = `${log.id}:${index}`;
    if (block.type === "thinking" && typeof block.thinking === "string") {
      const text = block.thinking.trim();
      if (text) {
        thoughts.push(text);
      }
    } else if (block.type === "text" && typeof block.text === "string") {
      const text = block.text.trim();
      if (text) {
        parts.push({ kind: "text", key, text });
      }
    } else if (
      block.type === "tool_use" &&
      typeof block.id === "string" &&
      typeof block.name === "string"
    ) {
      const tool: ActivityTool = {
        key,
        id: block.id,
        name: block.name,
        input: asRecord(block.input) ?? {},
        result: results.get(block.id) ?? null,
      };
      tools.push(tool);
      if (!isHiddenTool(tool)) {
        parts.push({ kind: "tool", key, tool });
      }
    }
  });
  const ends =
    log.payload.stop_reason !== "tool_use" || tools.some((tool) => tool.name === "yield");
  if (parts.length === 0) {
    return { step: null, tools, ends };
  }
  const text = thoughts.join("\n\n");
  return {
    step: {
      kind: "turn",
      key: log.id,
      lane: log.lane,
      at: log.created_at,
      thought: text ? { gist: thoughtGist(text), text } : null,
      parts,
    },
    tools,
    ends,
  };
}

/** One `message` row as a step, or null when its direction or content is malformed. */
function parseMessage(log: LogRecord): MessageStep | null {
  const { direction, content } = log.payload;
  if ((direction !== "receive" && direction !== "send") || typeof content !== "string") {
    return null;
  }
  const peer = direction === "receive" ? log.payload.from_agent_id : log.payload.to_agent_id;
  return {
    kind: "message",
    key: log.id,
    lane: log.lane,
    at: log.created_at,
    direction,
    peer: typeof peer === "string" ? peer : null,
    scheduled: typeof log.payload.schedule_id === "string",
    laneFailure: direction === "send" && content.startsWith(REASONING_FAILED_PREFIX),
    content,
  };
}

/**
 * buildActivity turns logs (any order) into wakes, newest first, each with its steps
 * oldest first. A received message or a model call starts a new wake when both lanes
 * are idle; sent messages and tool results never do, since they only follow a call. A
 * handoff leaves its target lane pending, so the turn it causes joins the same wake,
 * while a message that arrives first, because that lane never ran, starts a new one.
 * Wakes with nothing to show are dropped.
 */
export function buildActivity(logs: LogRecord[]): ActivityWake[] {
  const results = resultsById(logs);
  const chronological = [...logs]
    .reverse()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const wakes: ActivityWake[] = [];
  const busy: Record<Lane, boolean> = { conversation: false, reasoning: false };
  const pending: Record<Lane, boolean> = { conversation: false, reasoning: false };
  let current: ActivityWake | null = null;
  let lastAt = 0;

  for (const log of chronological) {
    if (log.event === "tool_result") {
      continue;
    }
    const at = Date.parse(log.created_at);
    const opens =
      (log.event === "response" && !pending[log.lane]) || log.payload.direction === "receive";
    const idle = !busy.conversation && !busy.reasoning;
    if (current === null || at - lastAt > WAKE_GAP_MS || (opens && idle)) {
      current = {
        key: log.id,
        startedAt: log.created_at,
        at: log.created_at,
        steps: [],
        lanes: [],
        toolCount: 0,
        errorCount: 0,
      };
      wakes.push(current);
      busy.conversation = false;
      busy.reasoning = false;
      pending.conversation = false;
      pending.reasoning = false;
    }
    lastAt = at;

    if (log.event === "message") {
      const step = parseMessage(log);
      if (step) {
        current.steps.push(step);
        current.at = step.at;
      }
      if (log.payload.direction === "receive") {
        busy.conversation = true;
      }
      if (step?.laneFailure) {
        busy.reasoning = false;
        pending.reasoning = false;
      }
      continue;
    }

    const turn = parseTurn(log, results);
    busy[log.lane] = !turn.ends;
    pending[log.lane] = false;
    if (!current.lanes.includes(log.lane)) {
      current.lanes.push(log.lane);
    }
    for (const tool of turn.tools) {
      if (tool.name !== "yield") {
        current.toolCount += 1;
      }
      if (tool.result?.isError) {
        current.errorCount += 1;
      }
      const target = HANDOFF[tool.name];
      if (target && !tool.result?.isError && !busy[target]) {
        pending[target] = true;
      }
    }
    if (turn.step) {
      current.steps.push(turn.step);
      current.at = turn.step.at;
    }
  }

  return wakes.filter((wake) => wake.steps.length > 0).reverse();
}
