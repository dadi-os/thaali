import { AnimatePresence, motion } from "motion/react";
import { IconDismiss } from "../../shared/components/IconButton";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";

export type NewMessageBubbleProps = {
  /** Agent whose held message is on offer, with its name and unread count; null hides the bubble. */
  from: { agentId: string; name: string; count: number } | null;
  /** Open that agent's chat. */
  onOpen: (agentId: string) => void;
  /** Put the bubble away; the chat stays unread in the list. */
  onDismiss: () => void;
};

/**
 * Glass bubble that drops in under the pane header when an agent messages you while you
 * are busy, instead of the sidebar switching chats under you.
 */
export function NewMessageBubble({ from, onOpen, onDismiss }: NewMessageBubbleProps) {
  return (
    <AnimatePresence>
      {from ? (
        <motion.div
          key={from.agentId}
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 top-[3.85rem] z-30 flex justify-center px-3"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: SLOW_S, ease: EASE }}
        >
          <div className="pane-bubble pointer-events-auto flex max-w-full items-center gap-1 rounded-full py-0.5 pl-1 pr-0.5">
            <button
              type="button"
              onClick={() => onOpen(from.agentId)}
              className="flex min-w-0 items-center gap-2 rounded-full py-0.5 pl-2 pr-1.5 text-left transition-colors duration-fast ease-dadi hover:bg-(--chat-hover)"
            >
              <span className="min-w-0 truncate text-[12px] text-ink">
                <span className="font-medium">{from.name}</span>
                <span className="text-ink-muted">
                  {from.count > 1 ? ` sent ${from.count} messages` : " replied"}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismiss}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-ghost transition-colors duration-fast ease-dadi hover:bg-(--chat-hover) hover:text-ink-muted [&_svg]:size-3"
            >
              <IconDismiss />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
