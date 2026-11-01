import { ApiError } from "../shared/api/errors";
import type { ConnectionState, Transport } from "../shared/api/transport";
import { Fixtures, type Host } from "./fixtures/routes";
import type { Scenario } from "./scenario";

/** How long a fixture answer takes, so a loading state is seen before the data. */
const LATENCY_MS = 160;
/** When the `blip` scenario loses the mesh after connecting. */
const BLIP_AFTER_MS = 4_000;
/** Services the `module-offline` scenario answers 502 for. */
const DOWN_IN_MODULE_OFFLINE: readonly Host[] = ["ghar", "yaad", "chaavi"];

type Stream = { host: Host; path: string; onEvent: (data: unknown) => void; onClose?: () => void };

declare global {
  interface Window {
    /** Dev-only handle: push an event onto a fixture event stream. */
    __fixtures?: { emit: (host: Host, path: string, data: unknown) => void; close: (host: Host, path: string) => void };
  }
}

function hostOf(baseUrl: string): Host {
  const name = new URL(baseUrl).hostname.split(".")[0];
  if (name === "hath" || name === "nas" || name === "yaad" || name === "ghar" || name === "chaavi") {
    return name;
  }
  throw new Error(`fixtures: unknown service host ${baseUrl}`);
}

function apiError(baseUrl: string, status: number, text: string): ApiError {
  return new ApiError(`HTTP ${status}: ${text}`, baseUrl, crypto.randomUUID(), status);
}

/**
 * A Transport that answers from typed fixtures instead of the mesh: dev-only, chosen with
 * `?fixtures=<scenario>`. It never touches the network, so every page can be reached in
 * every state (loading, offline, a module down, errors, empty, long text, many rows, a task
 * asking for Ankur). Event streams stay open and quiet until `window.__fixtures.emit` pushes
 * one, which is how the visual loop provokes a toast or a live refetch.
 */
export class FixtureTransport implements Transport {
  private state: ConnectionState = "disconnected";
  private active = false;
  private readonly listeners = new Set<(state: ConnectionState) => void>();
  private readonly streams = new Set<Stream>();
  private readonly fixtures: Fixtures;
  private blipTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly scenario: Scenario) {
    this.fixtures = new Fixtures(scenario);
    window.__fixtures = {
      emit: (host, path, data) => {
        for (const stream of this.streams) {
          if (stream.host === host && stream.path === path) {
            stream.onEvent(data);
          }
        }
      },
      close: (host, path) => {
        for (const stream of [...this.streams]) {
          if (stream.host === host && stream.path === path) {
            this.streams.delete(stream);
            stream.onClose?.();
          }
        }
      },
    };
  }

  isActive(): boolean {
    return this.active;
  }

  connectionState(): ConnectionState {
    return this.state;
  }

  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(next: ConnectionState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  async connect(): Promise<void> {
    this.active = true;
    if (this.scenario === "offline") {
      this.setState("disconnected");
      return;
    }
    this.setState("connected");
    if (this.scenario === "blip") {
      this.blipTimer = setTimeout(() => this.setState("reconnecting"), BLIP_AFTER_MS);
    }
  }

  async disconnect(): Promise<void> {
    this.active = false;
    if (this.blipTimer !== null) {
      clearTimeout(this.blipTimer);
    }
    this.setState("disconnected");
  }

  async request<T>(opts: {
    baseUrl: string;
    path: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    bodyText?: string;
    responseType?: "json" | "text" | "blob";
  }): Promise<T> {
    if (!this.active || this.state === "disconnected") {
      throw new Error("Not connected");
    }
    const host = hostOf(opts.baseUrl);
    if (this.scenario === "loading") {
      return new Promise<T>(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    if (this.state === "reconnecting") {
      throw new Error("Network error: the mesh is reconnecting");
    }
    if (this.scenario === "errors") {
      throw apiError(opts.baseUrl, 500, `${host} failed while handling ${opts.method} ${opts.path}`);
    }
    if (this.scenario === "module-offline" && DOWN_IN_MODULE_OFFLINE.includes(host)) {
      throw apiError(opts.baseUrl, 502, `${host}.dadi is not answering`);
    }
    return this.fixtures.respond({ host, method: opts.method, path: opts.path, body: opts.body }) as T;
  }

  mediaUrl(opts: { baseUrl: string; path: string }): string {
    return new URL(opts.path, opts.baseUrl).toString();
  }

  async openStream(opts: { baseUrl: string; path: string; signal: AbortSignal }): Promise<ReadableStream<Uint8Array>> {
    return new Promise((_resolve, reject) => {
      opts.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  }

  stream(opts: { baseUrl: string; path: string; onEvent: (data: unknown) => void; onClose?: () => void }): () => void {
    const entry: Stream = { host: hostOf(opts.baseUrl), path: opts.path, onEvent: opts.onEvent, onClose: opts.onClose };
    this.streams.add(entry);
    return () => {
      this.streams.delete(entry);
    };
  }
}
