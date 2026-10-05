/** Lane occupancy marks: the floating chip above the composer and the inline mark it shares with the list and header. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { laneChipLabel } from "./toolStatus";

export type LaneMarkProps = {
  /** Conversation lane busy: the agent is thinking toward a reply. */
  conversation: boolean;
  /** Reasoning lane busy: the agent is working in the background. */
  reasoning: boolean;
};

/**
 * Small inline lane mark: a dot with an outward pulse while working, a wave of three
 * dots while thinking, both side by side when both lanes run. Nothing when idle.
 */
export function LaneMark({ conversation, reasoning }: LaneMarkProps) {
  const reduced = useReducedMotion() ?? false;
  if (!conversation && !reasoning) {
    return null;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" aria-hidden>
      {reasoning ? (
        <span className="relative inline-flex size-[5px]">
          {reduced ? null : (
            <span className="animate-pulse-out absolute inset-0 rounded-full bg-sage" />
          )}
          <span className="relative size-[5px] rounded-full bg-sage-deep" />
        </span>
      ) : null}
      {conversation ? (
        <span className="inline-flex items-center gap-[2.5px]">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block size-[3.5px] rounded-full bg-sage-deep"
              animate={reduced ? { opacity: 0.8 } : { opacity: [0.25, 1, 0.25], y: [0, -1.5, 0] }}
              transition={
                reduced ? undefined : { duration: 1.1, repeat: Infinity, ease: EASE, delay: i * 0.14 }
              }
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}

export type LaneChipProps = LaneMarkProps & {
  /** Signature of the tool running right now, when the agent's logs show one. */
  tool: string | null;
  /** Failure from the log poll behind `tool`, shown in its place. */
  toolError: string | null;
};

/**
 * Soft glass pill that floats above the composer while a lane is busy: the lane mark,
 * the lane name, and the tool in flight, crossfading as each changes.
 */
export function LaneChip({ conversation, reasoning, tool, toolError }: LaneChipProps) {
  const label = laneChipLabel(conversation, reasoning);
  const detail = toolError ?? tool;
  return (
    <AnimatePresence initial={false}>
      {label ? (
        <motion.div
          key="lane-chip"
          role="status"
          aria-live="polite"
          aria-label={detail ? `${label}: ${detail}` : label}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: SLOW_S, ease: EASE }}
          className="pointer-events-none mb-2 flex justify-center"
        >
          <motion.span
            layout
            transition={{ duration: SLOW_S, ease: EASE }}
            className="lane-chip inline-flex max-w-full min-w-0 items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
          >
            <LaneMark conversation={conversation} reasoning={reasoning} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                className="shrink-0 tracking-[0.04em] text-sage-text lowercase"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              {detail ? (
                <motion.span
                  key={detail}
                  title={detail}
                  className={`min-w-0 truncate font-normal ${
                    toolError ? "text-error" : "font-mono text-ink-muted"
                  }`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  {detail}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
