import { memo, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CopyButton } from "../../ui/CopyButton";
import { IconButton } from "../../ui/Button";
import { RISE } from "../../motion";
import { useContextActions } from "../../interaction/contextMenu";
import { formatAbsolute } from "../../lib/ux/time";
import type { ChatMessage } from "../../../contexts/chat";
import { MarkdownBody } from "../Markdown";
import { messageActions } from "./actions";
import { formatMessageTime } from "./format";
import { MessageFiles } from "./MessageFiles";

/** Props of {@link MessageBubble}. */
export type MessageBubbleProps = {
  /** Message to render (user or agent). */
  message: ChatMessage;
  /**
   * Row appeared after this thread view opened.
   * Only these enter with motion; reopening a thread is static.
   */
  live?: boolean;
  /** Retry a failed user send. */
  onRetry?: () => void;
  /** Remove a failed or queued user message. */
  onCancel?: () => void;
};

/** The row every message sits in: it rises in when it arrives live, fades out when it leaves, and right-click offers the message's actions. */
function MessageRow({ message, live, dim = false, className, children }: { message: ChatMessage; live: boolean; dim?: boolean; className: string; children: ReactNode }) {
  const context = useContextActions(() => messageActions(message));
  return (
    <motion.div
      {...RISE}
      {...context}
      initial={live ? RISE.initial : false}
      animate={{ ...RISE.animate, opacity: dim ? 0.7 : 1 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Single chat row: quiet user pill or agent markdown, each with its time and a copy button. */
export function MessageBubble({ message, live = false, onRetry, onCancel }: MessageBubbleProps) {
  if (message.notice) {
    return <NoticeLine message={message} live={live} />;
  }
  if (message.from_user) {
    return <UserBubble message={message} live={live} onRetry={onRetry} onCancel={onCancel} />;
  }
  return <AgentBubble message={message} live={live} />;
}

type MessageMetaProps = {
  /** The message the line describes. */
  message: ChatMessage;
  /** Copy button label, e.g. "Copy message" or "Copy response". */
  copyLabel: string;
  /** Side of the thread the line sits on. */
  align: "start" | "end";
};

/**
 * Quiet line under a bubble: when it was sent (the full date on hover) and a copy button
 * that shows while the pointer is on the message.
 */
function MessageMeta({ message, copyLabel, align }: MessageMetaProps) {
  return (
    <div className={`flex items-center gap-0.5 px-1 text-[12px] text-ink-muted ${align === "end" ? "flex-row-reverse" : ""}`}>
      <time dateTime={message.at} title={formatAbsolute(message.at)}>
        {formatMessageTime(message.at)}
      </time>
      <CopyButton text={message.content} label={copyLabel} className="opacity-0 transition-opacity duration-fast ease-dadi group-hover/msg:opacity-100 focus-within:opacity-100" />
    </div>
  );
}

/** What a failed or queued send offers, each button appearing and leaving with the state. */
function SendControls({ failed, queued, onRetry, onCancel }: { failed: boolean; queued: boolean; onRetry?: () => void; onCancel?: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {failed && onRetry ? (
        <motion.span key="retry" {...RISE} className="flex shrink-0 text-error">
          <IconButton icon="retry" label="Retry send" onClick={onRetry} />
        </motion.span>
      ) : null}
      {(queued || failed) && onCancel ? (
        <motion.span key="remove" {...RISE} className="flex shrink-0 text-ink-ghost">
          <IconButton icon="close" label="Remove message" onClick={onCancel} />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Right-aligned user pill with optional retry / cancel for failed or queued sends. The
 * buttons line up with the files and bubble only, so the error and time lines under them
 * do not pull them down.
 */
function UserBubble({ message, live, onRetry, onCancel }: { message: ChatMessage; live: boolean; onRetry?: () => void; onCancel?: () => void }) {
  const failed = Boolean(message.failed);
  const queued = Boolean(message.queued);
  return (
    <MessageRow message={message} live={live} dim={Boolean(message.pending) && !queued && !failed} className="group/msg flex justify-end">
      <div className="flex max-w-[min(92%,34rem)] min-w-0 flex-col items-end gap-1">
        <div className="flex max-w-full min-w-0 items-center gap-1.5">
          <SendControls failed={failed} queued={queued} onRetry={onRetry} onCancel={onCancel} />
          <div className="flex min-w-0 flex-col items-end gap-1">
            <MessageFiles files={message.files ?? []} sending={message.files ? [] : (message.attachments ?? [])} align="end" />
            {message.content ? (
              <div
                data-selectable
                className={`rounded-[20px] px-3.5 py-2.5 text-[15px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  failed ? "border border-error-line bg-error-fill text-ink" : queued ? "border border-dashed border-sage-line/50 bg-sage-fill/25 text-ink/60" : "bg-sage-active text-ink"
                }`}
              >
                {message.content}
              </div>
            ) : null}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {message.sendError ? (
            <motion.p key="error" {...RISE} data-selectable className="px-1 text-[12px] leading-snug text-error">
              {message.sendError}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <MessageMeta message={message} copyLabel="Copy message" align="end" />
      </div>
    </MessageRow>
  );
}

/** Left-aligned agent row: the reply as rendered markdown from the first frame, with its time and a copy button under it. */
function AgentBubble({ message, live }: { message: ChatMessage; live: boolean }) {
  return (
    <MessageRow message={message} live={live} className="group/msg flex max-w-[min(96%,40rem)] flex-col gap-1 text-[15px] leading-[1.65] text-ink [overflow-anchor:none]">
      <div data-selectable>
        <SettledMarkdown content={message.content} />
      </div>
      <MessageFiles files={message.files ?? []} sending={[]} align="start" />
      <MessageMeta message={message} copyLabel="Copy response" align="start" />
    </MessageRow>
  );
}

const SettledMarkdown = memo(function SettledMarkdown({ content }: { content: string }) {
  return <MarkdownBody content={content} />;
});

/**
 * NoticeLine is hath's notice that the agent's work stopped (an error, a restart, a job left
 * unfinished): a quiet centered system line with its time, never a bubble, since the agent
 * did not say it.
 */
function NoticeLine({ message, live }: { message: ChatMessage; live: boolean }) {
  return (
    <MessageRow message={message} live={live} className="mx-auto flex max-w-[85%] flex-col items-center gap-0.5 py-1 text-center">
      <p role="note" data-selectable className="text-[12px] leading-relaxed text-ink-muted">
        {message.content}
      </p>
      <time dateTime={message.at} title={formatAbsolute(message.at)} className="text-[11px] text-ink-ghost">
        {formatMessageTime(message.at)}
      </time>
    </MessageRow>
  );
}
