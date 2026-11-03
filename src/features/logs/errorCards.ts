import type { NasLogEntry } from "../../shared/api/nas";
import type { LogFocus } from "./logLines";

/** One recent error line as the System page's ERRORS card draws it. */
export type ErrorCard = {
  /** The line's identity: its time, service and message. */
  key: string;
  /** The service that logged it. */
  service: string;
  /** When it was logged (ISO). */
  time: string;
  /** The human cause: the provider's own message when the line carries one, else the line's message. */
  title: string;
  /** The line's message when the cause says something other than it, else null. */
  context: string | null;
  /** The provider or HTTP status the cause came with, when it names one. */
  code: number | null;
  /** The request the error came from as what was asked and how it went ("POST /wake · 529 · 4210 ms"), else null. */
  request: string | null;
  /** Text a log line of this error contains, so the logs can be narrowed to it. */
  q: string;
};

/** The fields of a log line's raw JSON that the cards read. */
type RawError = {
  err?: { message?: string };
  error?: string;
  request_id?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
};

/** A log line's raw record parsed as JSON; null when the line has none or it is plain text. */
function parseRaw(entry: NasLogEntry): RawError | null {
  if (!entry.raw) {
    return null;
  }
  try {
    return JSON.parse(entry.raw) as RawError;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

/**
 * The human message inside an Anthropic or SDK error blob such as
 * `Error code: 400 - {'type': 'error', 'error': {'message': 'Your credit…'}}`: the innermost quoted `message`, else the
 * text after the code, with the status code when the blob names one.
 */
export function humanizeProviderBlob(text: string): { message: string; code: number | null } {
  const codeMatch = text.match(/\b(?:Error code|status(?:Code)?):\s*(\d{3})\b/i);
  const code = codeMatch ? Number(codeMatch[1]) : null;
  const messages = [...text.matchAll(/['"]message['"]\s*:\s*['"]([^'"]+)['"]/g)];
  const innermost = messages[messages.length - 1]?.[1];
  if (innermost) {
    return { message: innermost, code };
  }
  const stripped = text.replace(/^Error code:\s*\d+\s*-\s*/i, "").trim();
  return { message: stripped || text, code };
}

/** A line's request as what was asked and how it went, from the fields the services log with it; null when the line names no request. */
export function requestSummary(raw: RawError | null): string | null {
  if (raw === null || !raw.method || !raw.path || raw.status === undefined) {
    return null;
  }
  const outcome = raw.duration_ms === undefined ? String(raw.status) : `${raw.status} · ${raw.duration_ms} ms`;
  return `${raw.method} ${raw.path} · ${outcome}`;
}

/** The card for one error line. */
export function errorCard(entry: NasLogEntry): ErrorCard {
  const raw = parseRaw(entry);
  const context = entry.msg.trim() || null;
  const blob = raw?.err?.message ?? raw?.error ?? null;
  const cause = blob === null ? null : humanizeProviderBlob(blob);
  const same = cause === null || cause.message === context;
  return {
    key: `${entry.time}|${entry.service}|${entry.msg}`,
    service: entry.service,
    time: entry.time,
    title: same ? (context ?? "error") : cause.message,
    context: same ? null : context,
    code: cause === null ? null : cause.code,
    request: requestSummary(raw),
    q: raw?.request_id ?? entry.msg,
  };
}

/** The log focus that opens a card's line in the logs: its service, a text only it contains, and its time. */
export function errorFocus(card: ErrorCard, key: string): LogFocus {
  return { service: card.service, q: card.q, at: card.time, key };
}
