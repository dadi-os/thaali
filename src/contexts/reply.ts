/**
 * Asks the open thread's composer to take something: a message's "Reply" action hands it the message to quote, and a session's
 * "Message" action brings what Ankur means to say. The sidebar acts on each request and focuses the field each time the count rises.
 */

import type { ChatMessage } from "./chat";

type Listener = () => void;

let requests = 0;
let words = "";
let quoting: ChatMessage | null = null;
const listeners = new Set<Listener>();

/** How many replies have been asked for. */
export function getReplyRequests(): number {
  return requests;
}

/** What the latest request brings: a message to quote, or words of Ankur's own. */
export function getReplyRequest(): { message: ChatMessage | null; text: string } {
  return { message: quoting, text: words };
}

/** Listens for reply requests; returns the unsubscribe function. */
export function subscribeReply(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announce(): void {
  requests += 1;
  for (const listener of listeners) {
    listener();
  }
}

/** Asks the open thread's composer to start a reply to `message`. */
export function requestReply(message: ChatMessage): void {
  quoting = message;
  words = "";
  announce();
}

/** Asks the open thread's composer to start with `text` as Ankur's own words, ahead of what it already holds. */
export function requestCompose(text: string): void {
  quoting = null;
  words = text;
  announce();
}
