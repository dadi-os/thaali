import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../motion";
import { Icon } from "../../ui/Icon";
import { Truncate } from "../../ui/Truncate";

export type TaskPreviewProps = {
  kind: "browser" | "terminal";
  /** The page address of a browser, or the id and slot of a terminal. */
  caption: string;
  /** The accessible name, such as "Open browser task 3f2a91". */
  label: string;
  /** What the helper holds: its page for a browser, its output for a terminal. */
  children: ReactNode;
  /** The owner is driving it. */
  paused?: boolean;
  onOpen: () => void;
};

/**
 * A helper's live screen, drawn as a browser window or a terminal. The whole frame is the button: hover shows an
 * expand mark, and a click opens the takeover. The chrome is the shell; the page or output is the child.
 */
export function TaskPreview({ kind, caption, label, children, paused = false, onOpen }: TaskPreviewProps) {
  const browser = kind === "browser";
  return (
    <button
      type="button"
      className={`pv ui-trans ${browser ? "bg-white" : "bg-[#23271f] text-[#dfe6d6]"}`}
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      {browser ? (
        <div className="flex h-10 items-center gap-2 border-b border-rule bg-[#f1f2ee] pr-3 pl-2.5">
          <span className="flex gap-[5px]">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="dot size-2 bg-[#d9d4cb]" />
            ))}
          </span>
          <div className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-rule bg-white px-2.5 text-[12px] text-ink-muted">
            <Icon name="lock" size={11} />
            <Truncate text={caption} className="min-w-0 flex-1 text-[12px]" />
          </div>
        </div>
      ) : (
        <div className="flex h-10 items-center gap-2 bg-[#1b1e18] px-3 font-numeric text-[12px] text-[#a9b3a0]">
          <Icon name="terminal" size={12} />
          <Truncate text={caption} className="min-w-0 flex-1" />
        </div>
      )}
      {children}
      <span className="pv-x" aria-hidden="true">
        <Icon name="expand" size={15} />
      </span>
      <AnimatePresence>
        {paused ? (
          <motion.span
            key="paused"
            {...FADE}
            className="absolute right-2 bottom-2 z-[2] inline-flex h-6 items-center gap-1.5 rounded-full border border-due-line bg-[#f1e7cc] px-2.5 text-[12px] font-semibold text-due-ink"
          >
            <Icon name="pause" size={11} />
            Paused
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}
