import type { Transport } from "../transport";
import type {
  DeleteNodeResponse,
  GraphRequest,
  GraphResponse,
  IngestRequest,
  IngestResponse,
  NodeHistoryRecord,
  NodeResponse,
  PatchNodeRequest,
  QueryRequest,
  QueryResponse,
  RecallRequest,
  RecallResponse,
} from "../../../types/yaad";

/**
 * Yaad HTTP client — memory query, recall, node history, ingest, and hand edits.
 * Paths live here; callers pass only domain args.
 */
export function createYaadClient(transport: Transport, baseUrl: string) {
  return {
    /** POST /query — structured node listing. */
    query(body: QueryRequest): Promise<QueryResponse> {
      return transport.request({
        baseUrl,
        path: "/query",
        method: "POST",
        body,
      });
    },

    /** POST /recall — graph-hop semantic recall. */
    recall(body: RecallRequest): Promise<RecallResponse> {
      return transport.request({
        baseUrl,
        path: "/recall",
        method: "POST",
        body,
      });
    },

    /** POST /graph — bounded live subgraph (seeded one-hop when `seed_ids` is set). */
    graph(body: GraphRequest): Promise<GraphResponse> {
      return transport.request({
        baseUrl,
        path: "/graph",
        method: "POST",
        body,
      });
    },

    /** GET /nodes/:id — node with detail and edges. */
    getNode(id: string): Promise<NodeResponse> {
      return transport.request({
        baseUrl,
        path: `/nodes/${id}`,
        method: "GET",
      });
    },

    /** PATCH /nodes/:id — hand edit; returns the node as GET does. */
    patchNode(id: string, body: PatchNodeRequest): Promise<NodeResponse> {
      return transport.request({
        baseUrl,
        path: `/nodes/${id}`,
        method: "PATCH",
        body,
      });
    },

    /** DELETE /nodes/:id — delete, sweeping neighbors it leaves unlinked. */
    deleteNode(id: string): Promise<DeleteNodeResponse> {
      return transport.request({
        baseUrl,
        path: `/nodes/${id}`,
        method: "DELETE",
      });
    },

    /** POST /ingest — file free text into nodes and edges (slow: an LLM extracts). */
    ingest(body: IngestRequest): Promise<IngestResponse> {
      return transport.request({
        baseUrl,
        path: "/ingest",
        method: "POST",
        body,
      });
    },

    /** GET /nodes/:id/history — field-level change log. */
    getNodeHistory(id: string): Promise<{ history: NodeHistoryRecord[] }> {
      return transport.request({
        baseUrl,
        path: `/nodes/${id}/history`,
        method: "GET",
      });
    },

    /** POST /history/search — free-text history search. */
    searchHistory(body: {
      query: string;
      limit?: number;
    }): Promise<{ results: NodeHistoryRecord[] }> {
      return transport.request({
        baseUrl,
        path: "/history/search",
        method: "POST",
        body,
      });
    },
  };
}

/** Yaad client shape returned by {@link createYaadClient}. */
export type YaadClient = ReturnType<typeof createYaadClient>;
