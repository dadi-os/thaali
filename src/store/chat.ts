import type {
  AttachmentSummary,
  DurableMessage,
  MessageAttachment,
  ThreadSummary,
} from "../types/hath";
import { pushToast } from "./toasts";

export type { MessageAttachment };

export type ChatMessage = {
  /** Stable row id for an optimistic send; kept when the server seq arrives. */
  id?: string;
  /** Server sequence; optimistic messages use negative values. */
  seq: number;
  /** True when from_agent_id === null (human → agent). */
  from_user: boolean;
  content: string;
  at: string;
  /** Optimistic, not yet confirmed by the server. */
  pending?: boolean;
  /** Send failed; eligible for retry or dismiss. */
  failed?: boolean;
  /** The real error from the failed send, shown on the bubble; cleared on retry. */
  sendError?: string;
  /**
   * Waiting locally because the conversation lane is busy. Not POSTed yet — can cancel.
   * Rendered after settled messages as a draft (reasoning-busy does not queue).
   */
  queued?: boolean;
  /** Outbound files, kept only while queued/pending so retry can re-POST; cleared once Hath confirms. */
  attachments?: MessageAttachment[];
  /** Files the message carries, as Hath stored them. */
  files?: AttachmentSummary[];
  /** Loaded from durable REST history; skip typewriter on open. */
  historical?: boolean;
};

export type Conversation = {
  agent_id: string;
  agent_name: string;
  last_message: string;
  last_at: string;
  from_user: boolean;
};

export type ChatOpen =
  | { kind: "list" }
  | { kind: "dadi" }
  | { kind: "agent"; agentId: string };

export type HistoryStatus = "idle" | "loading" | "ready" | "error";

type ChatState = {
  /** User-thread messages keyed by agent id. */
  threads: Record<string, ChatMessage[]>;
  /** Thread agents the human has talked to. */
  conversations: Conversation[];
  open: ChatOpen;
  historyStatus: HistoryStatus;
  historyError: string | null;
  /** Agent messages to you that arrived while their chat was not open, per agent; cleared when it opens. */
  unread: Record<string, number>;
};

type Listener = (state: ChatState) => void;

let state: ChatState = {
  threads: {},
  conversations: [],
  open: { kind: "list" },
  historyStatus: "idle",
  historyError: null,
  unread: {},
};
const listeners = new Set<Listener>();
let nextTempSeq = -1;
/** GET /threads has seeded the list once this session, so later loads can tell what is new. */
let threadsSeeded = false;

function emit(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

/** Confirmed first (by time, then seq); then in-flight pending; queued drafts last. */
function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    const rank = (m: ChatMessage) => {
      if (m.queued) {
        return 2;
      }
      if (m.seq < 0) {
        return 1;
      }
      return 0;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) {
      return ra - rb;
    }
    if (ra === 0) {
      const byTime = a.at.localeCompare(b.at);
      if (byTime !== 0) {
        return byTime;
      }
      return a.seq - b.seq;
    }
    if (a.seq < 0 && b.seq < 0) {
      return b.seq - a.seq;
    }
    return a.seq - b.seq;
  });
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => b.last_at.localeCompare(a.last_at));
}

function threadOf(agentId: string): ChatMessage[] {
  return state.threads[agentId] ?? [];
}

function setThread(agentId: string, messages: ChatMessage[]): void {
  state = {
    ...state,
    threads: { ...state.threads, [agentId]: messages },
  };
}

function hasConfirmedSeq(list: ChatMessage[], seq: number): boolean {
  return list.some((m) => m.seq === seq && m.seq >= 0 && !m.pending);
}

/**
 * Stable row id for a thread message.
 * Optimistic sends keep `id` across seq promotion so the row does not remount.
 * Historical and live seqs can still collide, so those fall back to seq plus time.
 */
export function messageKey(msg: ChatMessage): string {
  if (msg.id) {
    return msg.id;
  }
  return `${msg.historical ? "h" : "l"}-${msg.seq}-${msg.at}`;
}

/** Snapshot of chat store state (threads, list, open view, history). */
export function getChatState(): ChatState {
  return state;
}

