import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE, REVEAL } from "../../../shared/motion";

/** Props of {@link Arrive}. */
export type ArriveProps = {
  /** True once everything the content needs has been read. */
  ready: boolean;
  /** What stands in the content's place until it is ready, shaped like it. */
  skeleton: ReactNode;
  children: ReactNode;
};

/**
 * Content that arrives whole: the skeleton fades out, then all of the content eases open in one height and opacity reveal,
 * so nothing appears piece by piece. Content already ready on first draw is shown as it is, with no reveal of its own.
 */
export function Arrive({ ready, skeleton, children }: ArriveProps) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {ready ? (
        <motion.div key="content" {...REVEAL} className="overflow-hidden">
          {children}
        </motion.div>
      ) : (
        <motion.div key="skeleton" {...FADE}>
          {skeleton}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
