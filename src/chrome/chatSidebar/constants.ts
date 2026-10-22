/** Chat sidebar layout and timing constants. */

export const NEAR_BOTTOM_PX = 80;
export const TEXTAREA_MAX_PX = 160;
/** Hath GET /agents/:id/messages max when opening a thread. */
export const HISTORY_LOG_LIMIT = 200;
/** Breathing room between the last message and the top of the composer. */
export const COMPOSER_GAP = 16;
/** Refresh interval for the conversation list's previews; SSE has no replay, so this catches a message a silently stalled stream missed. Returning to the window refreshes at once. */
export const LIST_REFRESH_MS = 30_000;
/** Refresh interval for the open thread; SSE has no replay, so this catches a message a silently stalled stream missed. Returning to the window refreshes at once. */
export const THREAD_REFRESH_MS = 30_000;
