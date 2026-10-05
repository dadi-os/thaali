import { motion } from "motion/react";
import { IconBack } from "../../shared/components/IconButton";
import { EASE } from "../../shared/lib/ux/motion";

export type PaneHeaderProps = {
  /** Back to the conversation list. */
  onBack: () => void;
  /** Name in the bubble. */
  title: string;
  /** Set the name in the Gujarati face, as Dadi's દાદી is. */
  gujarati?: boolean;
  /**
   * Bubble pressed, with its on-screen box; the bubble is static text without it. While
   * the details are open the press is kept from the popover's outside-click dismissal, so
   * this handler alone toggles them closed.
   */
  onOpenDetails?: (box: DOMRect) => void;
  /** The details the bubble opens are showing. */
  detailsOpen?: boolean;
};

/** Top of an open pane: back on the left and the chat's name as a centered glass bubble. */
export function PaneHeader({ onBack, title, gujarati = false, onOpenDetails, detailsOpen = false }: PaneHeaderProps) {
  const bubble = `pane-bubble min-w-0 max-w-full truncate rounded-full px-3.5 py-1 leading-tight text-ink ${
    gujarati ? "font-gujarati text-[16px]" : "text-[13.5px] font-medium"
  }`;
  return (
    <div className="relative z-10 grid h-14 shrink-0 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-2 border-b border-(--chat-edge) px-2.5">
      <motion.button
        type="button"
        onClick={onBack}
        aria-label="Back to conversations"
        whileHover={{ x: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors duration-fast ease-dadi hover:bg-sage-active/50 hover:text-ink [&_svg]:size-3.5"
      >
        <IconBack />
      </motion.button>
      <div className="flex min-w-0 justify-center">
        {onOpenDetails ? (
          <motion.button
            type="button"
            onMouseDown={(e) => {
              if (detailsOpen) {
                e.stopPropagation();
              }
            }}
            onClick={(e) => onOpenDetails(e.currentTarget.getBoundingClientRect())}
            aria-expanded={detailsOpen}
            aria-label={`${title} details`}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE }}
            className={`${bubble} transition-colors duration-fast ease-dadi hover:bg-(--chat-hover) ${
              detailsOpen ? "pane-bubble--open" : ""
            }`}
          >
            {title}
          </motion.button>
        ) : (
          <span className={bubble}>{title}</span>
        )}
      </div>
    </div>
  );
}
