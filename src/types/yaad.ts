/** Yaad node kind. */
export type NodeKind = "person" | "memory" | "plan" | "place" | "task";
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

/** POST /graph body — omit `seed_ids` for every live node. */
export type GraphRequest = {
  seed_ids?: string[];
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

/** GET /counts response: every live node, nothing left out. */
export type CountsResponse = {
  total: number;
  kinds: Record<NodeKind, number>;
};
