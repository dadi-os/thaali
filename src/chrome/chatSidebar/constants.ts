/** Chat sidebar layout and timing constants. */

export const NEAR_BOTTOM_PX = 80;
export const TEXTAREA_MAX_PX = 160;
/** Hath GET /agents/:id/messages max when opening a thread. */
export const HISTORY_LOG_LIMIT = 200;
/** Breathing room between the last message and the top of the composer. */
export const COMPOSER_GAP = 16;
/** Refresh interval for the conversation list's previews; SSE has no replay, so this catches missed messages. */
export const LIST_REFRESH_MS = 5_000;
/** Refresh interval for the open thread; SSE has no replay, so this catches missed messages. */
export const THREAD_REFRESH_MS = 3_000;
