/** Work vs process lane on an agent. */
export type Lane = "work" | "process";

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
  /** The agent's messages to you after `read_seq`; notices are not counted. */
  unread: number;
  /** The last message seq read in this thread on any device; null until one is read. */
  read_seq: number | null;
};

/** POST /agents/:id/read — where the thread's read mark now stands. */
export type ThreadReadMark = {
  agent_id: string;
  read_seq: number;
  unread: number;
};

/** One durable human-thread message from GET /agents/:id/messages. */
export type DurableMessage = {
  id: string;
  seq: number;
  from_agent_id: string | null;
  to_agent_id: string | null;
  content: string;
  attachments: AttachmentSummary[];
  /** notice: hath's word that the agent's work stopped, shown as a system line; absent from an older hath. */
  kind?: "message" | "notice";
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

/** A helper task's lifecycle state in Nas. */
export type TaskStatus = "working" | "idle" | "asking" | "asleep";

/** One browser or terminal task in Nas that an agent owns or last steered. */
export type AgentTask = {
  /** The task's address, such as `task/browser/3`. */
  id: string;
  kind: "browser" | "terminal";
  status: TaskStatus;
  purpose: string;
  /** The page a browser is on, or the directory and files a terminal has touched. */
  current: string;
  /** ISO time of the task's last activity. */
  last_activity: string;
};

/** The helper tasks an agent owns or last steered, most recently active first. */
export type AgentSessions = {
  tasks: AgentTask[];
};

/** What an agent's work lane is waiting on, and since when. */
export type AgentWaiting = {
  targets: string[];
  /** ISO time the wait began. */
  since: string;
  /** ISO time the wait times out. */
  wakes_by: string;
};

/**
 * Where an agent's work stands, from Hath (`running.status` on GET /agents): the answer to
 * "what are you doing?". Null when no lane runs and the work lane is not waiting.
 */
export type AgentStatus = {
  /** The latest message from whoever gave the agent its job; null when none has. */
  job: { from: string | null; at: string; content: string } | null;
  work: {
    state: "running" | "waiting" | "idle";
    /** ISO time the wait began, or the last step while running; null while idle. */
    since: string | null;
    /** What it waits on, when waiting. */
    waiting_on: string[];
  };
  /** The work lane's current step (its last tool call and short argument); null before it has acted. */
  step: string | null;
  /** The work lane's last five tool calls, oldest first; `ok` is null while a call has no result. */
  recent: { name: string; arg: string; ok: boolean | null }[];
  /** The helper tasks the agent owns that are in flight. */
  tasks: { id: string; status: string; current: string }[];
  /** Why Nas could not be read for the tasks, or null. */
  tasks_unreadable: string | null;
  /** Messages the work lane queued that the process lane has not sent. */
  pending: { id: number; to: string | null; expects_reply: boolean; preview: string }[];
};

/** Flat agent row from GET /agents. */
export type AgentRecord = {
  id: string;
  name: string;
  system_prompt: string;
  parent_agent_id: string | null;
  active: boolean;
  running: { work: boolean; process: boolean; waiting_on: AgentWaiting | null; status: AgentStatus | null };
  sessions: AgentSessions;
  created_at: string;
  updated_at: string;
};

/** Agent detail including children and tool descriptors. */
export type AgentDetail = AgentRecord & {
  children: AgentRecord[];
  tools: Array<{ name: string; description: string }>;
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
  /**
   * The wake that wrote the row; null for rows outside any wake or from before wake ids,
   * and absent from a hath that does not stamp them yet.
   */
  wake_id?: string | null;
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
      /** notice for hath's word that an agent's work stopped; absent on a message someone wrote. */
      kind?: "message" | "notice";
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
  | { type: "thread_read"; agent_id: string; read_seq: number; unread: number; at: string }
  | { type: "router_started"; at: string }
  | { type: "router_finished"; at: string }
  | { type: "router_failed"; message: string; at: string }
  /** A scheduled message was created, edited, cancelled, delivered or advanced; names no schedule. */
  | { type: "schedules_changed"; at: string }
  /** The tasks an agent owns or steered changed; `sessions` on GET /agents is out of date. */
  | { type: "sessions_changed"; at: string }
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
