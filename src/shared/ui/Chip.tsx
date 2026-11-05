import type { ReactNode } from "react";

/** How a {@link Chip} is tinted: a sage wash, solid sage, the due wash, tide, or clay. */
export type ChipTone = "sage" | "solid" | "due" | "tide" | "clay";

/** The background, ink and border of each tone. */
const TONES: Record<ChipTone, { background: string; color: string; border: string }> = {
  sage: { background: "var(--sage-fill)", color: "var(--sage-text)", border: "var(--glass-border)" },
  solid: { background: "var(--sage-deep)", color: "var(--bone)", border: "transparent" },
  due: { background: "var(--due-fill)", color: "var(--due-ink)", border: "var(--due-line)" },
  tide: { background: "var(--tide-fill)", color: "var(--tide-ink)", border: "var(--tide-line)" },
  clay: { background: "color-mix(in srgb, var(--clay) 16%, transparent)", color: "color-mix(in srgb, var(--clay) 70%, var(--ink))", border: "transparent" },
};

/** Heights and type of the two sizes: `sm` for a tile or a card, `md` for a page's header row. */
const SIZES = { sm: { height: 20, font: 11.5, pad: 8 }, md: { height: 24, font: 12, pad: 10 } } as const;

/** Props of {@link Chip}. */
export type ChipProps = {
  /** The tint. */
  tone?: ChipTone;
  /** `sm` sits in a tile or a card, `md` in a page's header row. */
  size?: keyof typeof SIZES;
  /** The words; the chip never wraps, and does not shrink below them. */
  children: ReactNode;
};

/** A small static label: a status word, a time zone, a count. It is not a control; for a choice use Pill. */
export function Chip({ tone = "sage", size = "sm", children }: ChipProps) {
  const look = SIZES[size];
  const colors = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        flex: "none",
        height: look.height,
        padding: `0 ${look.pad}px`,
        borderRadius: 999,
        fontSize: look.font,
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </span>
  );
}
