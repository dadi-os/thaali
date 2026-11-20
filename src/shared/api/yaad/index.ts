import type { Transport } from "../transport";
import type {
  CountsResponse,
  GraphRequest,
  GraphResponse,
  NodeHistoryRecord,
  NodeResponse,
  QueryRequest,
  QueryResponse,
  RecallRequest,
  RecallResponse,
} from "../../../types/yaad";

/**
 * Yaad HTTP client — memory query, recall, graph and node history. Yaad is read-only here: agents write memory, the app only reads it.
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

    /** POST /graph — every live node and edge, or the one-hop neighborhood of `seed_ids`. */
    graph(body: GraphRequest): Promise<GraphResponse> {
      return transport.request({
        baseUrl,
        path: "/graph",
        method: "POST",
        body,
      });
    },

    /** GET /counts — how many live nodes of each kind Yaad holds, and in all. */
    counts(): Promise<CountsResponse> {
      return transport.request({
        baseUrl,
        path: "/counts",
        method: "GET",
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
