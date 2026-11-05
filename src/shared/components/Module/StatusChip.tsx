import type { MouseEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RISE } from "../../motion";

/** How a {@link StatusChip} is tinted. */
export type StatusTone = "sage" | "error" | "tide" | "clay" | "quiet";

/** The wash, the ink and the dot of each tone. */
const TONES: Record<StatusTone, { chip: string; dot: string }> = {
  sage: { chip: "bg-sage-fill text-sage-text", dot: "bg-sage" },
  error: { chip: "bg-error-fill text-error", dot: "bg-error" },
  tide: { chip: "bg-tide-fill text-tide-ink", dot: "bg-tide" },
  clay: { chip: "bg-due-fill text-due-ink", dot: "bg-clay" },
  quiet: { chip: "bg-sage-fill text-ink-muted", dot: "bg-ink-ghost" },
};

/** Props of {@link StatusChip}. */
export type StatusChipProps = {
  /** The tint. */
  tone?: StatusTone;
  /** The dot pulses: something is live. */
  pulse?: boolean;
  /** False draws the chip without its dot, for a label and a count. */
  dot?: boolean;
  /** The chip fills the width it is given, its words centred; for a grid of chips. */
  fill?: boolean;
  /** The chip is a button that does this. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Attributes that attach a right-click menu, from `useContextActions`. */
  context?: Record<string, string>;
  /** Shown on hover; set it when the words truncate. */
  title?: string;
  /** The words. */
  children: ReactNode;
};

/** A state chip: a dot and words in a pill that does not wrap and gives up width before it breaks; a button when it has a click. */
export function StatusChip({ tone = "sage", pulse = false, dot: withDot = true, fill = false, onClick, context, title, children }: StatusChipProps) {
  const look = TONES[tone];
  const className = `inline-flex h-8 min-w-0 ${fill ? "w-full justify-center" : "flex-[0_1_auto]"} items-center gap-2 rounded-full px-3 text-[13px] font-medium whitespace-nowrap ${look.chip}`;
  const dot = withDot ? <span className={`dot size-2 ${look.dot} ${pulse ? "dot-pulse" : ""}`} /> : null;
  if (onClick === undefined) {
    return (
      <motion.span {...RISE} {...context} layout="position" className={className} title={title}>
        {dot}
        {children}
      </motion.span>
    );
  }
  return (
    <motion.button {...RISE} {...context} layout="position" type="button" className={className} title={title} onClick={onClick}>
      {dot}
      {children}
    </motion.button>
  );
}

/** Props of {@link ChipRow}. */
export type ChipRowProps = {
  /** The chips, each keyed. */
  children: ReactNode;
  /** Chips that do not fit wrap onto more lines instead of being clipped. */
  wrap?: boolean;
};

/** A row of chips; a chip that arrives or leaves animates and the others glide. */
export function ChipRow({ children, wrap = false }: ChipRowProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${wrap ? "flex-wrap" : "flex-nowrap overflow-hidden"}`}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}
