/** Pure helpers for chat sidebar lane/message presentation. */

import { messageKey, type ChatMessage } from "../../store/chat";

/** Split messages into settled and queued (local hold while conversation busy). */
export function partitionByQueued(messages: ChatMessage[]): {
  settled: ChatMessage[];
  queued: ChatMessage[];
} {
  return {
    settled: messages.filter((msg) => !msg.queued),
    queued: messages.filter((msg) => msg.queued),
  };
}

/**
 * First call (`seed`) records the open-thread snapshot so those rows stay still.
 * Later rows that were not in the snapshot are live — except `historical`
 * hydrations that land after open (agent log fetch), which must not typewriter.
 */
export function trackIncoming(
  known: Set<string>,
  live: Set<string>,
  messages: ChatMessage[],
  seed: boolean,
): void {
  for (const msg of messages) {
    const key = messageKey(msg);
    if (seed) {
      known.add(key);
      continue;
    }
    if (known.has(key)) {
      continue;
    }
    known.add(key);
    if (!msg.historical) {
      live.add(key);
    }
  }
}

/**
 * Agent replies that follow a routed message (by its seq) in that agent's
 * thread, up to your next message there. Empty until the routed message is in
 * the thread.
 */
export function repliesTo(thread: ChatMessage[], seq: number): ChatMessage[] {
  const start = thread.findIndex((m) => m.from_user && m.seq === seq);
  if (start < 0) {
    return [];
  }
  const replies: ChatMessage[] = [];
  for (const m of thread.slice(start + 1)) {
    if (m.from_user) {
      break;
    }
    replies.push(m);
  }
  return replies;
}
