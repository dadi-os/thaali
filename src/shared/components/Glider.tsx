import { motion } from "motion/react";
import { EASE, SLOW_S } from "../lib/ux/motion";

export type GliderProps<T extends string> = {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  /** Accessible name of the radiogroup. */
  label: string;
  /** `sm` sits inside a field (the search bar); `md` stands alone in the toolbar. */
  size?: "sm" | "md";
};

/**
 * Shared pill track with a sliding thumb — distinct from discrete chip toggles.
 */
export function Glider<T extends string>({ options, value, onChange, label, size = "md" }: GliderProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const n = options.length;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative inline-grid shrink-0 rounded-full bg-sage-fill p-0.5 ${size === "sm" ? "h-6" : "h-8"}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <motion.div
        className="absolute inset-y-0.5 rounded-full bg-bone shadow-[var(--shadow)] ring-1 ring-sage-line/80"
        initial={false}
        animate={{
          left: `calc(${index} * 100% / ${n} + 2px)`,
          width: `calc(100% / ${n} - 4px)`,
        }}
        transition={{ duration: SLOW_S, ease: EASE }}
      />
      {options.map((opt) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 tracking-wide transition-colors duration-slow ease-hath ${
              size === "sm" ? "min-w-[2.1rem] px-1.5 text-[10.5px]" : "min-w-[2.6rem] px-2 text-[11px]"
            } ${on ? "text-sage-deep" : "text-ink-ghost hover:text-ink-muted"}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
