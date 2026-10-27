import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useConnection } from "../shared/hooks/useConnection";
import { BREATH_S, EASE, SLOW_S } from "../shared/lib/ux/motion";
import { formatAbsolute, formatRelative } from "../shared/lib/ux/time";

/** How often the "reported … ago" age is refreshed while dadi is out of reach. */
const AGE_TICK_MS = 30_000;

/**
 * The one notice for dadi being out of reach: while the mesh reconnects, a glass pill drops
 * in over the page, saying what is on screen is what dadi last reported and how long ago, and
 * leaves as soon as the mesh is back. Pages keep their last answers under it.
 */
export function OfflinePill() {
  const { state } = useConnection();
  const reduced = useReducedMotion() ?? false;
  const [since, setSince] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSince(state === "reconnecting" ? new Date().toISOString() : null);
  }, [state]);

  useEffect(() => {
    if (!since) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), AGE_TICK_MS);
    return () => window.clearInterval(id);
  }, [since]);

  return (
    <AnimatePresence>
      {since ? (
        <motion.div
          key="offline"
          role="status"
          className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center"
          initial={{ opacity: 0, y: reduced ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -8 }}
          transition={{ duration: SLOW_S, ease: EASE }}
        >
          <span className="flex items-center gap-2.5 rounded-full border border-(--glass-border) bg-(--glass-sheet) py-2 pl-3 pr-4 text-[12.5px] shadow-[var(--shadow)] backdrop-blur-[var(--glass-blur)]">
            <svg viewBox="0 0 64 64" className="size-4 shrink-0 overflow-visible" aria-hidden>
              <motion.circle
                cx="32"
                cy="32"
                r="22"
                fill="none"
                stroke="var(--ink-ghost)"
                strokeWidth="4"
                strokeDasharray="7 9"
                animate={reduced ? undefined : { rotate: 360 }}
                transition={reduced ? undefined : { duration: BREATH_S * 10, ease: "linear", repeat: Infinity }}
              />
              <circle cx="32" cy="32" r="6" fill="none" stroke="var(--ink-ghost)" strokeWidth="4" strokeDasharray="4 3" />
            </svg>
            <span className="font-medium text-ink">dadi is offline</span>
            <span className="text-ink-ghost" title={formatAbsolute(since)}>
              showing what it reported {formatRelative(since, now)} · reconnecting
            </span>
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
