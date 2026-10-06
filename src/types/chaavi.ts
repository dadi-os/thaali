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
