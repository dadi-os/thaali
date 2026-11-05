import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../motion";
import { AgentName } from "../../ui/AgentName";
import { IconButton } from "../../ui/Button";

/** Props of {@link ThreadHeader}. */
export type ThreadHeaderProps = {
  /** Back to the conversation list. */
  onBack: () => void;
  /** The agent's full name; null while it loads, which shows a breathing empty bubble. */
  title: string | null;
  /** Why the name could not be loaded, shown in the bubble in place of it. */
  error?: string | null;
  /** The bubble is pressed; it is static text without this. */
  onOpenDetails?: () => void;
};

/** Top of an open thread: back on the left and the agent's full name, wrapping if it must, as a centered glass bubble that opens the agent in Hath. */
export function ThreadHeader({ onBack, title, error = null, onOpenDetails }: ThreadHeaderProps) {
  const bubble = "pane-bubble max-w-full rounded-full px-3.5 py-1 text-center text-[13.5px] leading-tight font-medium";
  return (
    <div className="relative z-10 grid min-h-14 shrink-0 grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2 border-b border-(--chat-edge) px-2.5 py-1.5">
      <IconButton icon="back" label="Back to conversations" size={32} iconSize={14} onClick={onBack} />
      <div className="flex min-w-0 justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {error !== null ? (
            <motion.span key="error" {...FADE} role="alert" title={error} className={`${bubble} text-error`}>
              {error}
            </motion.span>
          ) : title === null ? (
            <motion.span key="loading" {...FADE} aria-label="Loading" className={`${bubble} animate-breath h-[26px] w-24`} />
          ) : onOpenDetails ? (
            <motion.button
              key="title"
              {...FADE}
              type="button"
              onClick={onOpenDetails}
              aria-label={`${title} in Hath`}
              className={`${bubble} text-ink transition-colors duration-fast ease-dadi hover:bg-(--chat-hover)`}
            >
              <AgentName name={title} selectable={false} />
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
