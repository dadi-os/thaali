import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { REVEAL } from "../motion";
import { Icon } from "./Icon";

/** Props of {@link Disclosure}. */
export type DisclosureProps = {
  title: string;
  /** What the section holds, in a few words, at the right of the row whether it is shut or open. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  /** A hairline above the row. Leave it on to separate sections; turn it off for the first section of a card. */
  divider?: boolean;
  children: ReactNode;
};

/**
 * A titled section that eases open to its content. The row is a 40 px button with 6 px of padding inside its rounded hover wash (and sunk press): a chevron that turns a quarter when open, the caps title, and the
 * summary at the right in tabular figures. The content eases open with the REVEAL preset and is mounted only while open, indented
 * to start under the title.
 */
export function Disclosure({ title, summary, open, onToggle, divider = true, children }: DisclosureProps) {
  return (
    <div className={divider ? "border-t border-rule" : undefined}>
      <button
        type="button"
        className="ui-trans group flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-1.5 text-left hover:bg-sage-active/60 active:bg-sage-active"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={`flex size-5 flex-none items-center justify-center text-ink-ghost transition-[rotate,color] duration-slow ease-dadi group-hover:text-ink-muted ${open ? "rotate-90" : ""}`}>
          <Icon name="chevron" size={12} />
        </span>
        <span className="ui-label">{title}</span>
        <span className="ml-auto min-w-0 truncate text-[13px] text-ink-muted tabular-nums" title={summary}>
          {summary}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="content" {...REVEAL} className="overflow-hidden">
            <div className="pt-0.5 pr-0.5 pb-3 pl-[34px]">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
