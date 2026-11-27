import { useEffect, useState } from "react";

/** How long onboarding keeps connecting, with nothing else on screen, before Forget this device fades in. */
export const FORGET_AFTER_MS = 8_000;

/**
 * Whether `active` has been true for `ms` without a break. It turns false the moment `active` does,
 * so the next stretch of waiting starts its own count.
 */
export function useElapsed(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = window.setTimeout(() => setElapsed(true), ms);
    return () => window.clearTimeout(timer);
  }, [active, ms]);
  return elapsed;
}
