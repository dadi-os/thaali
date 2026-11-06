/**
 * Motion: the one place a duration, easing, spring or enter/exit shape is chosen. Components spread a preset
 * or import a token; none writes a number. The CSS counterparts (`--ease`, `--fast`, `--slow`, `--slower`,
 * `--breath` in the theme tokens) carry the same values for styles that animate in CSS.
 */

/** The easing every interface transition shares: quick off the mark, a long soft landing. */
export const EASE = [0.22, 0.61, 0.36, 1] as const;

/** An ease-in for things leaving: they pick up speed instead of braking. */
export const EASE_OUT = [0.4, 0, 1, 1] as const;

/** Hover, press and focus changes, in seconds. */
export const FAST_S = 0.18;

/** Interactive UI motion, snappy but readable, in seconds. */
export const SLOW_S = 0.32;

/** Longer transitions for content arriving or leaving a region, in seconds. */
export const SLOWER_S = 0.55;

/** One slow ambient pulse (a live marker breathing), in seconds. */
export const BREATH_S = 2.4;

/** How long a dismissed overlay takes to leave: faster than it arrived, in seconds. */
export const LEAVE_S = 0.16;

/** A spring for things that follow the pointer or settle into place: lively, no overshoot beyond a hair. */
export const SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 } as const;

/** A softer spring for a selection indicator sliding between options. */
export const SPRING_GLIDE = { type: "spring", stiffness: 420, damping: 38, mass: 0.85 } as const;

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

/** A thing arriving in place: fades and rises a few pixels. For list rows, cards and sections. */
export const RISE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  transition: { duration: SLOW_S, ease: EASE },
} as const;

/** A thing arriving as a plain fade, for content that must not move. */
export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  transition: { duration: SLOW_S, ease: EASE },
} as const;

/** The dim layer behind a dialog or sheet. */
export const SCRIM = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  transition: { duration: 0.22, ease: EASE },
} as const;

/** A dialog panel: scales up from slightly small and leaves a little quicker. */
export const DIALOG = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  transition: { duration: SLOW_S, ease: EASE },
} as const;

/** A side sheet: slides in from its edge. `from` is the side it enters from. */
export function sheetMotion(from: "left" | "right") {
  const sign = from === "right" ? 1 : -1;
  return {
    initial: { opacity: 0, x: 28 * sign },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 * sign, transition: { duration: LEAVE_S, ease: EASE_OUT } },
    transition: { duration: SLOW_S, ease: EASE },
  } as const;
}

/** A floating sheet: lifts off the edge it enters from, growing from slightly small to full size. */
export function floatingSheetMotion(from: "left" | "right") {
  const sign = from === "right" ? 1 : -1;
  return {
    initial: { opacity: 0, x: 48 * sign, scale: 0.97 },
    animate: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } },
    exit: { opacity: 0, x: 32 * sign, scale: 0.98, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  } as const;
}

/** A menu or popover surface opening at its anchor: grows from the anchor's corner. */
export const MENU = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  transition: { duration: 0.2, ease: EASE },
} as const;

/** A toast entering from the corner it is anchored to and leaving sideways. */
export const TOAST = {
  initial: { opacity: 0, x: 24, scale: 0.97 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 24, transition: { duration: LEAVE_S, ease: EASE_OUT } },
  transition: { duration: SLOW_S, ease: EASE },
} as const;

/** Delay in seconds between the entries of a list that arrives together, capped so a long list does not drag. */
export function stagger(index: number, step = 0.03, max = 0.3): number {
  return Math.min(index * step, max);
}
