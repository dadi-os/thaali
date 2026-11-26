/**
 * Agent log event kinds from Hath. `response` is one model call's output,
 * blocks in order (thinking, text, tool_use), logged before its tools run;
 * `tool_result` carries the tool's name and outcome. Speech lives in messages, not logs.
 */
export type LogEvent = "response" | "tool_result";

/** A message's kind: `notice` is hath's note to an agent, `utterance` the router's. */
export type MessageKind = "message" | "notice" | "utterance";

/** What a sender says about the job its message closes or parks. */
export type MessageStatus = "done" | "blocked" | "needs_input";

/** Response from Hath POST /messages. */
export type PostMessageResponse = {
  to_agent_id: string;
  content: string;
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
  /** notice: hath's note to an agent; it belongs inside a wake, not in the human thread. */
  kind?: MessageKind;
  /** What the agent says about its job in a message to its requester; absent from a hath whose thread route does not carry it. */
  status?: MessageStatus | null;
  created_at: string;
};

/** One message the router sent to an agent as the user. */
export type RoutedMessage = {
  to_agent_id: string;
  content: string;
  seq: number;
  created_at: string;
};

/** Response from Hath POST /router: every message it sent, in order (may be empty). */
export type PostRouterResponse = {
  messages: RoutedMessage[];
};

/** One router run in flight, from the moment Hath accepts a POST /router until it finishes or fails. */
export type RouterRun = {
  /** Ties the run to its `router_finished` or `router_failed`; runs can overlap. */
  run_id: string;
  /** ISO time the run was accepted. */
  at: string;
};

/** Response from Hath GET /router: the runs in flight, none when the router is idle. */
export type RouterState = {
  running: RouterRun[];
};

/** A helper task's lifecycle state in Nas; `paused` while its owner drives it, `stopped` once Ankur or Hath halted it. */
export type TaskStatus = "working" | "paused" | "idle" | "asking" | "asleep" | "stopped";

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

/** What an agent is waiting on after its wake ended, and since when. */
export type AgentWaiting = {
  targets: string[];
  /** ISO time the wait began. */
  since: string;
  /** ISO time the wait times out and hath wakes the agent with the facts. */
  wakes_by: string;
};

/**
 * One piece of work an agent is on, as the agent's wake sees it (`running.job` on GET /agents):
 * opened by a message, closed when the requester has been told. The answer to "what is it doing
 * for this ask, and what has it done".
 */
export type JobLedger = {
  /** The job's number: its opening message's seq. */
  job: number;
  /** Who asked: an agent id, null for Ankur, the agent's own id for a routine run. */
  requester: string | null;
  /** The opening message, clipped. */
  opened: { seq: number; at: string; content: string };
  /** When the answer is due; only Ankur's jobs have one. */
  answer_by: string | null;
  /** Each agent it asked, with the seq of that agent's first reply (null while none). */
  asks: { to: string; seq: number; answered_seq: number | null }[];
  /** The helper tasks steered in the job. */
  helpers: string[];
  /** Titles of what the job stored in memory. */
  stored: string[];
  /** What the agent already sent the requester, oldest first, clipped. */
  told: { seq: number; preview: string }[];
  /** When the agent will check back, soonest first (ISO). */
  reminders: string[];
  /** Set once the job was stopped. */
  stopped: { at: string; by: string } | null;
};

/** `running` on an agent row: one loop, so one flag. */
export type AgentRunning = {
  /** The agent's loop is running a step now. */
  working: boolean;
  waiting_on: AgentWaiting | null;
  /** The job of the agent's current wake, or null. */
  job: JobLedger | null;
};

/** Flat agent row from GET /agents. */
export type AgentRecord = {
  id: string;
  name: string;
  system_prompt: string;
  parent_agent_id: string | null;
  active: boolean;
  running: AgentRunning;
  sessions: AgentSessions;
  created_at: string;
  updated_at: string;
};

/** Agent detail including children. */
export type AgentDetail = AgentRecord & {
  children: AgentRecord[];
};

/** The weekdays a routine can run on. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** An agent's own standing duty (GET /agents/:id/routines). Only its agent changes it; Ankur may cancel it. */
export type Routine = {
  id: string;
  agent_id: string;
  title: string;
  procedure: string;
  /** Local time of day, `HH:MM`, in the box's zone. */
  at: string;
  /** The days it runs on; null is every day. */
  days: Weekday[] | null;
  next_run_at: string;
  last_run_at: string | null;
  last_job_id: string | null;
  active: boolean;
  created_at: string;
};

/** A one-shot "check back at" that belongs to a job. */
export type Reminder = {
  id: string;
  agent_id: string;
  job_id: string | null;
  note: string;
  run_at: string;
};

