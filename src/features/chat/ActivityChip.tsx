import { AnimatePresence, motion } from "motion/react";
import { EASE, FAST_S, SLOW_S } from "../../shared/motion";
import { countNoun } from "../../shared/lib/ux/plural";
import type { LiveWake } from "../../contexts/running";
import type { AgentRunning } from "../../types/hath";

/** The most helpers or agents the pill names before it counts the rest. */
const NAMED_TARGETS = 2;

export type ActivityChipProps = {
  /** The open agent's `running` block. */
  running: AgentRunning;
  /** The wake running now, with the counts `wake_activity` last reported. */
  live?: LiveWake;
};

/**
 * The thread's one activity label: `working` (with what the wake has done so far) while the agent's loop runs,
 * `waiting on` its targets once the wake ended with a watch, and null at rest.
 */
export function activityLabel(running: AgentRunning, live: LiveWake | undefined): string | null {
  if (running.working) {
    const calls = live?.counts.tool_calls ?? 0;
    return calls > 0 ? `working · ${calls} ${countNoun(calls, "tool call")}` : "working";
  }
  if (running.waiting_on !== null) {
    const { targets } = running.waiting_on;
    const more = targets.length - NAMED_TARGETS;
    return `waiting on ${targets.slice(0, NAMED_TARGETS).join(", ")}${more > 0 ? ` +${more}` : ""}`;
  }
  return null;
}

/**
 * Soft glass pill that floats above the composer while the agent works or waits, the one place a thread shows what
 * its agent is doing. Working runs the sheen on the pill itself; waiting is the same glass at rest.
 */
export function ActivityChip({ running, live }: ActivityChipProps) {
  const label = activityLabel(running, live);
  return (
    <AnimatePresence initial={false}>
      {label ? (
        <motion.div
          key="activity-chip"
          role="status"
          aria-live="polite"
          aria-label={label}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: SLOW_S, ease: EASE }}
          className="pointer-events-none mb-2 flex justify-center"
        >
          <span className={`activity-chip inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium ${running.working ? "working-sheen" : ""}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                className="relative tracking-[0.03em] text-sage-text lowercase"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: FAST_S, ease: EASE }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
