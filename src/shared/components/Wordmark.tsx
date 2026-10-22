import { motion, useReducedMotion } from "motion/react";
import { BREATH_S } from "../lib/ux/motion";

/**
 * Where Noto Sans Gujarati's ink sits above its line box's center, per em: દાદી with its
 * tall ી 0.199 em, a lone દ 0.0525 em (measured with CoreText for khisso). Moving the text
 * down by this centers the ink rather than the line box.
 */
export const GUJARATI_INK_LIFT = { word: 0.199, letter: 0.0525 } as const;

/** દાદી as its two grapheme clusters, which resolve one after the other. */
const CLUSTERS = ["દા", "દી"] as const;

/** One resolve: a smooth (unbouncy) spring of 0.9 s per cluster, 0.22 s apart. */
const RESOLVE = { duration: 0.9, delay: 0.15, stagger: 0.22 } as const;

/** The sage glow the breath pulses between, as text shadows sized to the mark (khisso's 6 and 28 pt at 112). */
const GLOW_LOW = "0 0 0.054em rgba(143, 163, 130, 0.05)";
const GLOW_HIGH = "0 0 0.25em rgba(143, 163, 130, 0.55)";

export interface WordmarkProps {
  /** Font size in px. Callers moving the mark between sizes scale it with a transform instead. */
  size: number;
  /** Resolve દા then દી out of a soft blur when it mounts. */
  resolve?: boolean;
  /** Breathe: a sage glow pulsing and a 0.98 ↔ 1.02 scale, 2.4 s each way, while dadi waits. */
  breathe?: boolean;
  className?: string;
}

/**
 * The દાદી wordmark in Noto Sans Gujarati, ink-centered, on one line that never wraps or
 * truncates. Reduced motion shows it at rest: no resolve and no breath.
 */
export function Wordmark({ size, resolve = false, breathe = false, className = "" }: WordmarkProps) {
  const reduce = useReducedMotion() ?? false;
  const resolving = resolve && !reduce;
  const breathing = breathe && !reduce;
  return (
    <motion.span
      role="img"
      aria-label="dadi"
      className={`relative inline-block whitespace-nowrap font-gujarati font-medium leading-none ${className}`}
      style={{ fontSize: size, top: `${GUJARATI_INK_LIFT.word}em` }}
      animate={
        breathing
          ? { scale: [0.98, 1.02], textShadow: [GLOW_LOW, GLOW_HIGH] }
          : { scale: 1, textShadow: GLOW_LOW }
      }
      transition={
        breathing
          ? { duration: BREATH_S, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
          : { duration: BREATH_S / 2, ease: "easeInOut" }
      }
    >
      {CLUSTERS.map((cluster, index) => (
        <motion.span
          key={cluster}
          aria-hidden
          className="inline-block"
          style={{ transformOrigin: "50% 100%" }}
          initial={resolving ? { opacity: 0, filter: "blur(14px)", scale: 0.86, y: 10 } : false}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0, transitionEnd: { filter: "none" } }}
          transition={{
            type: "spring",
            bounce: 0,
            duration: RESOLVE.duration,
            delay: RESOLVE.delay + index * RESOLVE.stagger,
          }}
        >
          {cluster}
        </motion.span>
      ))}
    </motion.span>
  );
}
