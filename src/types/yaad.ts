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
  /** Date without a time of day: occurred_at and end_at sit at local midnight of their dates. */
  all_day: boolean;
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
  /** Who made this change, which may differ from who created the node. */
  source: NodeSource;
  /** Hath agent that made this change; null unless source is agent. */
  agent_id: string | null;
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