/** GET /agents/:id/routines, next run first in each list. */
export type RoutineList = {
  routines: Routine[];
  reminders: Reminder[];
};


/** POST /agents/:id/stop: Ankur's hard stop. */
export type StopResult = {
  agent_id: string;
  /** True when a running loop was ended. */
  ended_run: boolean;
  /** The stopped job's number, null when the agent had no open job. */
  job: number | null;
  stopped_tasks: string[];
  halt_failed: { task: string; error: string }[];
};


/** One agent log row from Hath. */
export type LogRecord = {
  id: string;
  agent_id: string;
  event: LogEvent;
  payload: Record<string, unknown>;
  /**
   * The wake that wrote the row; null for rows outside any wake or from before wake ids,
   * and absent from a hath that does not stamp them yet.
   */
  wake_id?: string | null;
  created_at: string;
};

/** Why a wake began. */
export type WakeReasonKind = "message" | "schedule" | "recovery" | "steer" | "manual";

/** The structured reason a wake began; `ref` is the sender agent id for `message`, the routine or reminder id for `schedule`, else null. */
export type WakeReason = { kind: WakeReasonKind; ref: string | null };

/** Where a wake stands: `waiting` appears only on an agent's latest wake, when the agent watches a helper task or agent. */
export type WakeOutcome = "running" | "waiting" | "yielded" | "failed";

/** Model usage summed over a wake's model calls; `calls` is how many. */
export type WakeUsage = {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_write: number;
  cache_read: number;
};

/** What a wake did, counted. */
export type WakeCounts = { tool_calls: number; messages_sent: number; messages_received: number };

/** A message as the wake routes return it. */
export type WakeMessage = {
  id: string;
  seq: number;
  kind: MessageKind;
  status: MessageStatus | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  content: string;
  created_at: string;
};

/** One wake as `GET /agents/:id/wakes` lists it and `GET /agents/:id/wakes/:wake_id` opens it. */
export type WakeSummary = {
  id: string;
  agent_id: string;
  reason: WakeReason;
  /** The message that opened the wake, when one did. */
  opened_by: WakeMessage | null;
  started_at: string;
  /** Null while the wake runs. */
  ended_at: string | null;
  outcome: WakeOutcome;
  /** Set when the outcome is `failed`. */
  error: string | null;
  usage: WakeUsage;
  counts: WakeCounts;
  /** True when the wake's activity aged out; its messages remain. */
  activity_trimmed: boolean;
};

/** A tool call's result inside a wake; `content` is cut to the server cap when `truncated`, and `chars` is the full length. */
export type WakeToolResult = { content: string; is_error: boolean; truncated: boolean; chars: number };

/** One tool call of a turn, paired with its result; `log_id` and `result` are both null until the result is logged. */
export type WakeToolCall = {
  id: string;
  name: string;
  input: unknown;
  log_id: string | null;
  result: WakeToolResult | null;
};

/** One entry of a wake's timeline, ordered by `ord`: a message the agent received or sent, or one model turn. */
export type WakeEntry =
  | { ord: number; at: string; type: "message"; direction: "sent" | "received"; message: WakeMessage }
  | {
      ord: number;
      at: string;
      type: "turn";
      usage: { input_tokens: number; output_tokens: number; cache_write: number; cache_read: number };
      thinking: string | null;
      text: string | null;
      calls: WakeToolCall[];
    };

/** The keyset position after the last wake of a page; the next page starts before it. */
export type WakeCursor = { started_at: string; id: string };

/** Response of GET /agents/:id/wakes: one page, newest first; `next_before` is null at the end. */
export type WakeList = { wakes: WakeSummary[]; next_before: WakeCursor | null };

/** Response of GET /agents/:id/wakes/:wake_id. */
export type WakeDetail = { wake: WakeSummary; entries: WakeEntry[] };

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
      seq: number;
      /** notice for hath's word that an agent's work stopped; absent on a message someone wrote. */
      kind?: MessageKind;
      at: string;
    }
  | { type: "wake_started"; agent_id: string; wake_id: string; reason: WakeReason; at: string }
  | { type: "wake_ended"; agent_id: string; wake_id: string; outcome: Exclude<WakeOutcome, "running">; at: string }
  | { type: "wake_activity"; agent_id: string; wake_id: string; counts: WakeCounts }
  | { type: "thread_read"; agent_id: string; read_seq: number; unread: number; at: string }
  | { type: "router_started"; run_id: string; at: string }
  | { type: "router_finished"; run_id: string; at: string }
  | { type: "router_failed"; run_id: string; message: string; at: string }
  /** A routine or reminder was created, ended, cancelled or fired; names none, so refetch the lists shown. */
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
