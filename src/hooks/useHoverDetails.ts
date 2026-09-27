import { useCallback, useEffect, useRef, useState } from "react";

/** Point relative to the details container where the popover anchors, and the radius it clears. */
export type DetailsAnchor = { x: number; y: number; radius: number };

/** Open delay after the pointer lands on an item, so passing over it does not flash. */
const OPEN_DELAY_MS = 160;
/** Close delay after the pointer leaves, so a brief slip off the item or panel is forgiven. */
const CLOSE_DELAY_MS = 280;

/** Hover-to-preview state for one details popover. */
export type HoverDetails = {
  /** The popover is showing. */
  open: boolean;
  /**
   * Item the popover shows, kept after it closes so the panel can animate away with
   * its content; null until the first hover.
   */
  id: string | null;
  /** Where that item sits; null until the first hover. */
  anchor: DetailsAnchor | null;
  /** Pointer entered an item: open after a short delay, or keep it open if it is already showing. */
  hover: (id: string, at: DetailsAnchor) => void;
  /** Pointer left the item and its popover: close after a short delay. */
  leave: () => void;
  /** Pointer is on the item or its popover: cancel a pending close. */
  keep: () => void;
  close: () => void;
};

/**
 * Timing for a hover details popover.
 * Resets whenever `resetKey` changes (e.g. on page re-entry).
 */
export function useHoverDetails(resetKey: string): HoverDetails {
  const [state, setState] = useState<{
    open: boolean;
    id: string | null;
    anchor: DetailsAnchor | null;
  }>({ open: false, id: null, anchor: null });
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const shown = useRef<string | null>(null);
  shown.current = state.open ? state.id : null;

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
    setState((s) => ({ ...s, open: false }));
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => {
    clearTimers();
    setState({ open: false, id: null, anchor: null });
  }, [resetKey, clearTimers]);

  const hover = useCallback(
    (id: string, at: DetailsAnchor) => {
      clearTimers();
      if (shown.current === id) {
        return;
      }
      openTimer.current = window.setTimeout(() => {
        setState({ open: true, id, anchor: at });
      }, OPEN_DELAY_MS);
    },
    [clearTimers],
  );

  const leave = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      setState((s) => ({ ...s, open: false }));
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
