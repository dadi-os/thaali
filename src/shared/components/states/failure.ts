import { ApiError } from "../../api/errors";

/** The `message` field of a service's `{ error: { type, message } }` body inside an ApiError's text. */
const SERVER_MESSAGE = /"message":"((?:\\.|[^"\\])*)"/;

/** What a failure view says about an error: the error's own words and, when a dadi service answered, which request failed. */
export type FailureFacts = {
  /** The service's own message when its error body carries one, else the error's message verbatim, or the thrown value itself when it is not an Error. */
  message: string;
  /** The whole error text, status line and body included, for a hover. */
  raw: string;
  /** `hath · HTTP 502 · request 3f2a9c1e` when a service answered with an error status; null when none did. */
  origin: string | null;
};

/** The message and origin a failure view shows for a thrown value. */
export function failureFacts(err: unknown): FailureFacts {
  if (err instanceof ApiError) {
    const server = err.message.match(SERVER_MESSAGE)?.[1];
    return {
      message: server === undefined ? err.message : server.replace(/\\"/g, '"'),
      raw: err.message,
      origin: `${err.service} · HTTP ${err.status} · request ${err.requestId.slice(0, 8)}`,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { message, raw: message, origin: null };
}
