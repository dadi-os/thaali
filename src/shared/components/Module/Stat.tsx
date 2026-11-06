import type { MouseEvent } from "react";

/** Props of {@link Stat}. */
export type StatProps = {
  /** The figure; it is drawn with tabular numerals so a change does not shift it. */
  value: number | string;
  /** What the figure counts. */
  label: string;
  /** The colour of the dot in the corner, as a CSS colour; none draws no dot. */
  ink?: string;
  /** The cell is a button that does this; it keeps a click from following a tile's link. */
  onClick?: () => void;
};

/** A figure over its label in a sage cell that fills the room it is given; a dot in the corner tells the kind apart. */
export function Stat({ value, label, ink, onClick }: StatProps) {
  const Cell = onClick === undefined ? "div" : "button";
  return (
    <Cell
      {...(onClick === undefined
        ? {}
        : {
            type: "button" as const,
            onClick: (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              onClick();
            },
          })}
      className={`relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] bg-sage-fill ${onClick === undefined ? "" : "ui-trans ui-hover-card border border-transparent"}`}
    >
      {ink === undefined ? null : <span className="dot absolute top-3 left-3 size-2" style={{ background: ink }} />}
      <span className="min-w-[2ch] text-center text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="max-w-full truncate px-2 text-[13px] text-ink-muted" title={label}>
        {label}
      </span>
    </Cell>
  );
}
