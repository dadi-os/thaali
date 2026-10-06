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

/**
 * Job payload from GET /commission/:jobId. Wi-Fi credentials are never included.
 * Ghar sets `error` to the commissioning failure's message exactly when the job failed.
 */
export type GharCommissionJob = {
  id: string;
  node_id: string | null;
  device_ids: string[] | null;
  started_at: string;
  finished_at: string | null;
} & (
  | { status: "failed"; error: string }
  | { status: Exclude<GharCommissionStatus, "failed">; error: null }
);

/** One Bluetooth command Ghar asks this computer to run. */
export type GharRadioCommand = {
  id: number;
  name: "scan" | "stop_scan" | "connect" | "disconnect" | "write" | "subscribe";
  args: Record<string, string>;
};
