/** Shared motion tokens — match CSS `--ease` / `--slow`. */
export const EASE = [0.22, 0.61, 0.36, 1] as const;
/** Interactive UI motion — snappy but readable. */
export const SLOW_S = 0.32;
/** Longer transitions for enter/exit presence. */
export const SLOWER_S = 0.55;
/** One slow ambient pulse (a live marker breathing) — match CSS `--breath`. */
export const BREATH_S = 2.4;

/**
 * Presence preset for content that arrives after its container is on screen (loaded
 * sections, new log rows): it eases open in height while fading in, and closes the
 * same way, so the surrounding panel grows and shrinks smoothly instead of jumping.
 * Spread onto a `motion` element that has `overflow: hidden`.
 */
export const REVEAL = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: {
    height: { duration: SLOWER_S, ease: EASE },
    opacity: { duration: SLOWER_S, ease: EASE, delay: 0.06 },
  },
} as const;
