import type { ConnectionState } from "../shared/api/transport";
import { transport, usingMesh } from "../shared/api";

type Listener = (state: ConnectionState) => void;

let state: ConnectionState = "disconnected";
const listeners = new Set<Listener>();
let subscribed = false;
let bootstrapped = false;

function ensureSubscribed(): void {
  if (subscribed) {
    return;
  }
  subscribed = true;
  state = transport.connectionState();
  transport.onConnectionChange((next) => {
    state = next;
    for (const listener of listeners) {
      listener(state);
    }
  });
}

/** The current transport connection state. */
export function getConnectionState(): ConnectionState {
  ensureSubscribed();
  return state;
}

/** Listens for connection state changes; returns the unsubscribe function. */
export function subscribeConnection(listener: Listener): () => void {
  ensureSubscribed();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * On launch: detect provisioning only. Do not auto-connect to dadi —
 * join is explicit (onboarding or power overlay).
 */
export async function bootstrapMesh(): Promise<void> {
  ensureSubscribed();
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;
  if (!usingMesh) {
    await connectTransport();
    return;
  }
  const mesh = transport as {
    prepareProvisioning?: () => Promise<void>;
  };
  if (typeof mesh.prepareProvisioning === "function") {
    await mesh.prepareProvisioning();
  }
}

/** Connects the transport. An unprovisioned device is not an error here: the state shows onboarding. */
export async function connectTransport(): Promise<void> {
  ensureSubscribed();
  const { NotProvisionedError } = await import("../shared/api/errors");
  try {
    await transport.connect();
  } catch (err) {
    if (err instanceof NotProvisionedError) {
      return;
    }
    throw err;
  }
}

/** Disconnects the transport. */
export async function disconnectTransport(): Promise<void> {
  ensureSubscribed();
  await transport.disconnect();
}
