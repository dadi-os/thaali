/**
 * One shared, watched connection per Nas browser stream and frame rate. Every view of a
 * browser at that rate (sidebar pin and agent panel; the expanded view runs faster) draws
 * from the same connection, so views never queue
 * behind each other for the webview's few connections per host, and the connection closes
 * when the last view leaves. A stream that errors, ends or stops sending frames reconnects
 * on a bounded, logged backoff; a frame resets it, and running out fails the view with the
 * last error.
 */

import { nas } from "../../shared/api";
import { ApiError } from "../../shared/api/errors";
import { logLine } from "../../shared/lib/platform/log";

/** Frames a second for a view that only watches; Nas's default. */
export const WATCH_FPS = 5;

/** Frames a second for a view the user drives, so the picture keeps up with the pointer. */
export const DRIVE_FPS = 15;

/** Longest wait for the next frame before the stream counts as stalled; Nas sends 5 fps. */
const STALL_MS = 6_000;

/** Delays before each reconnect after a drop; a received frame starts the list over. */
const RETRY_MS = [1_000, 2_000, 4_000, 8_000];

/** What a view of a browser shows: its newest frame, or why it has none. */
export type BrowserStreamState =
  | { phase: "opening" }
  | { phase: "live"; frame: ImageBitmap }
  | { phase: "retrying"; error: string }
  | { phase: "failed"; error: string };

type Listener = (state: BrowserStreamState) => void;

/** One browser's connection at one frame rate and the views drawing it. */
type Hub = {
  id: number;
  fps: number;
  listeners: Set<Listener>;
  state: BrowserStreamState;
  /** Aborted when the last view leaves. */
  closed: AbortController;
};

const hubs = new Map<string, Hub>();

/** Key of the hub for browser `id` at `fps`. */
function hubKey(id: number, fps: number): string {
  return `${id}@${fps}`;
}

/** Byte offset of the first CRLFCRLF at or after `from`, or -1. */
function headerEnd(buffer: Uint8Array, from: number): number {
  for (let i = from; i + 3 < buffer.length; i++) {
    if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) {
      return i;
    }
  }
  return -1;
}

/**
 * takeFrames splits the complete JPEG parts off the front of an mpjpeg buffer (ffmpeg's
 * `--frame` parts, each with a Content-Length header) and returns them with the incomplete
 * remainder. A part without a Content-Length throws, since its end cannot be found.
 */
export function takeFrames(buffer: Uint8Array): {
  frames: Uint8Array<ArrayBuffer>[];
  rest: Uint8Array<ArrayBuffer>;
} {
  const frames: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (;;) {
    const end = headerEnd(buffer, offset);
    if (end < 0) {
      break;
    }
    const headers = new TextDecoder().decode(buffer.subarray(offset, end));
    const length = /content-length:\s*(\d+)/i.exec(headers);
    if (!length) {
      throw new Error(`stream part has no Content-Length: ${headers.trim()}`);
    }
    const start = end + 4;
    const stop = start + Number(length[1]);
    if (buffer.length < stop) {
      break;
    }
    frames.push(buffer.slice(start, stop));
    offset = stop;
  }
  return { frames, rest: buffer.slice(offset) };
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
 * `onFrame` after it. Throws why it dropped; a gap over STALL_MS aborts it as stalled.
 */
async function pump(hub: Hub, onFrame: () => void): Promise<void> {
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
  arm();
  try {
    const reader = (await nas.browserStream(hub.id, hub.fps, connection.signal)).getReader();
    let buffer = new Uint8Array(0);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error("Nas ended the stream");
      }
      const joined = new Uint8Array(buffer.length + value.length);
      joined.set(buffer);
      joined.set(value, buffer.length);
      const { frames, rest } = takeFrames(joined);
      buffer = rest;
      for (const jpeg of frames) {
        const frame = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
        if (hub.closed.signal.aborted) {
          frame.close();
          return;
        }
        arm();
        onFrame();
        publish(hub, { phase: "live", frame });
      }
    }
  } catch (err) {
    if (stalled) {
      throw new Error(`no frame for ${STALL_MS / 1000}s`);
    }
    throw err;
  } finally {
    window.clearTimeout(watchdog);
    hub.closed.signal.removeEventListener("abort", close);
    connection.abort();
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
 * Watch browser `id`'s stream at `fps`: `listener` gets the current state now and every change
 * after, including each frame, which it must draw before returning (the frame is released
 * when the next one arrives). Returns the unsubscribe; the last one closes the connection.
 */
export function subscribeBrowserStream(id: number, fps: number, listener: Listener): () => void {
  const key = hubKey(id, fps);
  let hub = hubs.get(key);
  if (!hub) {
    const created: Hub = { id, fps, listeners: new Set(), state: { phase: "opening" }, closed: new AbortController() };
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

/** Start a failed stream over for every view of browser `id` at `fps`. */
export function retryBrowserStream(id: number, fps: number): void {
  const hub = hubs.get(hubKey(id, fps));
  if (!hub || hub.state.phase !== "failed") {
    return;
  }
  publish(hub, { phase: "opening" });
  void run(hub);
}
