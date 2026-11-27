import { useRef } from "react";
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from "motion/react";
import { EASE, FAST_S, SLOW_S } from "../../shared/motion";
import { agentState, STATE_LABEL } from "../agents/agentState";
import type { AgentRunning } from "../../types/hath";

export type ActivityChipProps = {
  /** The open agent's `running` block. */
  running: AgentRunning;
};

/** The thread's one activity word: `working` while the agent's loop runs, `waiting` once it ended with a watch, null at rest. Never names a tool or a target. */
export function activityLabel(running: AgentRunning): string | null {
  const state = agentState({ running });
  return state === "idle" ? null : STATE_LABEL[state];
}

const BOX_W = 25;
const BOX_H = 14;
const DOT = 4;
/** One pass of a dot from the left edge to dropping off the right. */
const FLOW_MS = 1500;

/** Pose of dot `i` (of three) `ms` into the flow: it swells in at the left, drifts right, then dips and fades off the right edge. */
function flowPose(i: number, ms: number): { transform: string; opacity: string } {
  const p = (ms / FLOW_MS + i / 3) % 1;
  const rise = Math.sin(Math.PI * p);
  const drop = p > 0.72 ? ((p - 0.72) / 0.28) ** 2 : 0;
  const x = 2 + p * (BOX_W - 4) - DOT / 2;
  const y = BOX_H / 2 + drop * 4 - DOT / 2;
  return { transform: `translate(${x}px, ${y}px) scale(${0.55 + 0.45 * rise})`, opacity: String(rise) };
}

/** Three dots flowing left to right, driven per frame without re-rendering. Reduced motion holds them still mid-flow. */
export function ProcessingMark() {
  const reduced = useReducedMotion() ?? false;
  const dots = useRef<Array<HTMLSpanElement | null>>([]);

  useAnimationFrame((time) => {
    dots.current.forEach((el, i) => {
      if (el) {
        Object.assign(el.style, flowPose(i, reduced ? FLOW_MS * 0.3 : time));
      }
    });
  });

  return (
    <span className="relative inline-block shrink-0" style={{ width: BOX_W, height: BOX_H }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className="absolute top-0 left-0 rounded-full bg-sage-deep will-change-transform"
          style={{ width: DOT, height: DOT, ...flowPose(i, FLOW_MS * 0.3) }}
        />
      ))}
    </span>
  );
}

/**
 * Soft glass pill that floats above the composer while the agent works or waits. Working shows the flowing dots with
 * `working`; waiting is a still, quieter pill that only says `waiting`.
 */
export function ActivityChip({ running }: ActivityChipProps) {
  const label = activityLabel(running);
  const working = running.working;
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
          <span
            className={`activity-chip inline-flex items-center gap-2 rounded-full py-1.5 text-[13px] font-medium ${working ? "pr-3.5 pl-2.5" : "activity-chip--waiting px-3.5"}`}
          >
            {working ? <ProcessingMark /> : null}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                className={`relative tracking-[0.03em] lowercase ${working ? "text-sage-text" : "text-ink-muted"}`}
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
