import type { Transport } from "../transport";
import type {
  ChaaviCreateItem,
  ChaaviFolder,
  ChaaviHealth,
  ChaaviItem,
  ChaaviItemType,
  ChaaviReveal,
  ChaaviTotp,
  ChaaviUpdateItem,
} from "../../../types/chaavi";

/** Optional filters for Chaavi GET /v1/items. */
export type ChaaviItemsQuery = {
  /** Free-text search. */
  q?: string;
  /** Filter items that match this URI. */
  uri?: string;
  /** Restrict to one item type. */
  type?: ChaaviItemType;
};

/** React Query key for the vault catalog. */
export const CHAAVI_ITEMS_KEY = ["chaavi", "items"] as const;
/** React Query key for the vault folders. */
export const CHAAVI_FOLDERS_KEY = ["chaavi", "folders"] as const;
/** React Query key for Chaavi health. */
export const CHAAVI_HEALTH_KEY = ["chaavi", "health"] as const;

/**
 * Chaavi HTTP client — vault health, item and folder CRUD, and decrypt-on-demand reveal.
 * List/detail never embed secrets; callers reveal one value explicitly and keep it out of
 * the query cache. Paths live here; callers pass only domain args.
 */
export function createChaaviClient(transport: Transport, baseUrl: string) {
  const item = (id: string) => `/v1/items/${encodeURIComponent(id)}`;
  const folder = (id: string) => `/v1/folders/${encodeURIComponent(id)}`;
  return {
    /** GET /health — process liveness and vault ready/unconfigured. */
    getHealth(): Promise<ChaaviHealth> {
      return transport.request({ baseUrl, path: "/health", method: "GET" });
    },

    /** GET /v1/items — catalog items; never a secret value. */
    listItems(query?: ChaaviItemsQuery): Promise<{ items: ChaaviItem[] }> {
      return transport.request({ baseUrl, path: `/v1/items${toQuery(query)}`, method: "GET" });
    },

    /** POST /v1/items — create an item of any type. */
    createItem(body: ChaaviCreateItem): Promise<ChaaviItem> {
      return transport.request({ baseUrl, path: "/v1/items", method: "POST", body });
    },

    /** PATCH /v1/items/:id — change, move or star an item. */
    updateItem(id: string, body: ChaaviUpdateItem): Promise<ChaaviItem> {
      return transport.request({ baseUrl, path: item(id), method: "PATCH", body });
    },

    /** DELETE /v1/items/:id — move an item to the vault's trash. */
    deleteItem(id: string): Promise<void> {
      return transport.request({ baseUrl, path: item(id), method: "DELETE" });
    },

    /** POST /v1/items/:id/reveal — decrypt one secret on demand. */
    reveal(id: string, body: ChaaviReveal): Promise<{ value: string }> {
      return transport.request({ baseUrl, path: `${item(id)}/reveal`, method: "POST", body });
    },

    /** POST /v1/items/:id/totp — the login's current one-time code. */
    getTotp(id: string): Promise<ChaaviTotp> {
      return transport.request({ baseUrl, path: `${item(id)}/totp`, method: "POST" });
    },

    /** POST /v1/generate — a fresh password, not stored. */
    generatePassword(body: { length?: number; special?: boolean }): Promise<{ password: string }> {
      return transport.request({ baseUrl, path: "/v1/generate", method: "POST", body });
    },

    /** GET /v1/folders — every folder. */
    listFolders(): Promise<{ folders: ChaaviFolder[] }> {
      return transport.request({ baseUrl, path: "/v1/folders", method: "GET" });
    },

    /** POST /v1/folders — create a folder. */
    createFolder(name: string): Promise<ChaaviFolder> {
      return transport.request({ baseUrl, path: "/v1/folders", method: "POST", body: { name } });
    },

    /** PATCH /v1/folders/:id — rename a folder. */
    renameFolder(id: string, name: string): Promise<ChaaviFolder> {
      return transport.request({ baseUrl, path: folder(id), method: "PATCH", body: { name } });
    },

    /** DELETE /v1/folders/:id — delete a folder; its items move to no folder. */
    deleteFolder(id: string): Promise<void> {
      return transport.request({ baseUrl, path: folder(id), method: "DELETE" });
    },
  };
}

/** Chaavi client shape returned by {@link createChaaviClient}. */
export type ChaaviClient = ReturnType<typeof createChaaviClient>;

/** Build a query string for {@link ChaaviItemsQuery}, or empty when unset. */
function toQuery(query?: ChaaviItemsQuery): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.uri) {
    params.set("uri", query.uri);
  }
  if (query.type) {
    params.set("type", query.type);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