/** Subscribe to chat store updates; returns unsubscribe. */
export function subscribeChat(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Show the conversation list. */
export function openList(): void {
  if (state.open.kind === "list") {
    return;
  }
  state = { ...state, open: { kind: "list" } };
  emit();
}

/** Open a user-thread for the given agent, clearing its unread count. */
export function openAgent(agentId: string): void {
  const here = state.open.kind === "agent" && state.open.agentId === agentId;
  if (here && state.unread[agentId] === undefined) {
    return;
  }
  const { [agentId]: _read, ...unread } = state.unread;
  state = { ...state, open: here ? state.open : { kind: "agent", agentId }, unread };
  emit();
}

/**
 * An agent's message to you arrived. Unless its chat is open, count it unread and toast
 * it (repeats from one agent fold into one toast); clicking the toast opens the chat.
 * The open chat never changes on its own.
 */
export function announceAgentMessage(agentId: string, agentName: string, content: string): void {
  if (state.open.kind === "agent" && state.open.agentId === agentId) {
    return;
  }
  state = { ...state, unread: { ...state.unread, [agentId]: (state.unread[agentId] ?? 0) + 1 } };
  emit();
  pushToast({
    key: `message:${agentId}`,
    tone: "info",
    title: agentName,
    body: content.replace(/\s+/g, " ").trim(),
    target: { kind: "chat", agentId },
  });
}

/** Open the Talk to Dadi composer (not an agent thread). */
export function openDadi(): void {
  if (state.open.kind === "dadi") {
    return;
  }
  state = { ...state, open: { kind: "dadi" } };
  emit();
}

/** Record history fetch progress. Failed loads keep any threads already in memory. */
export function setHistoryState(
  status: HistoryStatus,
  error: string | null = null,
): void {
  if (state.historyStatus === status && state.historyError === error) {
    return;
  }
  state = { ...state, historyStatus: status, historyError: error };
  emit();
}

/**
 * On mesh disconnect: drop optimistic/pending/queued only.
 * Durable history stays — messages survive Hath restart.
 */
export function clearLiveChat(): void {
  const threads: Record<string, ChatMessage[]> = {};
  for (const [agentId, msgs] of Object.entries(state.threads)) {
    const kept = msgs.filter((m) => m.seq >= 0 && !m.pending && !m.queued && !m.failed);
    if (kept.length > 0) {
      threads[agentId] = kept;
    }
  }
  state = {
    ...state,
    threads,
    historyStatus: "idle",
    historyError: null,
  };
  emit();
}

/** Wipe threads and conversations (tests / full local reset). */
export function resetChatStore(): void {
  threadsSeeded = false;
  state = {
    threads: {},
    conversations: [],
    open: { kind: "list" },
    historyStatus: "idle",
    historyError: null,
    unread: {},
  };
  emit();
}

/** Replace conversation list from GET /threads, announcing agent messages it shows that live events missed. */
export function seedConversations(threads: ThreadSummary[]): void {
  const missed = missedAgentMessages(threads);
  threadsSeeded = true;
  state = {
    ...state,
    conversations: sortConversations(threads.map((t) => ({ ...t }))),
  };
  emit();
  for (const t of missed) {
    announceAgentMessage(t.agent_id, t.agent_name, t.last_message);
  }
}

/**
 * Threads in a fresh GET /threads whose latest message is an agent's and newer than the
 * list holds, which live events missed (SSE has no replay). None before the first seed,
 * since that load has nothing to compare against.
 */
function missedAgentMessages(threads: ThreadSummary[]): ThreadSummary[] {
  if (!threadsSeeded) {
    return [];
  }
  const ours = new Map(state.conversations.map((c) => [c.agent_id, c]));
  return threads.filter((t) => {
    const mine = ours.get(t.agent_id);
    return !t.from_user && (!mine || t.last_at > mine.last_at);
  });
}

/**
 * Merge a fresh GET /threads into the list. Hath decides which conversations exist; for
 * each, whichever of its summary or ours is newer wins, so a refresh catches previews a
 * dropped SSE event missed without undoing one SSE just delivered. An agent's message
 * found this way is announced as if it had arrived live.
 */
export function mergeConversations(threads: ThreadSummary[]): void {
  const ours = new Map(state.conversations.map((c) => [c.agent_id, c]));
  const missed = missedAgentMessages(threads);
  const next = threads.map((t) => {
    const mine = ours.get(t.agent_id);
    return mine && mine.last_at > t.last_at ? mine : { ...t };
  });
  const changed =
    next.length !== state.conversations.length ||
    next.some((c) => {
      const mine = ours.get(c.agent_id);
      return !mine || mine.last_at !== c.last_at || mine.last_message !== c.last_message || mine.agent_name !== c.agent_name;
    });
  if (!changed) {
    return;
  }
  state = { ...state, conversations: sortConversations(next) };
  emit();
  for (const t of missed) {
    announceAgentMessage(t.agent_id, t.agent_name, t.last_message);
  }
}

/** Insert or refresh a conversation summary if `last_at` is newer than what we have. */
export function upsertConversation(conv: Conversation): void {
  const existing = state.conversations.find((c) => c.agent_id === conv.agent_id);
  if (existing && existing.last_at > conv.last_at) {
    return;
  }
  const rest = state.conversations.filter((c) => c.agent_id !== conv.agent_id);
  const next: Conversation = {
    ...conv,
    agent_name:
      conv.agent_name !== conv.agent_id
        ? conv.agent_name
        : (existing?.agent_name ?? conv.agent_name),
  };
  state = {
    ...state,
    conversations: sortConversations([next, ...rest]),
  };
  emit();
}

/** Drop a retired agent's conversation from the list; its history stays loadable by id. */
export function removeConversation(agentId: string): void {
  state = {
    ...state,
    conversations: state.conversations.filter((c) => c.agent_id !== agentId),
  };
  emit();
}

/** Append if this live/optimistic seq is new; no-op on duplicate confirmed seq. */
export function appendMessage(agentId: string, msg: ChatMessage): void {
  const current = threadOf(agentId);
  if (msg.seq >= 0 && hasConfirmedSeq(current, msg.seq)) {
    return;
  }
  setThread(agentId, sortMessages([...current, msg]));
  emit();
}

/** Insert an optimistic user message; returns its temporary (negative) seq. */
export function addOptimistic(
  agentId: string,
  content: string,
  opts?: {
    queued?: boolean;
    attachments?: MessageAttachment[];
  },
): number {
  const seq = nextTempSeq;
  nextTempSeq -= 1;
  const queued = Boolean(opts?.queued);
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    seq,
    from_user: true,
    content,
    at: new Date().toISOString(),
    pending: true,
    queued: queued || undefined,
    attachments: opts?.attachments,
  };
  setThread(agentId, sortMessages([...threadOf(agentId), msg]));
  emit();
  return seq;
}

