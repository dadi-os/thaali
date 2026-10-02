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
};

/** One durable human-thread message from GET /agents/:id/messages. */
export type DurableMessage = {
  id: string;
  seq: number;
  from_agent_id: string | null;
  to_agent_id: string | null;
  content: string;
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

/** Yaad node kind. */
export type NodeKind = "person" | "memory" | "plan" | "place";
/** Provenance of a Yaad write. */
export type NodeSource = "manual" | "agent" | "ingest";
/** Plan lifecycle status. */
export type PlanStatus = "idea" | "tentative" | "confirmed";

/** Person-kind detail payload. */
export type PersonDetail = {
  birthday: string | null;
  aliases: string[];
};

/** Plan-kind detail payload. */
export type PlanDetail = {
  end_at: string | null;
  status: PlanStatus;
  recurrence: string | null;
  series_id: string | null;
};

/** Place-kind detail payload. */
export type PlaceDetail = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Kind-specific node detail; null for memory nodes without extra fields. */
export type NodeDetail = PersonDetail | PlanDetail | PlaceDetail | null;

/** Core Yaad node row. */
export type NodeRecord = {
  id: string;
  kind: NodeKind;
  title: string;
  body: string | null;
  occurred_at: string | null;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  source: NodeSource;
  /** Hath agent that created the node; null unless source is agent. */
  agent_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Directed edge between Yaad nodes. */
export type EdgeRecord = {
  id: string;
  src_id: string;
  dst_id: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
  created_at: string;
  valid_from: string;
  valid_to: string | null;
};

/** One field change in a node's history. */
export type NodeHistoryRecord = {
  id: string;
  node_id: string;
  field: "title" | "body" | "occurred_at" | "deleted";
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  source: NodeSource;
};

/** POST /query body. */
export type QueryRequest = {
  kind?: NodeKind;
  name?: string;
  occurred_from?: string;
  occurred_to?: string;
  status?: PlanStatus;
  limit?: number;
  offset?: number;
};

/** POST /query response. */
export type QueryResponse = {
  nodes: Array<NodeRecord & { detail: NodeDetail }>;
  limit: number;
  offset: number;
};

/** POST /recall body: anchors from `from`, else the filters, else `query`; `hops` fixes the walk depth. */
export type RecallRequest = {
  query?: string;
  from?: string[];
  hops?: number;
  kind?: NodeKind;
  name?: string;
  occurred_from?: string;
  occurred_to?: string;
  status?: PlanStatus;
  limit?: number;
};

/** POST /recall response with scored neighborhood. */
export type RecallResponse = {
  nodes: Array<
    NodeRecord & {
      detail: NodeDetail;
      hops: number;
      /** Null when the request had no query. */
      score: number | null;
    }
  >;
  edges: EdgeRecord[];
  coverage: number | null;
  sufficient: boolean | null;
  hops_taken: number;
  anchors: string[];
};

/** POST /graph body — omit `seed_ids` for the most-used live nodes. */
export type GraphRequest = {
  seed_ids?: string[];
  limit?: number;
};

/** POST /graph response. Every edge endpoint is in `nodes`. */
export type GraphResponse = {
  nodes: NodeRecord[];
  edges: EdgeRecord[];
};

/** GET /nodes/:id response. */
export type NodeResponse = NodeRecord & {
  detail: NodeDetail;
  edges: { outgoing: EdgeRecord[]; incoming: EdgeRecord[] };
};

/** POST /ingest body from a client: free text Yaad files into nodes and edges. */
export type IngestRequest = {
  text: string;
  /** When the text was said; Yaad resolves relative dates ("tomorrow") against it. */
  occurred_at: string;
  participant_ids?: string[];
  source: "ingest";
};

/** One operation Yaad applied from an ingest; creates carry the persisted `id`. */
export type AppliedOperation =
  | { op: "create_node"; id: string; temp_id: string; kind: NodeKind; title: string; occurred_at?: string | null }
  | { op: "update_node"; node_id: string; title?: string }
  | { op: "close_node"; node_id: string; reason: string }
  | { op: "create_edge"; id: string; src: string; dst: string; type: string }
  | { op: "close_edge"; edge_id: string; reason: string }
  | { op: "noop"; reason: string };

/** POST /ingest response. */
export type IngestResponse = {
  operations: AppliedOperation[];
  counts: Record<AppliedOperation["op"], number>;
  /** create_node temp_id → persisted uuid. */
  temp_ids: Record<string, string>;
  /** Nodes deleted because the batch left them with no current edge. */
  orphans: string[];
};

/** PATCH /nodes/:id body — a hand edit; at least one field. */
export type PatchNodeRequest = {
  title?: string;
  body?: string | null;
  occurred_at?: string | null;
  /** Plan-only detail fields; Yaad rejects detail on memories. */
  detail?: Partial<Pick<PlanDetail, "status" | "end_at" | "recurrence">>;
};

/** DELETE /nodes/:id response. */
export type DeleteNodeResponse = {
  id: string;
  /** Neighbors deleted because the delete left them with no current edge. */
  orphans: string[];
};

/** Vault item classification in the Chaavi catalog. */
export type ChaaviItemKind = "login" | "note" | "secret";

/**
 * Catalog row from Chaavi GET /v1/items.
 * Metadata only — never a password or secret body (use revealLogin).
 */
export type ChaaviItem = {
  /** Vault item id. */
  id: string;
  /** Display name. */
  name: string;
  /** Item classification. */
  kind: ChaaviItemKind;
  /** Login username when present; null for notes/secrets without one. */
  username: string | null;
  /** Associated URIs. */
  uris: string[];
  /** True when a login stores a FIDO2 passkey. */
  hasPasskey: boolean;
};

/** Body for Chaavi POST /v1/logins. */
export type ChaaviCreateLogin = {
  name: string;
  username: string;
  uri?: string;
  /** When omitted, Chaavi generates a password. */
  password?: string;
  length?: number;
  special?: boolean;
};

/** Body for Chaavi PATCH /v1/items/:id (login). At least one field required. */
export type ChaaviUpdateLogin = {
  name?: string;
  username?: string;
  /** Empty string clears websites. */
  uri?: string;
  password?: string;
};

/** Decrypt-on-demand login from Chaavi POST /v1/items/:id/login. */
export type ChaaviLoginCredential = {
  username: string;
  password: string;
};

/** GET /health — process is up; vault may still be unconfigured. */
export type ChaaviHealth = {
  /** Process liveness string from Chaavi. */
  status: string;
  /** Whether a vault is configured on this node. */
  vault: "ready" | "unconfigured";
};

/** Ghar capability name on a device. */
export type GharCapabilityName =
  | "switchable"
  | "dimmable"
  | "colorable"
  | "sensor"
  | "lockable"
  | "media"
  | "thermostat";

/** Live attribute from Ghar GET /devices. */
export type GharAttributeState = {
  value: unknown;
  changed_at: string;
};

/** Device row from Ghar GET /devices. */
export type GharDevice = {
  id: string;
  name: string;
  /** Matter product string. Quiet subtitle; the row `name` is the device's own label. */
  product_name: string | null;
  room: { id: string; name: string };
  capabilities: Array<{
    capability: GharCapabilityName;
    /** Capability config from Ghar, such as color `modes`. */
    config?: Record<string, unknown>;
  }>;
  online: boolean;
  last_seen_at: string | null;
  state: Record<string, GharAttributeState>;
};

/** Room row from Ghar GET /rooms. */
export type GharRoom = {
  id: string;
  name: string;
};

/** Commission job status from Ghar. */
export type GharCommissionStatus =
  | "pending"
  | "discovering"
  | "commissioning"
  | "succeeded"
  | "failed";

/** Job payload from GET /commission/:jobId. Wi-Fi credentials are never included. */
export type GharCommissionJob = {
  id: string;
  status: GharCommissionStatus;
  node_id: string | null;
  device_ids: string[] | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

/** One Bluetooth command Ghar asks this computer to run. */
export type GharRadioCommand = {
  id: number;
  name: "scan" | "stop_scan" | "connect" | "disconnect" | "write" | "subscribe";
  args: Record<string, string>;
};
