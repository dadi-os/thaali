/**
 * Asks the open thread's composer to start a reply: a message's "Reply" action quotes it and the sidebar
 * puts the quote ahead of the draft and focuses the field each time the count rises.
 */

type Listener = () => void;

let requests = 0;
let quoted = "";
const listeners = new Set<Listener>();

/** How many replies have been asked for. */
export function getReplyRequests(): number {
  return requests;
}

/** The text of the message the latest reply quotes. */
export function getReplyQuote(): string {
  return quoted;
}

/** Listens for reply requests; returns the unsubscribe function. */
export function subscribeReply(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Asks the open thread's composer to start a reply that quotes `text`. */
export function requestReply(text: string): void {
  quoted = text;
  requests += 1;
  for (const listener of listeners) {
    listener();
  }
}

/** `text` as a Markdown quote, each line marked, with a blank line after it for the reply to start on. */
export function asQuote(text: string): string {
  return `${text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n")}\n\n`;
}
