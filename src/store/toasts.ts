/** Most toasts on screen at once; a new one past this pushes out the oldest. */
const MAX_TOASTS = 4;

export type ToastTone = "info" | "error";

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
  /** Clicking the toast does this (open a chat, a page); null makes it a plain notice. */
  onOpen: (() => void) | null;
};

/** What a caller supplies; the store fills in id, count and time. */
export type ToastInput = Pick<Toast, "key" | "tone" | "title"> & {
  body?: string;
  onOpen?: () => void;
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
    onOpen: input.onOpen ?? null,
  };
  const existing = toasts.find((t) => t.key === input.key);
  if (existing) {
    toasts = toasts.map((t) => (t === existing ? { ...t, ...fields, count: t.count + 1 } : t));
  } else {
    toasts = [...toasts, { id: nextId++, key: input.key, count: 1, ...fields }].slice(-MAX_TOASTS);
  }
  emit();
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
