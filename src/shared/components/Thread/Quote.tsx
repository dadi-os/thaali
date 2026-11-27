import { motion } from "motion/react";
import { RISE } from "../../motion";
import { IconButton } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { quoteLead } from "./replyQuote";

/** Props of {@link QuoteCard}. */
export type QuoteCardProps = {
  /** Who wrote the message being answered: "You" or the agent's name. */
  author: string;
  /** The message's text as it reads. */
  text: string;
  /** Drop the quote and send the reply on its own. */
  onDrop: () => void;
};

/** The message a reply answers, over the composer: who wrote it, its first lines, and a button to drop it. */
export function QuoteCard({ author, text, onDrop }: QuoteCardProps) {
  return (
    <motion.div {...RISE} className="pointer-events-auto mb-1.5 flex items-start gap-2.5 rounded-[18px] border border-[var(--glass-border)] bg-[var(--glass-solid)] py-2 pr-1.5 pl-3.5 shadow-[0_1px_2px_rgba(92,107,82,0.08),0_8px_24px_rgba(44,48,42,0.1)]">
      <span className="mt-[3px] shrink-0 text-sage-text"><Icon name="reply" size={14} /></span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[12px] leading-snug font-semibold text-sage-text">Replying to {author}</p>
        <p data-selectable className="m-0 line-clamp-2 text-[13px] leading-snug text-ink-muted [overflow-wrap:anywhere]">
          {quoteLead(text)}
        </p>
      </div>
      <IconButton icon="close" label="Don't quote" size={28} iconSize={12} className="shrink-0 text-ink-faint" onClick={onDrop} />
    </motion.div>
  );
}

/** Props of {@link QuoteBlock}. */
export type QuoteBlockProps = {
  /** The quoted text parsed from the message. */
  text: string;
  /** Scroll to the message this quotes; absent when it is not loaded. */
  onJump?: () => void;
};

/** The quote a reply opens with, as a quiet card at the top of its bubble. It jumps to the original when that is loaded. */
export function QuoteBlock({ text, onJump }: QuoteBlockProps) {
  const body = (
    <>
      <span className="mt-[3px] shrink-0 text-sage-text"><Icon name="reply" size={12} /></span>
      <span className="line-clamp-2 text-left text-[13px] leading-snug text-ink-muted [overflow-wrap:anywhere]">{quoteLead(text)}</span>
    </>
  );
  const className = "mb-2 last:mb-0 flex w-full items-start gap-2 rounded-[12px] border-l-2 border-sage-line bg-sage-fill px-2.5 py-1.5";
  return onJump ? (
    <button type="button" onClick={onJump} aria-label="Show the quoted message" className={`${className} ui-trans ui-hover-fill`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
