import { ApiError } from "../shared/api/errors";

/** Most toasts on screen at once; a new one past this pushes out the oldest. */
const MAX_TOASTS = 4;

export type ToastTone = "info" | "error";

/** Where clicking a toast takes you. */
export type ToastTarget =
  /** The agent's chat in the sidebar. */
  | { kind: "chat"; agentId: string }
  /**
   * The log explorer filtered to `service` and the text `q` around `at`, with the line
   * nearest `at` pinned open (none when `q` is empty, which only narrows to the service).
   */
  | { kind: "logs"; service: string; q: string; at: string }
  /** The house page with the device's controls open. */
  | { kind: "ghar"; deviceId: string }
  | { kind: "timeline" };

/** One bottom-right notice: an agent's message, a system failure, or something that happened around the house. */
export type Toast = {
  id: number;
  /** Toasts pushed with the same key fold into one that counts the repeats instead of stacking. */
  key: string;
  tone: ToastTone;
  title: string;
  body: string | null;
  /** How many times this key was pushed while the toast was up. */
  count: number;
  /** When it was last pushed (ms since epoch); a repeat restarts its time on screen. */
  at: number;
  /** Where clicking the toast goes; null makes it a plain notice. */
  target: ToastTarget | null;
};

/** What a caller supplies; the store fills in id, count and time. */
export type ToastInput = Pick<Toast, "key" | "tone" | "title"> & {
  body?: string;
  target?: ToastTarget | null;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener(toasts);
  }
}

/** Toasts on screen, oldest first. */
export function getToasts(): Toast[] {
  return toasts;
}

/** Listens for toast changes; returns the unsubscribe function. */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Show a toast, or fold it into the one already up under its key (latest text, count + 1, time restarted). */
export function pushToast(input: ToastInput, now: number = Date.now()): void {
  const fields = {
    tone: input.tone,
    title: input.title,
    body: input.body ?? null,
    at: now,
    target: input.target ?? null,
  };
  const existing = toasts.find((t) => t.key === input.key);
  if (existing) {
    toasts = toasts.map((t) => (t === existing ? { ...t, ...fields, count: t.count + 1 } : t));
  } else {
    toasts = [...toasts, { id: nextId++, key: input.key, count: 1, ...fields }].slice(-MAX_TOASTS);
  }
  emit();
}

/**
 * Where a failure's own log line is: the service's line for the request id when a service
 * answered with an error. Null when no service answered (a network failure, or a failure
 * in the app itself), since then there is no server line to show.
 */
export function failureTarget(err: unknown): ToastTarget | null {
  return err instanceof ApiError ? { kind: "logs", service: err.service, q: err.requestId, at: err.at } : null;
}

/** Take a toast off screen. */
export function dismissToast(id: number): void {
  if (!toasts.some((t) => t.id === id)) {
    return;
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Clear every toast (tests). */
export function resetToasts(): void {
  toasts = [];
  emit();
}
