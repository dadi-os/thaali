import type { ReactNode } from "react";
import { motion } from "motion/react";
import { IconBack } from "../../shared/components/IconButton";
import { EASE } from "../../shared/lib/ux/motion";
import { Avatar } from "./Avatar";

export type PaneHeaderProps = {
  /** Back to the conversation list. */
  onBack: () => void;
  /** Avatar glyph: the agent's initial, or દ for Dadi. */
  glyph: string;
  /** Set the glyph in Dadi's Gujarati face. */
  gujarati?: boolean;
  /** A lane is running; the avatar pulses. */
  live: boolean;
  title: string;
  /** Quiet line under the title: the live lane status, or when it last spoke. */
  status: ReactNode;
  /** Makes the title a link, e.g. to the agent in Hath; plain text without it. */
  link?: { label: string; onOpen: () => void };
};

/** Top of an open pane: back, the avatar, and the title over its live status. */
export function PaneHeader({ onBack, glyph, gujarati = false, live, title, status, link }: PaneHeaderProps) {
  return (
    <div className="relative z-10 flex h-14 shrink-0 items-center gap-2.5 border-b border-(--chat-edge) pl-2 pr-3">
      <motion.button
        type="button"
        onClick={onBack}
        aria-label="Back to conversations"
        whileHover={{ x: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-fast ease-dadi hover:bg-sage-active/50 hover:text-ink [&_svg]:size-3.5"
      >
        <IconBack />
      </motion.button>
      <Avatar
        glyph={glyph}
        gujarati={gujarati}
        live={live}
        className={`size-8 ${gujarati ? "text-[15px]" : "text-[13px]"}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {link ? (
          <button
            type="button"
            onClick={link.onOpen}
            title={link.label}
            className="min-w-0 truncate text-left text-[14px] leading-tight font-medium text-ink transition-colors duration-fast ease-dadi hover:text-sage-deep"
          >
            {title}
          </button>
        ) : (
          <span className="min-w-0 truncate text-[14px] leading-tight font-medium text-ink">{title}</span>
        )}
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px] leading-tight text-ink-ghost">
          {status}
        </span>
      </div>
    </div>
  );
}
