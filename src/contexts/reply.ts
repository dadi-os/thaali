/**
 * Asks the open thread's composer to take some words: a message's "Reply" action quotes it, and a session's "Message" action
 * brings what Ankur means to say. The sidebar puts them ahead of the draft and focuses the field each time the count rises.
 */

type Listener = () => void;

let requests = 0;
let quoted = "";
let quotes = true;
const listeners = new Set<Listener>();

/** How many replies have been asked for. */
export function getReplyRequests(): number {
  return requests;
}

/** The text the latest request brings, and whether it is a quote of another message or words of Ankur's own. */
export function getReplyText(): { text: string; quote: boolean } {
  return { text: quoted, quote: quotes };
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
  quotes = true;
  requests += 1;
  for (const listener of listeners) {
    listener();
  }
}

/** Asks the open thread's composer to start with `text` as Ankur's own words, ahead of what it already holds. */
export function requestCompose(text: string): void {
  quoted = text;
  quotes = false;
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
