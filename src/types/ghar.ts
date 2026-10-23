/** Ghar capability name on a device: a set of state keys and the commands that change them. */
export type GharCapabilityName =
  | "on_off"
  | "level"
  | "color"
  | "cover"
  | "fan"
  | "thermostat"
  | "lock"
  | "sensor"
  | "button"
  | "alarm"
  | "power_source"
  | "energy"
  | "valve"
  | "pump"
  | "rvc"
  | "appliance"
  | "mode"
  | "temperature_control"
  | "media"
  | "camera";

/** What a device is, from its Matter device type. */
export type GharKind =
  | "light"
  | "plug"
  | "switch"
  | "cover"
  | "fan"
  | "air_purifier"
  | "thermostat"
  | "air_conditioner"
  | "heat_pump"
  | "water_heater"
  | "lock"
  | "contact"
  | "occupancy"
  | "light_sensor"
  | "temperature"
  | "humidity"
  | "pressure"
  | "flow"
  | "leak"
  | "freeze"
  | "rain"
  | "air_quality"
  | "smoke_alarm"
  | "energy_meter"
  | "solar"
  | "battery_storage"
  | "ev_charger"
  | "valve"
  | "irrigation"
  | "pump"
  | "robot_vacuum"
  | "washer"
  | "dryer"
  | "dishwasher"
  | "refrigerator"
  | "cabinet"
  | "oven"
  | "cooktop"
  | "microwave"
  | "extractor_hood"
  | "speaker"
  | "tv"
  | "camera"
  | "doorbell"
  | "bridge"
  | "other";

/** A choice a device offers (a mode, area or input), from its capability config. */
export type GharChoice = { id: number; label: string };

/** One command for POST /devices/:id/command. */
export type GharCommand = {
  capability: GharCapabilityName;
  command: string;
  params?: Record<string, unknown>;
};

/** A row from Ghar GET /events. */
export type GharEvent = {
  id: string;
  device_id: string;
  attribute_key: string;
  old_value: unknown;
  new_value: unknown;
  /** `external` is a change made at the device itself. */
  cause: "agent" | "user" | "external";
  /** The agent id for agent changes. */
  cause_ref: string | null;
  created_at: string;
};

/** Live attribute from Ghar GET /devices. */
export type GharAttributeState = {
  value: unknown;
  changed_at: string;
};

/** Device row from Ghar GET /devices. */
export type GharDevice = {
  id: string;
  name: string;
  kind: GharKind;
  /** Matter product string. Quiet subtitle; the row `name` is the device's own label. */
  product_name: string | null;
  /** The bridge's product name when the device sits behind a bridge. */
  bridge_name: string | null;
  room: { id: string; name: string };
  /** The Ghar tags (shown as groups) the device carries. */
  tags: GharTag[];
  capabilities: Array<{
    capability: GharCapabilityName;
    /** Capability config from Ghar: color `modes`, setpoint support, mode and area choices, sensor `measurements`. */
    config: Record<string, unknown>;
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

/** A Ghar tag: a named group of devices that crosses rooms. */
export type GharTag = {
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
