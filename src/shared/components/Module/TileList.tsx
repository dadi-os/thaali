import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RISE } from "../../motion";

/** Props of {@link TileList}. */
export type TileListProps = {
  /** The rows, each keyed so an insert, removal or reorder animates. */
  children: ReactNode;
};

/** A column of {@link TileRow}s inside a tile or sheet body; rows that arrive rise in, rows that leave fade out and the rest glide. */
export function TileList({ children }: TileListProps) {
  return (
    <div className="flex min-w-0 flex-none flex-col">
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}

/** Props of {@link TileRow}. */
export type TileRowProps = {
  /** What leads the row: a dot or an icon. */
  lead?: ReactNode;
  /** The row's main text, which takes the free width and truncates. */
  children: ReactNode;
  /** What closes the row: a figure, a badge or a bar. */
  trail?: ReactNode;
  /** 28 px for a dense list, 36 px for the default. */
  size?: "sm" | "md";
  /** A hairline above the row. */
  ruled?: boolean;
};

/** One row of a list in a fixed height, so a figure that changes does not move its neighbours: an optional lead, the text, an optional trail. */
export function TileRow({ lead, children, trail, size = "md", ruled = true }: TileRowProps) {
  return (
    <motion.div {...RISE} layout="position" className={`flex min-w-0 flex-none items-center gap-3 ${ruled ? "border-t border-rule" : ""} ${size === "sm" ? "h-7" : "h-9"}`}>
      {lead}
      <div className="min-w-0 flex-1 text-[14px]">{children}</div>
      {trail}
    </motion.div>
  );
}
