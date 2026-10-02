import { motion } from "motion/react";
import { BREATH_S } from "../../shared/lib/ux/motion";

/** Clay dot with a slow outward pulse: something happening right now. */
export function LiveDot() {
  return (
    <span aria-hidden className="relative inline-flex size-1.5 shrink-0 self-center">
      <span className="animate-pulse-out absolute inset-0 rounded-full bg-[var(--clay)]" />
      <span className="relative size-1.5 rounded-full bg-[var(--clay)]" />
    </span>
  );
}

/** Ring that breathes out from a round badge (today's date). Parent must be `relative`. */
export function BreathRing() {
  return (
    <span
      aria-hidden
      className="animate-pulse-out pointer-events-none absolute inset-0 rounded-full ring-1 ring-sage [--pulse-from:0.7] [--pulse-scale:1.35]"
    />
  );
}

/** Sage ring that flares and fades over a freshly added entry. Parent must be `relative`. */
export function FreshGlow({ radius = "rounded-[6px]" }: { radius?: string }) {
  return (
    <motion.span
      aria-hidden
      className={`pointer-events-none absolute -inset-px ${radius} ring-2 ring-sage`}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.3, 1, 0] }}
      transition={{ duration: BREATH_S * 1.5, ease: "easeInOut" }}
    />
  );
}
