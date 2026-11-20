import { motion, useReducedMotion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/motion";

export type CheckProps = {
  /** Whether the task is ticked. */
  done: boolean;
};

/** The round checkbox: an empty ring that fills sage and draws its check in one snap when the task is done. */
export function Check({ done }: CheckProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1.5px solid ${done ? "var(--sage-deep)" : "var(--ink-faint)"}`,
        background: done ? "var(--sage-deep)" : "transparent",
        transition: reduce ? "none" : `background ${SLOW_S}s var(--ease), border-color ${SLOW_S}s var(--ease)`,
      }}
    >
      <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="var(--bone)" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={reduce ? { duration: 0 } : { duration: SLOW_S, ease: EASE }} />
      </svg>
    </span>
  );
}

