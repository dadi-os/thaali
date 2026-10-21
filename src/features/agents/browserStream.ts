/**
 * One shared, watched connection per Nas browser stream and profile. Every view of a
 * browser with that profile (sidebar pin and agent panel; the expanded view runs faster)
 * draws from the same connection and the same decoder, so views never queue behind each
 * other for the webview's few connections per host, and the connection closes when the last
 * view leaves. A stream that errors, ends or stops producing frames reconnects on a
 * bounded, logged backoff; a frame resets it, and running out fails the view with the last
 * error.
 */

import { nas } from "../../shared/api";
import { ApiError } from "../../shared/api/errors";
import { logLine } from "../../shared/lib/platform/log";
import { H264Splitter } from "./h264";

/** How a view wants its stream: `fps` frames a second, `width` pixels wide, `kbps` H.264 bitrate. */
export type StreamProfile = { fps: number; width: number; kbps: number };

/** A view that only watches: Nas's own defaults, cheap enough to leave on every pin. */
export const WATCH_PROFILE: StreamProfile = { fps: 5, width: 960, kbps: 600 };

/**
 * A view the user drives: 720p at 30 fps, with a bitrate ceiling under the mesh link's
 * measured 0.7 MB/s. A still page costs a small fraction of it.
 */
export const DRIVE_PROFILE: StreamProfile = { fps: 30, width: 1280, kbps: 3000 };

/** Longest wait for the next frame before the stream counts as stalled; the slowest profile is 5 fps. */
const STALL_MS = 6_000;

/** Delays before each reconnect after a drop; a received frame starts the list over. */
const RETRY_MS = [1_000, 2_000, 4_000, 8_000];

/** What a view of a browser shows: its newest frame, or why it has none. */
export type BrowserStreamState =
  | { phase: "opening" }
  | { phase: "live"; frame: VideoFrame }
  | { phase: "retrying"; error: string }
  | { phase: "failed"; error: string };

type Listener = (state: BrowserStreamState) => void;

/** One browser's connection at one profile and the views drawing it. */
type Hub = {
  id: number;
  profile: StreamProfile;
  listeners: Set<Listener>;
  state: BrowserStreamState;
  /** Aborted when the last view leaves. */
  closed: AbortController;
};

const hubs = new Map<string, Hub>();

/** Key of the hub for browser `id` at `profile`. */
function hubKey(id: number, profile: StreamProfile): string {
  return `${id}@${profile.fps}x${profile.width}k${profile.kbps}`;
}

/** Hand every view the hub's new state, then release the frame it replaced. */
function publish(hub: Hub, state: BrowserStreamState): void {
  const previous = hub.state;
  hub.state = state;
  for (const listener of hub.listeners) {
    listener(state);
  }
  if (previous.phase === "live" && previous !== state) {
    previous.frame.close();
  }
}

/** Resolves after `ms`, or as soon as `signal` aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Read one connection until it ends, decoding and publishing each frame and calling
 * `onFrame` after it. Throws why it dropped; a gap over STALL_MS without a decoded frame
 * aborts it as stalled.
 */
