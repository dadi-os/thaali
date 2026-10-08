import { memo } from "react";
import { motion } from "motion/react";
import {
  IconDismiss,
  IconRetry,
} from "../../../shared/components/IconButton";
import { CopyButton } from "../../../shared/components/CopyButton";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import { formatAbsolute } from "../../../shared/lib/ux/time";
import type { ChatMessage } from "../../../store/chat";
import { MarkdownBody } from "../../../shared/components/Markdown";
import { formatMessageTime } from "../format";
import { MessageFiles } from "./files";

export interface MessageBubbleProps {
  /** Message to render (user or agent). */
  message: ChatMessage;
  /**
   * Row appeared after this thread view opened.
   * Only these enter with motion (an agent reply wipes in); reopening a thread is static.
   */
  live?: boolean;
  /** Retry a failed user send. */
  onRetry?: () => void;
  /** Remove a failed or queued user message. */
  onCancel?: () => void;
}

/** Single chat row — quiet user pill or agent markdown, each with its time and a copy button. */
export function MessageBubble({
  message,
  live = false,
  onRetry,
  onCancel,
}: MessageBubbleProps) {
  if (message.from_user) {
    return (
      <UserBubble
        message={message}
        live={live}
        onRetry={onRetry}
        onCancel={onCancel}
      />
    );
  }
  return (
    <AgentBubble
      message={message}
      live={live}
    />
  );
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
    <div
      className={`flex items-center gap-0.5 px-1 text-[11px] text-ink-ghost ${
        align === "end" ? "flex-row-reverse" : ""
      }`}
    >
      <time dateTime={message.at} title={formatAbsolute(message.at)}>
        {formatMessageTime(message.at)}
      </time>
      <CopyButton
        text={message.content}
        label={copyLabel}
        className="opacity-0 transition-opacity duration-fast ease-dadi group-hover/msg:opacity-100 focus-within:opacity-100"
      />
    </div>
  );
}

const userRowClass = (queued: boolean, failed: boolean) =>
  `group/msg flex justify-end gap-1.5 ${queued || failed ? "items-center" : "items-end"}`;

/** Right-aligned user pill with optional retry / cancel for failed or queued sends. */
function UserBubble({
  message,
  live,
  onRetry,
  onCancel,
}: {
  message: ChatMessage;
  live: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const failed = Boolean(message.failed);
  const queued = Boolean(message.queued);
  const body = (
    <>
      {failed && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry send"
          title="Retry"
          className="inline-flex size-7 shrink-0 items-center justify-center text-error transition-opacity duration-slow ease-dadi hover:opacity-70"
        >
          <IconRetry />
        </button>
      ) : null}
      {(queued || failed) && onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Remove message"
          title="Remove"
          className="inline-flex size-7 shrink-0 items-center justify-center text-ink-ghost transition-opacity duration-slow ease-dadi hover:text-ink-muted"
        >
          <IconDismiss />
        </button>
      ) : null}
      <div className="flex min-w-0 max-w-[min(92%,34rem)] flex-col items-end gap-1">
        <MessageFiles
          files={message.files ?? []}
          sending={message.files ? [] : (message.attachments ?? [])}
          align="end"
        />
        {message.content ? (
          <div
            className={`rounded-[20px] px-3.5 py-2.5 text-[14.5px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere] ${
              failed
                ? "border border-error-line bg-error-fill text-ink"
                : queued
                  ? "border border-dashed border-sage-line/50 bg-sage-fill/25 text-ink/60"
                  : "bg-sage-active text-ink"
            }`}
          >
            {message.content}
          </div>
        ) : null}
        {message.sendError ? (
          <p className="px-1 text-[12px] leading-snug text-error">{message.sendError}</p>
        ) : null}
        <MessageMeta message={message} copyLabel="Copy message" align="end" />
      </div>
    </>
  );

  const className = userRowClass(queued, failed);
  if (!live) {
    return <div className={className}>{body}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: message.pending && !queued && !failed ? 0.7 : 1,
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      className={className}
    >
      {body}
    </motion.div>
  );
}

/** Entrance for a reply that arrives while its thread is open: finished markdown that wipes in top to bottom as it fades, rises and unblurs. */
const ARRIVE = {
  initial: { opacity: 0, y: 8, filter: "blur(5px)", clipPath: "inset(0% 0% 100% 0%)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", clipPath: "inset(0% 0% 0% 0%)" },
  transition: { duration: 0.62, ease: EASE },
} as const;

/**
 * Left-aligned agent row: the reply as rendered markdown from the first frame, with its
 * time and a copy button under it. A reply that arrives live enters with ARRIVE instead
 * of typing out, so markdown never snaps in after plain text.
 */
function AgentBubble({ message, live }: { message: ChatMessage; live: boolean }) {
  const className =
    "group/msg flex max-w-[min(96%,40rem)] flex-col gap-1 text-[14.5px] leading-[1.65] text-ink [overflow-anchor:none]";
  const body = (
    <>
      <SettledMarkdown content={message.content} />
      <MessageFiles files={message.files ?? []} sending={[]} align="start" />
      <MessageMeta message={message} copyLabel="Copy response" align="start" />
    </>
  );

  if (!live) {
    return <div className={className}>{body}</div>;
  }

  return (
    <motion.div
      initial={ARRIVE.initial}
      animate={ARRIVE.animate}
      exit={{ opacity: 0 }}
      transition={ARRIVE.transition}
      className={className}
    >
      {body}
    </motion.div>
  );
}

const SettledMarkdown = memo(function SettledMarkdown({
  content,
}: {
  content: string;
}) {
  return <MarkdownBody content={content} />;
});
