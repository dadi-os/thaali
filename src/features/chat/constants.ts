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

/** The narrowest the conversation rail can be dragged, in px. */
export const RAIL_MIN_PX = 260;
/** The widest the conversation rail can be dragged, in px. */
export const RAIL_MAX_PX = 560;
/** The rail's width before it has been dragged, in px, and the most it takes of a narrow window. */
export const RAIL_DEFAULT_PX = 300;
/** What the main area always keeps when the rail is dragged wide, in px. */
export const MAIN_MIN_PX = 640;
/** How a window's width is shared before the rail is dragged: the rail takes this fraction up to {@link RAIL_DEFAULT_PX}. */
export const RAIL_DEFAULT_SHARE = 0.32;
/** How far an arrow key moves the rail's edge, in px, and with Shift. */
export const RAIL_KEY_STEP_PX = 16;
export const RAIL_KEY_STEP_SHIFT_PX = 64;
/** Where the dragged width is kept between launches. */
export const RAIL_WIDTH_KEY = "thaali.railWidth";
/** How long a pinned helper preview stays after its task stops being active, so a status that flaps does not unmount and remount it, in ms. */
export const PIN_LINGER_MS = 4000;