async function pump(hub: Hub, onFrame: () => void): Promise<void> {
  if (typeof VideoDecoder === "undefined") {
    throw new Error("this webview cannot decode H.264 (no WebCodecs)");
  }
  const connection = new AbortController();
  const close = () => connection.abort();
  hub.closed.signal.addEventListener("abort", close);
  let stalled = false;
  let watchdog = 0;
  const arm = () => {
    window.clearTimeout(watchdog);
    watchdog = window.setTimeout(() => {
      stalled = true;
      connection.abort();
    }, STALL_MS);
  };
  const decodeFault: { error?: Error } = {};
  const splitter = new H264Splitter();
  let decoder: VideoDecoder | null = null;
  let awaitingKey = true;
  let timestamp = 0;
  const frameUs = 1_000_000 / hub.profile.fps;
  const output = (frame: VideoFrame) => {
    if (hub.closed.signal.aborted) {
      frame.close();
      return;
    }
    arm();
    onFrame();
    publish(hub, { phase: "live", frame });
  };
  arm();
  try {
    const reader = (await nas.browserStream(hub.id, hub.profile, connection.signal)).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error("Nas ended the stream");
      }
      for (const event of splitter.push(value)) {
        if (event.kind === "config") {
          decoder?.close();
          decoder = new VideoDecoder({
            output,
            error: (error) => {
              decodeFault.error = error;
              connection.abort();
            },
          });
          decoder.configure({ ...event.config, optimizeForLatency: true });
          awaitingKey = true;
        } else if (decoder && (!awaitingKey || event.frame.key)) {
          awaitingKey = false;
          decoder.decode(
            new EncodedVideoChunk({ type: event.frame.key ? "key" : "delta", timestamp, data: event.frame.data }),
          );
          timestamp += frameUs;
        }
      }
    }
  } catch (err) {
    if (decodeFault.error) {
      throw new Error(`decoder failed: ${decodeFault.error.message}`);
    }
    if (stalled) {
      throw new Error(`no frame for ${STALL_MS / 1000}s`);
    }
    throw err;
  } finally {
    window.clearTimeout(watchdog);
    hub.closed.signal.removeEventListener("abort", close);
    connection.abort();
    if (decoder && decoder.state !== "closed") {
      decoder.close();
    }
  }
}

/**
 * Keep the hub's browser streaming until its last view leaves: reconnect after each drop
 * on RETRY_MS, and fail once those run out without a frame or Nas says the browser is gone.
 */
async function run(hub: Hub): Promise<void> {
  let attempt = 0;
  while (!hub.closed.signal.aborted) {
    let error: string;
    try {
      await pump(hub, () => {
        attempt = 0;
      });
      return;
    } catch (err) {
      if (hub.closed.signal.aborted) {
        return;
      }
      error = err instanceof Error ? err.message : String(err);
      if (err instanceof ApiError && err.status === 404) {
        publish(hub, { phase: "failed", error: `browser ${hub.id} is not running` });
        return;
      }
    }
    const delay = RETRY_MS[attempt];
    if (delay === undefined) {
      logLine("error", `browser ${hub.id} stream failed: ${error}`, "browser_stream_failed");
      publish(hub, { phase: "failed", error });
      return;
    }
    logLine("warn", `browser ${hub.id} stream dropped: ${error}; retrying in ${delay}ms`, "browser_stream_retry");
    publish(hub, { phase: "retrying", error });
    attempt += 1;
    await pause(delay, hub.closed.signal);
  }
}

/**
 * Watch browser `id`'s stream at `profile`: `listener` gets the current state now and every change
 * after, including each frame, which it must draw before returning (the frame is released
 * when the next one arrives). Returns the unsubscribe; the last one closes the connection.
 */
export function subscribeBrowserStream(id: number, profile: StreamProfile, listener: Listener): () => void {
  const key = hubKey(id, profile);
  let hub = hubs.get(key);
  if (!hub) {
    const created: Hub = { id, profile, listeners: new Set(), state: { phase: "opening" }, closed: new AbortController() };
    hubs.set(key, created);
    void run(created);
    hub = created;
  }
  const joined = hub;
  joined.listeners.add(listener);
  listener(joined.state);
  return () => {
    joined.listeners.delete(listener);
    if (joined.listeners.size > 0) {
      return;
    }
    joined.closed.abort();
    hubs.delete(key);
    if (joined.state.phase === "live") {
      joined.state.frame.close();
    }
  };
}

/** Start a failed stream over for every view of browser `id` at `profile`. */
export function retryBrowserStream(id: number, profile: StreamProfile): void {
  const hub = hubs.get(hubKey(id, profile));
  if (!hub || hub.state.phase !== "failed") {
    return;
  }
  publish(hub, { phase: "opening" });
  void run(hub);
}
