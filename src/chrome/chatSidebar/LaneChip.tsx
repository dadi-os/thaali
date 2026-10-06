/** Lane occupancy: the floating pill above the composer, its thinking mark, and the working sheen it shares with the list. */

import { useRef } from "react";
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from "motion/react";
import { LANE_LABEL } from "../../shared/lib/ux/lanes";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";

export type LaneChipProps = {
  /** Conversation lane busy: the agent is thinking toward a reply. */
  conversation: boolean;
  /** Reasoning lane busy: the agent is working in the background. */
  reasoning: boolean;
};

/** Lane chip copy from conversation / reasoning occupancy. */
export type LaneChipLabel =
  | (typeof LANE_LABEL)[keyof typeof LANE_LABEL]
  | `${typeof LANE_LABEL.conversation} + ${typeof LANE_LABEL.reasoning}`;

/** Lane chip copy from conversation / reasoning occupancy. */
export function laneChipLabel(conversation: boolean, reasoning: boolean): LaneChipLabel | null {
  if (conversation && reasoning) {
    return `${LANE_LABEL.conversation} + ${LANE_LABEL.reasoning}`;
  }
  if (conversation) {
    return LANE_LABEL.conversation;
  }
  if (reasoning) {
    return LANE_LABEL.reasoning;
  }
  return null;
}

/** The mark's box (px) and dot diameter. */
const BOX_W = 22;
const BOX_H = 12;
const DOT = 3.5;
/** One pass of a dot from the left edge to dropping off the right. */
const FLOW_MS = 1500;

/**
 * Pose of dot `i` (of three) `ms` into the flow: it swells in from nothing at the left,
 * drifts right, then dips and fades off the right edge to reappear on the left.
 */
function flowPose(i: number, ms: number): { transform: string; opacity: string } {
  const p = (ms / FLOW_MS + i / 3) % 1;
  const rise = Math.sin(Math.PI * p);
  const drop = p > 0.72 ? ((p - 0.72) / 0.28) ** 2 : 0;
  const x = 2 + p * (BOX_W - 4) - DOT / 2;
  const y = BOX_H / 2 + drop * 4 - DOT / 2;
  return { transform: `translate(${x}px, ${y}px) scale(${0.55 + 0.45 * rise})`, opacity: String(rise) };
}

/**
 * Thinking mark: three dots flowing left to right, each dropping off the end and
 * reappearing at the start, driven per frame without re-rendering. Reduced motion holds
 * them still mid-flow.
 */
export function ThinkingMark() {
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
 * Soft glass pill that floats above the composer while a lane is busy, the one place a
 * thread shows what its agent is doing. The two lanes read at different levels: thinking
 * plays the flowing dots inside the pill, working runs a sheen on the pill itself (the
 * `lane-sheen` glass), and both play together when both lanes run.
 */
export function LaneChip({ conversation, reasoning }: LaneChipProps) {
  const label = laneChipLabel(conversation, reasoning);
  return (
    <AnimatePresence initial={false}>
      {label ? (
        <motion.div
          key="lane-chip"
          role="status"
          aria-live="polite"
          aria-label={label}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: SLOW_S, ease: EASE }}
          className="pointer-events-none mb-2 flex justify-center"
        >
          <motion.span
            layout
            transition={{ duration: SLOW_S, ease: EASE }}
            className={`lane-chip inline-flex items-center gap-2 rounded-full py-1 text-[11px] font-medium ${
              conversation ? "pr-3 pl-2" : "px-3"
            } ${reasoning ? "lane-sheen" : ""}`}
          >
            <AnimatePresence initial={false}>
              {conversation ? (
                <motion.span
                  key="thinking"
                  className="inline-flex"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: SLOW_S, ease: EASE }}
                >
                  <ThinkingMark />
                </motion.span>
              ) : null}
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                className="relative tracking-[0.04em] text-sage-text lowercase"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
