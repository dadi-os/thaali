import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../motion";
import { AgentName } from "../../ui/AgentName";
import { IconButton } from "../../ui/Button";
import { Icon } from "../../ui/Icon";

/** Height the header's glass takes from the top of the pane, which what runs under it clears. */
export const THREAD_HEADER_PX = 68;

/** Props of {@link ThreadHeader}. */
export type ThreadHeaderProps = {
  /** Back to the conversation list. */
  onBack: () => void;
  /** The agent's full name; null while it loads, which shows a breathing empty bubble. */
  title: string | null;
  /** Why the name could not be loaded, shown in the bubble in place of it. */
  error?: string | null;
  /** The bubble is pressed, with where it is drawn; it is static text without this. */
  onOpenDetails?: (anchor: DOMRect) => void;
};

/**
 * Top of an open thread, floating over it: back as a glass circle on the left and the agent's full name, wrapping if it
 * must, as a centered glass bubble that opens the agent's details. Nothing sits behind them, so messages scroll under both
 * and show through the glass.
 */
export function ThreadHeader({ onBack, title, error = null, onOpenDetails }: ThreadHeaderProps) {
  const bubble = "pane-bubble max-w-full rounded-full px-3.5 py-[9px] text-center text-[14.5px] leading-tight font-semibold";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3 pt-3">
      <IconButton icon="back" label="Back to conversations" size={44} iconSize={18} onClick={onBack} className="pane-bubble pane-bubble--interactive pointer-events-auto rounded-full" />
      <div className="pointer-events-auto flex min-w-0 justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {error !== null ? (
            <motion.span key="error" {...FADE} role="alert" title={error} className={`${bubble} text-error`}>
              {error}
            </motion.span>
          ) : title === null ? (
            <motion.span key="loading" {...FADE} aria-label="Loading" className={`${bubble} animate-breath h-[38px] w-28`} />
          ) : onOpenDetails ? (
            <motion.button
              key="title"
              {...FADE}
              type="button"
              onClick={(event) => onOpenDetails(event.currentTarget.getBoundingClientRect())}
              aria-label={`${title} details`}
              className={`${bubble} pane-bubble--interactive inline-flex items-center gap-1.5 text-ink`}
            >
              <AgentName name={title} selectable={false} />
              <span className="flex flex-none text-ink-ghost"><Icon name="chevron" size={10} /></span>
            </motion.button>
          ) : (
            <motion.span key="title" {...FADE} className={`${bubble} text-ink`}>
              <AgentName name={title} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
