/**
 * How a reply carries the message it answers, shared with Khisso: the quoted message's text as a
 * Markdown blockquote ahead of the reply, one `> ` line per line, then a blank line, then the reply.
 * The text is the message as it reads (no Markdown marks), cut to {@link QUOTED_CHARACTERS} with a
 * trailing `…`. The quote names no author. A message sent with files carries one box:// Markdown link
 * per file on lines of their own ahead of all of this.
 */

import { plainText } from "./format";

/** How much of a message a quote carries. */
export const QUOTED_CHARACTERS = 280;

/** The text a quote carries for `content`: what it reads as, cut to {@link QUOTED_CHARACTERS}. */
export function quoteText(content: string): string {
  const chars = Array.from(plainText(content));
  return chars.length > QUOTED_CHARACTERS ? `${chars.slice(0, QUOTED_CHARACTERS).join("")}…` : chars.join("");
}

/** `content` as the quote block that goes ahead of a reply: each line marked, then a blank line. */
export function encodeQuote(content: string): string {
  return `${quoteText(content)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}\n\n`;
}

/** The message text to send: the quote of `quoted` (when replying) ahead of `words`. */
export function withQuote(quoted: string | null, words: string): string {
  return quoted === null ? words : `${encodeQuote(quoted)}${words}`;
}

/** A message split into the file links it opens with, the quote after them, and the reply. */
export type ParsedReply = {
  /** The leading box:// link lines, one per line; "" when none (or when there is no quote, the links then stay in `body`). */
  files: string;
  /** The quoted text with its marks removed, or null when the message does not carry a quote. */
  quote: string | null;
  /** The reply; the whole text when there is no quote. */
  body: string;
};

const FILE_LINK = /^!?\[(?:\\.|[^\]\\])*\]\(box:\/\/[^)\s]*\)$/;

/**
 * Splits `text` into the file links, the quote and the reply. After lines made only of box:// links (and any
 * blank lines), a quote is a run of lines starting with `>`, followed by a blank line or the end of the text;
 * a blockquote or links in the reply itself are left as they are. Without a quote the whole text is the body.
 */
export function parseReply(text: string): ParsedReply {
  const lines = text.split("\n");
  let start = 0;
  while (start < lines.length && FILE_LINK.test(lines[start]!)) {
    start += 1;
  }
  const files = lines.slice(0, start).join("\n");
  while (start > 0 && start < lines.length && lines[start] === "") {
    start += 1;
  }
  let end = start;
  while (end < lines.length && lines[end]!.startsWith(">")) {
    end += 1;
  }
  if (end === start || (end < lines.length && lines[end] !== "")) {
    return { files: "", quote: null, body: text };
  }
  return {
    files,
    quote: lines
      .slice(start, end)
      .map((line) => line.replace(/^> ?/, ""))
      .join("\n"),
    body: lines.slice(end + 1).join("\n"),
  };
}

/** The first line of a quote that has words, for the card and the quote block. */
export function quoteLead(quote: string): string {
  return quote.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

/** Whether `quote`, as parsed from a reply, quotes `content`. */
export function quotes(quote: string, content: string): boolean {
  const squash = (text: string) => text.replace(/\s+/g, " ").trim();
  return squash(quote) === squash(quoteText(content));
}
