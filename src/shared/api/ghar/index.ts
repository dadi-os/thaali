import type { Transport } from "../transport";
import type {
  GharCommand,
  GharCommissionJob,
  GharDevice,
  GharEvent,
  GharRadioCommand,
  GharTag,
} from "../../../types/ghar";

/** React Query key for GET /devices. Shared by the home widget and the Ghar page. */
export const GHAR_DEVICES_KEY = ["ghar", "devices"] as const;

/**
 * Ghar HTTP client — devices, tags, commissioning, and the device radio bridge.
 * Paths live here; callers pass only domain args.
 */
export function createGharClient(transport: Transport, baseUrl: string) {
  return {
    /** GET /health — process liveness. */
    getHealth(): Promise<{ status: string }> {
      return transport.request({
        baseUrl,
        path: "/health",
        method: "GET",
      });
    },

    /** GET /devices — Matter devices, each with its tags. */
    listDevices(): Promise<{ devices: GharDevice[] }> {
      return transport.request({
        baseUrl,
        path: "/devices",
        method: "GET",
      });
    },

    /** PATCH /tags/:id — rename a tag. Ghar refuses a name another tag has (409). */
    renameTag(id: string, name: string): Promise<GharTag> {
      return transport.request({
        baseUrl,
        path: `/tags/${id}`,
        method: "PATCH",
        body: { name },
      });
    },

    /** DELETE /tags/:id — delete a tag; every device that carried it loses it and stays. */
    deleteTag(id: string): Promise<void> {
      return transport.request({
        baseUrl,
        path: `/tags/${id}`,
        method: "DELETE",
      });
    },

    /** POST /tags/:id/devices — put devices under a tag. */
    addTagDevices(id: string, deviceIds: string[]): Promise<void> {
      return transport.request({
        baseUrl,
        path: `/tags/${id}/devices`,
        method: "POST",
        body: { device_ids: deviceIds },
      });
    },

    /** DELETE /tags/:id/devices/:deviceId — take one device out from under a tag; Ghar deletes the tag when no device is left. */
    removeTagDevice(id: string, deviceId: string): Promise<void> {
      return transport.request({
        baseUrl,
        path: `/tags/${id}/devices/${deviceId}`,
        method: "DELETE",
      });
    },

    /** PATCH /devices/:id — rename a device. Sync does not overwrite this. */
    renameDevice(id: string, name: string): Promise<GharDevice> {
      return transport.request({
        baseUrl,
        path: `/devices/${id}`,
        method: "PATCH",
        body: { name },
      });
    },

    /** PATCH /devices/:id — replace a device's tags by name, creating the ones that are new; Ghar drops tags no device carries. */
    setDeviceTags(id: string, tags: string[]): Promise<GharDevice> {
      return transport.request({
        baseUrl,
        path: `/devices/${id}`,
        method: "PATCH",
        body: { tags },
      });
    },

    /** POST /devices/:id/command — one capability command, attributed to the user. */
    command(id: string, command: GharCommand): Promise<void> {
      return transport.request({
        baseUrl,
        path: `/devices/${id}/command`,
        method: "POST",
        body: { ...command, cause: "user" },
      });
    },

    /** GET /events — a device's latest events, newest first. */
    listDeviceEvents(id: string, limit: number): Promise<{ events: GharEvent[] }> {
      const params = new URLSearchParams({ device_id: id, limit: String(limit), order: "desc" });
      return transport.request({
        baseUrl,
        path: `/events?${params.toString()}`,
        method: "GET",
      });
    },

    /** POST /devices/:id/identify — blink the device. */
    identify(id: string): Promise<void> {
      return transport.request({
        baseUrl,
        path: `/devices/${id}/identify`,
        method: "POST",
      });
    },

    /**
     * POST /commission — start a job.
     * `radio: "nearby"` uses this computer's Bluetooth and requires `wifi`.
     */
    startCommission(body: {
      code: string;
      tags?: string[];
      radio?: "network" | "nearby";
      wifi?: { ssid: string; password: string };
    }): Promise<{ job_id: string }> {
      return transport.request({
        baseUrl,
        path: "/commission",
        method: "POST",
        body,
      });
    },

    /** GET /commission/:jobId — job status. Failed jobs are still HTTP 200. */
    getCommission(jobId: string): Promise<GharCommissionJob> {
      return transport.request({
        baseUrl,
        path: `/commission/${jobId}`,
        method: "GET",
      });
    },

    /** POST /radio/attach — become the Bluetooth radio for Ghar. */
    attachRadio(): Promise<{ session_id: string }> {
      return transport.request({
        baseUrl,
        path: "/radio/attach",
        method: "POST",
      });
    },

    /** POST /radio/detach — release the radio session. */
    detachRadio(sessionId: string): Promise<{ status: string }> {
      return transport.request({
        baseUrl,
        path: "/radio/detach",
        method: "POST",
        body: { session_id: sessionId },
      });
    },

    /**
     * GET /radio/commands — next GATT or scan command.
     * `waitMs` holds the request open when the queue is empty.
     */
    pollRadio(
      sessionId: string,
      waitMs: number,
    ): Promise<{ command: GharRadioCommand | null }> {
      const params = new URLSearchParams({
        session_id: sessionId,
        wait_ms: String(waitMs),
      });
      return transport.request({
        baseUrl,
        path: `/radio/commands?${params.toString()}`,
        method: "GET",
      });
    },

    /** POST /radio/reply — finish a command Ghar is waiting on. */
    replyRadio(body: {
      session_id: string;
      id: number;
      ok: boolean;
      error?: string;
    }): Promise<{ status: string }> {
      return transport.request({
        baseUrl,
        path: "/radio/reply",
        method: "POST",
        body,
      });
    },

    /** POST /radio/event — advertisement, notification, or disconnect. */
    postRadioEvent(body: {
      session_id: string;
      kind: "advertisement" | "notification" | "disconnected";
      address: string;
      value_b64?: string;
    }): Promise<{ status: string }> {
      return transport.request({
        baseUrl,
        path: "/radio/event",
        method: "POST",
        body,
      });
    },
  };
}

/** Ghar client shape returned by {@link createGharClient}. */
export type GharClient = ReturnType<typeof createGharClient>;
