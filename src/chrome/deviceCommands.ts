/** Local execution of Hath device_* tools on this desktop. */

import { isTauriRuntime } from "../shared/api/runtime";
import { loadCredentials } from "../shared/api/credentials";
import { openAgent } from "../store/chat";

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
  | "device_get_network"
  | "device_read_clipboard"
  | "device_write_clipboard"
  | "device_send_file"
  | "device_open_chat";

/** Run one device_* tool against the local device; failures surface as DeviceError. */
export async function executeDeviceTool(
  tool: DeviceLocalTool,
  args: Record<string, unknown>,
): Promise<unknown> {
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
    case "device_read_clipboard":
      return readClipboard();
    case "device_write_clipboard":
      return writeClipboard(requireString(args, "text"));
    case "device_send_file":
      return sendFile({
        filename: requireString(args, "filename"),
        media_type: requireString(args, "media_type"),
        data: requireString(args, "data"),
      });
    case "device_open_chat": {
      const agentId = requireString(args, "agent_id");
      openAgent(agentId);
      return { opened: agentId };
    }
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

async function readClipboard(): Promise<{ text: string }> {
  const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
  try {
    const text = await readText();
    return { text };
  } catch (err) {
    throw new DeviceError("permission_denied", errMessage(err));
  }
}

async function writeClipboard(text: string): Promise<{ written: true }> {
  const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
  try {
    await writeText(text);
    return { written: true };
  } catch (err) {
    throw new DeviceError("permission_denied", errMessage(err));
  }
}

async function sendFile(args: {
  filename: string;
  media_type: string;
  data: string;
}): Promise<{ path: string; media_type: string }> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const path = await invoke<string>("device_write_download", {
      filename: args.filename,
      data: args.data,
    });
    return { path, media_type: args.media_type };
  } catch (err) {
    throw mapInvokeError(err);
  }
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new DeviceError("invalid_request", `${key} must be a string`);
  }
  return value;
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
