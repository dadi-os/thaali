import { motion } from "motion/react";
import { SPRING } from "../motion";

/** Props of {@link Switch}. */
export type SwitchProps = {
  /** Whether it is on. */
  on: boolean;
  /** The accessible name. */
  label: string;
  /** It cannot be changed; it shows its last reading. */
  disabled?: boolean;
  /** A command for it is in flight. */
  busy?: boolean;
  /** Called with the state a press asks for. */
  onChange: (on: boolean) => void;
};

/** The track and knob sizes, and how far the knob travels, in px. */
const TRACK = { width: 44, height: 32 };
const KNOB = 24;
const INSET = 4;

/** A power switch: a 44 x 32 track whose knob slides on a spring. For two states of one thing; for a choice of a few use Segmented. */
export function Switch({ on, label, disabled = false, busy = false, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy ? true : undefined}
      disabled={disabled}
      className="ui-trans"
      onClick={() => onChange(!on)}
      style={{ width: TRACK.width, height: TRACK.height, borderRadius: 999, background: on ? "var(--sage-deep)" : "var(--rule)", position: "relative", flex: "none", ...(disabled ? { opacity: 0.45 } : {}) }}
    >
      <motion.span
        initial={false}
        animate={{ x: on ? TRACK.width - KNOB - INSET * 2 : 0 }}
        transition={SPRING}
        style={{ position: "absolute", top: INSET, left: INSET, width: KNOB, height: KNOB, borderRadius: "50%", background: "var(--bone)", boxShadow: "0 1px 3px rgba(44,48,42,.3)" }}
      />
    </button>
  );
}
