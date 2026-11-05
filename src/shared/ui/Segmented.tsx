import { useId } from "react";
import { LayoutGroup, motion } from "motion/react";
import { SPRING_GLIDE } from "../motion";
import { Icon, type IconName } from "./Icon";

/** One choice of a {@link Segmented}: a word, an icon, or both. */
export type SegmentedOption<Value extends string> = {
  value: Value;
  /** The word shown; omit for an icon-only choice, which then needs `title`. */
  label?: string;
  /** An icon shown before the word, or alone. */
  icon?: IconName;
  /** The accessible name and the hover hint; required when there is no `label`. */
  title?: string;
};

/** Heights, type sizes and minimum widths of the three sizes. */
const SIZES = {
  sm: { height: 24, font: 11.5, minWidth: 34, iconSize: 13 },
  md: { height: 32, font: 12.5, minWidth: 44, iconSize: 16 },
  lg: { height: 40, font: 14, minWidth: 64, iconSize: 18 },
} as const;

/** Props of {@link Segmented}. */
export type SegmentedProps<Value extends string> = {
  /** The choices, in order; a plain string is a choice whose value is its word. */
  options: ReadonlyArray<Value | SegmentedOption<Value>>;
  /** The chosen value. */
  value: Value;
  /** Called with the value a person picks. */
  onChange: (value: Value) => void;
  /** The group's accessible name. */
  label?: string;
  /** `sm` sits inside a field, `md` stands in a toolbar, `lg` heads a page. */
  size?: keyof typeof SIZES;
};

/**
 * A switch between a few exclusive choices: the chosen one sits on a raised thumb that slides to the next
 * choice, moving by transform so it never jitters or reflows.
 */
export function Segmented<Value extends string>({ options, value, onChange, label, size = "md" }: SegmentedProps<Value>) {
  const group = useId();
  const look = SIZES[size];
  return (
    <LayoutGroup id={group}>
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: "inline-flex", flex: "none", alignItems: "center", gap: 2, padding: 3, borderRadius: 999, background: "var(--sage-fill)", border: "1px solid var(--glass-border)" }}
      >
        {options.map((entry) => {
          const option: SegmentedOption<Value> = typeof entry === "string" ? { value: entry, label: entry } : entry;
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={option.label === undefined ? option.title : undefined}
              title={option.title}
              onClick={() => onChange(option.value)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: look.height,
                minWidth: look.minWidth,
                padding: option.label === undefined ? 0 : `0 ${size === "sm" ? 9 : 14}px`,
                borderRadius: 999,
                fontSize: look.font,
                fontWeight: on ? 600 : 500,
                lineHeight: 1,
                whiteSpace: "nowrap",
                color: on ? "var(--ink)" : "var(--ink-muted)",
              }}
            >
              {on ? (
                <motion.span
                  layoutId="segmented-thumb"
                  transition={SPRING_GLIDE}
                  style={{ position: "absolute", inset: 0, borderRadius: 999, background: "var(--bone)", boxShadow: "0 1px 2px rgba(92, 107, 82, 0.15)" }}
                />
              ) : null}
              {option.icon === undefined ? null : (
                <span style={{ position: "relative", display: "flex" }}>
                  <Icon name={option.icon} size={look.iconSize} />
                </span>
              )}
              {option.label === undefined ? null : <span style={{ position: "relative" }}>{option.label}</span>}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