/** Promote a temp seq to the server seq, take the stored files, and clear pending. */
export function resolveOptimistic(
  agentId: string,
  tempSeq: number,
  realSeq: number,
  files: AttachmentSummary[],
): void {
  const current = threadOf(agentId);
  if (hasConfirmedSeq(current, realSeq)) {
    setThread(
      agentId,
      sortMessages(current.filter((m) => m.seq !== tempSeq)),
    );
    emit();
    return;
  }
  setThread(
    agentId,
    sortMessages(
      current.map((m) =>
        m.seq === tempSeq
          ? {
              ...m,
              seq: realSeq,
              pending: false,
              failed: false,
              attachments: undefined,
              files,
            }
          : m,
      ),
    ),
  );
  emit();
}

/** Mark an optimistic message as failed with the send's real error (eligible for retry/dismiss). */
export function markFailed(agentId: string, tempSeq: number, sendError: string): void {
  setThread(
    agentId,
    threadOf(agentId).map((m) =>
      m.seq === tempSeq ? { ...m, pending: false, failed: true, sendError } : m,
    ),
  );
  emit();
}

/** Remove a message from a thread by seq (cancel draft or dismiss failed). */
export function removeMessage(agentId: string, seq: number): void {
  setThread(
    agentId,
    threadOf(agentId).filter((m) => m.seq !== seq),
  );
  emit();
}

/** Clear failed/queued and set pending again before a retry POST. */
export function markPending(agentId: string, tempSeq: number): void {
  setThread(
    agentId,
    threadOf(agentId).map((m) =>
      m.seq === tempSeq
        ? { ...m, pending: true, failed: false, sendError: undefined, queued: undefined }
        : m,
    ),
  );
  emit();
}

