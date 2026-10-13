import { ApiError } from "../../api/errors";

/** What a failure view says about an error: the error's own words and, when a dadi service answered, which request failed. */
export type FailureFacts = {
  /** The error's message verbatim, or the thrown value itself when it is not an Error. */
  message: string;
  /** `hath · HTTP 502 · request 3f2a9c1e` when a service answered with an error status; null when none did. */
  origin: string | null;
};

/** The message and origin a failure view shows for a thrown value. */
export function failureFacts(err: unknown): FailureFacts {
  if (err instanceof ApiError) {
    return {
      message: err.message,
      origin: `${err.service} · HTTP ${err.status} · request ${err.requestId.slice(0, 8)}`,
    };
  }
  return { message: err instanceof Error ? err.message : String(err), origin: null };
}
