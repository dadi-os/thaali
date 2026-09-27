import { useCallback, useEffect, useRef, useState } from "react";

/** Point relative to the details container where the popover anchors, and the radius it clears. */
export type DetailsAnchor = { x: number; y: number; radius: number };

/** Open delay after the pointer lands on an item, so passing over it does not flash. */
const OPEN_DELAY_MS = 160;
/** Close delay after the pointer leaves, so it can travel onto the popover. */
const CLOSE_DELAY_MS = 320;

/** Hover-to-preview state for one details popover. */
export type HoverDetails = {
  /** Item whose details are open, or null. */
  id: string | null;
  anchor: DetailsAnchor | null;
  /** Pointer entered an item: open after a short delay, or keep it open if it is already showing. */
  hover: (id: string, at: DetailsAnchor) => void;
  /** Pointer left an item or the popover: close after a short delay. */
  leave: () => void;
  /** Pointer reached the popover: cancel a pending close. */
  keep: () => void;
  close: () => void;
};

/**
 * Timing for a hover details popover.
 * Resets whenever `resetKey` changes (e.g. on page re-entry).
 */
export function useHoverDetails(resetKey: string): HoverDetails {
  const [state, setState] = useState<{ id: string | null; anchor: DetailsAnchor | null }>({
    id: null,
    anchor: null,
  });
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const idRef = useRef<string | null>(null);
  idRef.current = state.id;

  const clearTimers = useCallback(() => {
    for (const timer of [openTimer, closeTimer]) {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    }
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setState({ id: null, anchor: null });
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => close(), [resetKey, close]);

  const hover = useCallback(
    (id: string, at: DetailsAnchor) => {
      clearTimers();
      if (idRef.current === id) {
        return;
      }
      openTimer.current = window.setTimeout(() => {
        setState({ id, anchor: at });
      }, OPEN_DELAY_MS);
    },
    [clearTimers],
  );

  const leave = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      setState({ id: null, anchor: null });
    }, CLOSE_DELAY_MS);
  }, [clearTimers]);

  const keep = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  return { ...state, hover, leave, keep, close };
}
