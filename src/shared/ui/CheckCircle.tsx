import { motion, useReducedMotion } from "motion/react";
import { EASE, SLOW_S } from "../motion";

/** Props of {@link CheckCircle}. */
export type CheckCircleProps = {
  /** Whether the item is ticked. */
  done: boolean;
  /** What ticking does, as the accessible name: "Mark done: Pay the Spotify renewal". */
  label: string;
  onToggle: () => void;
  /** The ring's diameter in px. */
  size?: number;
};

/** The round checkbox: an empty ring that fills sage and draws its check in one snap when ticked, a real button with the app's hover and press. */
export function CheckCircle({ done, label, onToggle, size = 20 }: CheckCircleProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label} onClick={onToggle} className="ui-hover-fill ui-trans flex flex-none rounded-[12px] p-2 active:scale-90">
      <span
        aria-hidden
        className="flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          border: `1.5px solid ${done ? "var(--sage-deep)" : "var(--ink-faint)"}`,
          background: done ? "var(--sage-deep)" : "transparent",
          transition: reduce ? "none" : `background ${SLOW_S}s var(--ease), border-color ${SLOW_S}s var(--ease)`,
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="var(--bone)" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={reduce ? { duration: 0 } : { duration: SLOW_S, ease: EASE }} />
        </svg>
      </span>
    </button>
  );
}
