import { motion } from "motion/react";
import { FADE } from "../../../shared/motion";

/** Each placeholder bubble: which side it sits on, its width, and its height. */
const BUBBLES = [
  { mine: false, width: "58%", height: 44 },
  { mine: true, width: "72%", height: 68 },
  { mine: false, width: "80%", height: 92 },
  { mine: true, width: "46%", height: 40 },
  { mine: false, width: "66%", height: 64 },
  { mine: true, width: "78%", height: 84 },
  { mine: false, width: "52%", height: 40 },
  { mine: true, width: "64%", height: 56 },
  { mine: false, width: "74%", height: 76 },
  { mine: true, width: "50%", height: 44 },
] as const;

export type ThreadSkeletonProps = {
  /** Space under the last bubble, so it clears the floating composer. */
  bottomPad: number;
  /** The accessible name of the loading region. */
  label: string;
};

/** A thread that has not arrived: bubbles of every size down both sides, anchored to the bottom and filling the pane the way messages will, the oldest running off the top. */
export function ThreadSkeleton({ bottomPad, label }: ThreadSkeletonProps) {
  return (
    <motion.div
      {...FADE}
      role="status"
      aria-label={label}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end gap-3 overflow-hidden px-4"
      style={{ paddingBottom: bottomPad }}
    >
      {BUBBLES.map((bubble, index) => (
        <span key={index} className={`sk flex-none rounded-[16px] ${bubble.mine ? "self-end" : "self-start"}`} style={{ width: bubble.width, height: bubble.height }} />
      ))}
    </motion.div>
  );
}
