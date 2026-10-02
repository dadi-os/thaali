/** Local execution of Hath device_* tools on this desktop. */

import { isTauriRuntime } from "../shared/api/runtime";
import { loadCredentials } from "../shared/api/credentials";

/** Typed failure returned to Hath as a command error. */
export class DeviceError extends Error {
  readonly type: string;

  constructor(type: string, message: string) {
    super(message);
    this.name = "DeviceError";
    this.type = type;
  }
}

/** Device tools this desktop can execute locally. */
export type DeviceLocalTool =
  | "device_get_info"
  | "device_get_battery"
  | "device_get_location"
  | "device_get_network";

/** Run one device_* tool against the local device; failures surface as DeviceError. */
export async function executeDeviceTool(tool: DeviceLocalTool): Promise<unknown> {
  if (!isTauriRuntime()) {
    throw new DeviceError(
      "capability_unsupported",
      "Device tools require the Tauri desktop app",
    );
  }

  switch (tool) {
    case "device_get_info":
      return getInfo();
    case "device_get_battery":
      return getBattery();
    case "device_get_location":
      return getLocation();
    case "device_get_network":
      return getNetwork();
    default: {
      const _exhaustive: never = tool;
      throw new DeviceError("invalid_request", `unknown tool ${_exhaustive}`);
    }
  }
}

async function getInfo(): Promise<Record<string, unknown>> {
  const { platform, version, arch, locale } = await import("@tauri-apps/plugin-os");
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new DeviceError("internal_error", "mesh credentials are not stored");
  }
  return {
    node_name: credentials.node_name,
    platform: platform(),
    os_version: version(),
    arch: arch(),
    locale: await locale(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    app_version: APP_VERSION,
  };
}

async function getBattery(): Promise<{ percent: number; charging: boolean }> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<{ percent: number; charging: boolean }>("device_get_battery");
  } catch (err) {
    throw mapInvokeError(err);
  }
}

/**
 * Read coordinates (+ optional address) via native location APIs.
 * Prompts once if undetermined when an agent asks; not on every app launch.
 */
async function getLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  at: string;
  address?: string;
}> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<{
      latitude: number;
      longitude: number;
      accuracy: number;
      at: string;
      address?: string;
    }>("device_get_location");
  } catch (err) {
    throw mapInvokeError(err);
  }
}

async function getNetwork(): Promise<Record<string, unknown>> {
  const { invoke } = await import("@tauri-apps/api/core");
  let mesh_status = 0;
  try {
    mesh_status = await invoke<number>("mesh_status");
  } catch (err) {
    throw mapInvokeError(err);
  }
  const connection = readConnection();
  return {
    mesh_up: mesh_status === 1,
    mesh_status,
    connection_type: connection.type,
    downlink_mbps: connection.downlink,
    ssid: null,
  };
}

function mapInvokeError(err: unknown): DeviceError {
  const message = errMessage(err);
  const match = /^(capability_unsupported|permission_denied|invalid_request|internal_error):\s*(.*)$/.exec(
    message,
  );
  if (match) {
    return new DeviceError(match[1], match[2] || message);
  }
  return new DeviceError("internal_error", message);
}

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "device command failed";
}

function readConnection(): { type: string | null; downlink: number | null } {
  const nav = navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string; downlink?: number };
  };
  const connection = nav.connection;
  if (!connection) {
    return { type: null, downlink: null };
  }
  return {
    type: connection.type ?? connection.effectiveType ?? null,
    downlink: typeof connection.downlink === "number" ? connection.downlink : null,
  };
}

/** App version stamped at build time from package.json. */
export const APP_VERSION = __THAALI_APP_VERSION__;
