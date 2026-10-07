/** Reasoning vs conversation lane on an agent. */
export type Lane = "reasoning" | "conversation";

/**
 * Agent log event kinds from Hath. `response` is one model call's output,
 * blocks in order (thinking, text, tool_use), logged before its tools run;
 * `tool_result` carries the tool's name and outcome; `message` a delivery.
 */
export type LogEvent = "response" | "tool_result" | "message";

/** Outbound file on POST /messages — base64 payload, no data-URL prefix. */
export type MessageAttachment = {
  media_type: string;
  data: string;
  filename?: string;
};

/** A file a message carries, as Hath stores it; the file itself is GET /attachments/:id. */
export type AttachmentSummary = {
  id: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  /** What an image shows, from Dwar image.describe; null for other files. */
  description: string | null;
};

/** Response from Hath POST /messages. */
export type PostMessageResponse = {
  to_agent_id: string;
  content: string;
  attachments: AttachmentSummary[];
  seq: number;
  created_at: string;
};

/** One human↔agent conversation summary from GET /threads. */
export type ThreadSummary = {
  agent_id: string;
  agent_name: string;
  last_message: string;
  last_at: string;
  from_user: boolean;
};

/** One durable human-thread message from GET /agents/:id/messages. */
export type DurableMessage = {
  id: string;
  seq: number;
  from_agent_id: string | null;
  to_agent_id: string | null;
  content: string;
  attachments: AttachmentSummary[];
  created_at: string;
};

/** One message the router sent to an agent as the user. */
export type RoutedMessage = {
  to_agent_id: string;
  content: string;
  attachments: AttachmentSummary[];
  seq: number;
  created_at: string;
};

/** Response from Hath POST /router: every message it sent, in order (may be empty). */
export type PostRouterResponse = {
  messages: RoutedMessage[];
};

/** Nas browsers/terminals this agent recently drove. Empty after Hath restart. */
export type AgentSessions = {
  browsers: number[];
  terminals: Array<{ id: string; last_command: string | null }>;
};

/** Flat agent row from GET /agents. */
export type AgentRecord = {
  id: string;
  name: string;
  system_prompt: string;
  parent_agent_id: string | null;
  active: boolean;
  running: { reasoning: boolean; conversation: boolean };
  sessions: AgentSessions;
  created_at: string;
  updated_at: string;
};

/** Agent detail including children and tool descriptors. */
export type AgentDetail = AgentRecord & {
  children: AgentRecord[];
  tools: Array<{ name: string; description: string; usage: string }>;
};

/** A message Hath delivers from one agent to another at `run_at`, optionally repeating. */
export type ScheduledMessage = {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  content: string;
  /** Next delivery, ISO. */
  run_at: string;
  /** Repeat interval; null delivers once. */
  interval_minutes: number | null;
  created_at: string;
};

/** PATCH /schedules/:id — any of the fields to change. */
export type PatchScheduleRequest = {
  /** ISO with offset, in the future. */
  run_at?: string;
  /** Null makes it one-shot. */
  interval_minutes?: number | null;
  content?: string;
};

/** One agent log row from Hath. */
export type LogRecord = {
  id: string;
  agent_id: string;
  lane: Lane;
  event: LogEvent;
  payload: Record<string, unknown>;
  created_at: string;
};

/** GET /health — process liveness. `started_at` is process identity, not a chat epoch. */
export type HathHealth = {
  status: string;
  /** ISO time this Hath process started. */
  started_at: string;
};

/** Hath SSE event envelope. */
export type HathEvent =
  | {
      type: "message";
      agent_id: string;
      from_agent_id: string | null;
      to_agent_id: string | null;
      content: string;
      attachments: AttachmentSummary[];
      seq: number;
      at: string;
    }
  | { type: "lane_started"; agent_id: string; lane: Lane; at: string }
  | { type: "lane_finished"; agent_id: string; lane: Lane; at: string }
  | {
      type: "lane_failed";
      agent_id: string;
      lane: Lane;
      message: string;
      at: string;
    }
  | { type: "router_started"; at: string }
  | { type: "router_finished"; at: string }
  | { type: "router_failed"; message: string; at: string }
  | {
      type: "agent_spawned";
      agent_id: string;
      parent_agent_id: string | null;
      name: string;
      at: string;
    }
  | {
      type: "agent_modified";
      agent_id: string;
      name: string;
      active: boolean;
      at: string;
    }
  | {
      type: "device_command";
      command_id: string;
      node_name: string;
      tool: string;
      args: Record<string, unknown>;
      at: string;
    };