/** Queued (not yet POSTed) messages for an agent, oldest first. */
export function listQueuedThread(agentId: string): ChatMessage[] {
  return threadOf(agentId).filter((m) => m.queued && m.from_user);
}

/**
 * User-thread filter: the human is null on one side.
 * Agent↔agent traffic stays out of the chat sidebar.
 */
export function isUserThreadMessage(
  fromAgentId: string | null,
  toAgentId: string | null,
): boolean {
  return fromAgentId === null || toAgentId === null;
}

/**
 * Conversation key for a user-thread message: the non-null agent.
 * User → agent uses the recipient; agent → user uses the sender.
 */
export function threadAgentId(
  fromAgentId: string | null,
  toAgentId: string | null,
): string | null {
  if (fromAgentId === null && toAgentId !== null) {
    return toAgentId;
  }
  if (toAgentId === null && fromAgentId !== null) {
    return fromAgentId;
  }
  return null;
}

/**
 * Merge durable GET /agents/:id/messages into a thread.
 * Preserves in-flight optimistic rows; confirmed seqs are replaced by durable rows.
 *
 * Rows already on screen keep their row key so a refresh never remounts them,
 * and a durable user row that lands before its POST resolves adopts the
 * in-flight bubble. With `live`, rows we had not seen yet (missed SSE) enter
 * like live messages; otherwise they are historical and render static.
 */
export function hydrateThreadMessages(
  agentId: string,
  messages: DurableMessage[],
  opts?: { live?: boolean },
): void {
  const current = threadOf(agentId);
  let pending = current.filter(
    (m) => m.seq < 0 || m.pending || m.queued || m.failed,
  );
  const confirmed = new Map<number, ChatMessage>();
  for (const m of current) {
    if (m.seq >= 0 && !m.pending && !m.queued && !m.failed) {
      confirmed.set(m.seq, m);
    }
  }
  let changed = !state.threads[agentId];
  const bySeq = new Map<number, ChatMessage>();
  for (const row of messages) {
    const seen = confirmed.get(row.seq);
    if (seen && seen.content === row.content) {
      bySeq.set(row.seq, seen);
      continue;
    }
    changed = true;
    const inFlight =
      !seen && row.from_agent_id === null
        ? pending.find(
            (m) =>
              m.pending && m.from_user && !m.queued && m.content === row.content,
          )
        : undefined;
    if (inFlight) {
      pending = pending.filter((m) => m !== inFlight);
    }
    bySeq.set(row.seq, {
      id: inFlight ? messageKey(inFlight) : seen ? messageKey(seen) : row.id,
      seq: row.seq,
      from_user: row.from_agent_id === null,
      content: row.content,
      files: row.attachments,
      at: row.created_at,
      historical: seen ? seen.historical : opts?.live ? undefined : true,
    });
  }
  for (const [seq, m] of confirmed) {
    if (!bySeq.has(seq)) {
      bySeq.set(seq, m);
    }
  }
  if (!changed) {
    return;
  }
  setThread(agentId, sortMessages([...bySeq.values(), ...pending]));
  emit();
}


/**
 * If a pending optimistic row has the same content, resolve it to realSeq.
 * Otherwise, if exactly one in-flight (non-queued) user pending exists, resolve
 * that. Else append.
 */
export function ingestLiveMessage(agentId: string, msg: ChatMessage): void {
  const current = threadOf(agentId);
  if (hasConfirmedSeq(current, msg.seq)) {
    return;
  }
  if (msg.from_user) {
    const exact = current.find(
      (m) =>
        m.pending && m.from_user && !m.queued && m.content === msg.content,
    );
    if (exact) {
      resolveOptimistic(agentId, exact.seq, msg.seq, msg.files ?? []);
      return;
    }
    const inFlight = current.filter(
      (m) => m.pending && m.from_user && !m.queued,
    );
    if (inFlight.length === 1) {
      resolveOptimistic(agentId, inFlight[0]!.seq, msg.seq, msg.files ?? []);
      return;
    }
  }
  appendMessage(agentId, msg);
}
