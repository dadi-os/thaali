/** Lane occupancy: the floating pill above the composer and the three-dot mark it shares with the list. */

import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from "motion/react";
import { LANE_LABEL } from "../../shared/lib/ux/lanes";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";

export type LaneMarkProps = {
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

/** Which motion the mark plays: thinking flows, working orbits, both trace a figure-eight. */
type LaneMotion = "thinking" | "working" | "both";

/** Where one dot sits and how it reads, in the mark's own pixel box. */
type DotPose = { x: number; y: number; opacity: number; scale: number };

/** The mark's box (px) and dot diameter. */
const BOX_W = 22;
const BOX_H = 12;
const DOT = 3.5;
/** Time a state change takes to glide each dot from where it is onto the new path. */
const MORPH_MS = 460;
/** Loop length of each motion. Thinking matches the pill's sweep, working its ring. */
const LOOP_MS = { thinking: 1500, working: 1100, both: 2200 } as const;

/** Lane occupancy as the motion the mark plays, or null when both lanes are idle. */
function laneMotion(conversation: boolean, reasoning: boolean): LaneMotion | null {
  if (conversation && reasoning) {
    return "both";
  }
  if (conversation) {
    return "thinking";
  }
  return reasoning ? "working" : null;
}

/**
 * Pose of dot `i` (of three) `ms` into `motion`'s loop.
 * Thinking: the dots drift left to right, swelling in from nothing, then dip and fade off
 * the right edge to reappear on the left. Working: they chase each other round a circle,
 * the trailing two smaller and dimmer like a comet's tail. Both: the same comet rides a
 * figure-eight (a lemniscate), the flow and the orbit at once.
 */
function dotPose(motion: LaneMotion, i: number, ms: number): DotPose {
  const cx = BOX_W / 2;
  const cy = BOX_H / 2;
  if (motion === "thinking") {
    const p = (ms / LOOP_MS.thinking + i / 3) % 1;
    const rise = Math.sin(Math.PI * p);
    const drop = p > 0.72 ? ((p - 0.72) / 0.28) ** 2 : 0;
    return { x: 2 + p * (BOX_W - 4), y: cy + drop * 4, opacity: rise, scale: 0.55 + 0.45 * rise };
  }
  const tail = { opacity: 1 - i * 0.3, scale: 1 - i * 0.2 };
  if (motion === "working") {
    const a = (ms / LOOP_MS.working) * 2 * Math.PI - i * 0.75;
    return { x: cx + 4.25 * Math.cos(a), y: cy + 4.25 * Math.sin(a), ...tail };
  }
  const t = (ms / LOOP_MS.both) * 2 * Math.PI - i * 0.5;
  const d = 1 + Math.sin(t) ** 2;
  return { x: cx + (9 * Math.cos(t)) / d, y: cy + (9 * Math.sin(t) * Math.cos(t)) / d, ...tail };
}

/** Smoothstep ease for the morph between motions. */
function easeInOut(k: number): number {
  return k * k * (3 - 2 * k);
}

/** Write a pose onto a dot element. */
function place(el: HTMLSpanElement, pose: DotPose): void {
  el.style.transform = `translate(${pose.x - DOT / 2}px, ${pose.y - DOT / 2}px) scale(${pose.scale})`;
  el.style.opacity = String(pose.opacity);
}

/**
 * Three-dot lane mark, driven per frame without re-rendering: a left-to-right flow while
 * thinking, an orbit while working, and a figure-eight while both lanes run. When the lanes
 * change, each dot glides from where it is onto the new path. Reduced motion holds a still
 * pose of each. Nothing when idle.
 */
export function LaneMark({ conversation, reasoning }: LaneMarkProps) {
  const reduced = useReducedMotion() ?? false;
  const motionKind = laneMotion(conversation, reasoning);
  const dots = useRef<Array<HTMLSpanElement | null>>([]);
  const shown = useRef<DotPose[]>([]);
  const morph = useRef<{ from: DotPose[]; at: number | null } | null>(null);

  useLayoutEffect(() => {
    if (!motionKind) {
      shown.current = [];
      morph.current = null;
      return;
    }
    if (shown.current.length === 3) {
      morph.current = { from: shown.current.map((p) => ({ ...p })), at: null };
    }
  }, [motionKind]);

  useLayoutEffect(() => {
    if (!motionKind || !reduced) {
      return;
    }
    dots.current.forEach((el, i) => {
      if (el) {
        place(el, dotPose(motionKind, i, LOOP_MS[motionKind] * 0.3));
      }
    });
  }, [motionKind, reduced]);

  useAnimationFrame((time) => {
    if (!motionKind || reduced) {
      return;
    }
    const m = morph.current;
    if (m && m.at === null) {
      m.at = time;
    }
    const k = m && m.at !== null ? Math.min(1, (time - m.at) / MORPH_MS) : 1;
    const e = easeInOut(k);
    dots.current.forEach((el, i) => {
      const target = dotPose(motionKind, i, time);
      const from = m?.from[i];
      const pose =
        from && k < 1
          ? {
              x: from.x + (target.x - from.x) * e,
              y: from.y + (target.y - from.y) * e,
              opacity: from.opacity + (target.opacity - from.opacity) * e,
              scale: from.scale + (target.scale - from.scale) * e,
            }
          : target;
      shown.current[i] = pose;
      if (el) {
        place(el, pose);
      }
    });
    if (k >= 1) {
      morph.current = null;
    }
  });

  if (!motionKind) {
    return null;
  }
  return (
    <span className="relative inline-block shrink-0" style={{ width: BOX_W, height: BOX_H }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className="absolute top-0 left-0 rounded-full bg-sage-deep will-change-transform"
          style={{ width: DOT, height: DOT, opacity: 0 }}
        />
      ))}
    </span>
  );
}

/**
 * Soft glass pill that floats above the composer while a lane is busy, the one place a
 * thread shows what its agent is doing: the lane mark beside the lane's name. The glass
 * echoes the mark: a light sweep crosses it while thinking, a ring of light runs round its
 * edge while working, and both play together when both lanes run.
 */
export function LaneChip({ conversation, reasoning }: LaneMarkProps) {
  const label = laneChipLabel(conversation, reasoning);
  const motionKind = laneMotion(conversation, reasoning);
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
            className={`lane-chip lane-chip--${motionKind} inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-2 text-[11px] font-medium`}
          >
            <LaneMark conversation={conversation} reasoning={reasoning} />
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
