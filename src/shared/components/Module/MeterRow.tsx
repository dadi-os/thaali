import { motion } from "motion/react";
import { RISE } from "../../motion";

/** Props of {@link Meter}. */
export type MeterProps = {
  /** How full the bar is, 0 to 100 (above 100 draws full). */
  percent: number;
  /** The bar draws in clay: it is nearly full. */
  hot?: boolean;
  /** Width of the track in px; none fills the row. */
  width?: number;
};

/** A thin bar that eases to its fill. */
export function Meter({ percent, hot = false, width }: MeterProps) {
  const fill = Math.max(0, Math.min(100, percent));
  return (
    <span className="block h-1.5 flex-none overflow-hidden rounded-[6px] bg-rule" style={{ width: width ?? "100%" }}>
      <motion.span className={`block h-full rounded-[6px] ${hot ? "bg-clay" : "bg-sage"}`} initial={{ width: 0 }} animate={{ width: `${fill}%` }} transition={RISE.transition} />
    </span>
  );
}

/** Props of {@link MeterRow}. */
export type MeterRowProps = {
  /** What is measured. */
  label: string;
  /** The reading in words, such as `42%`. */
  value: string;
  /** The bar's fill, 0 to 100. */
  percent: number;
  /** Past this the bar draws in clay. */
  hotAbove?: number;
};

/** A label and its reading over a thin bar: how loaded one resource is. */
export function MeterRow({ label, value, percent, hotAbove = 75 }: MeterRowProps) {
  return (
    <div className="flex min-w-0 flex-none flex-col gap-1">
      <div className="flex items-center gap-2 text-[14px]">
        <span className="min-w-0 flex-1 truncate" title={label}>
          {label}
        </span>
        <span className="min-w-[4ch] text-right font-medium tabular-nums">{value}</span>
      </div>
      <Meter percent={percent} hot={percent > hotAbove} />
    </div>
  );
}
