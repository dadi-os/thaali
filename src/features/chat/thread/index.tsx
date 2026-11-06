import { useEffect, useRef, useState, type RefObject, type UIEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../../shared/motion";
import type { AgentRecord } from "../../../types/hath";
import { messageKey, type ChatMessage } from "../../../contexts/chat";
import { trackIncoming } from "../lanes";
import { MessageBubble } from "../../../shared/components/Thread/Message";
import { ThreadEmpty } from "./ThreadEmpty";
import { ThreadSkeleton } from "./ThreadSkeleton";

/** Messages drawn when a thread opens, and added by each press on the button above them. */
const PAGE = 40;

export interface ThreadViewProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onDismissKeyboard: () => void;
  /** Measured space under the floating composer, so the last line clears it. */
  composerPad: number;
  /** A host pin sits above the pane; dissolve messages as they scroll under it. */
  fadeTop: boolean;
  /** Space kept clear at the top for the floating header, which messages scroll under. */
  headerPad: number;
  settledMessages: ChatMessage[];
  queuedMessages: ChatMessage[];
  onRetry: (msg: ChatMessage) => void;
  onCancel: (seq: number) => void;
  /** Display name of the open agent, for the empty state. */
  agentName: string;
  /** Open agent's record once loaded; adds spawn time to the empty state. */
  agent?: AgentRecord;
  /**
   * History fetch outcome for this thread: null while loading, then either
   * settled (`error` null) or failed with the server message.
   */
  load: { error: string | null } | null;
  /** Fill the composer with an empty-state starter prompt. */
  onSuggest: (text: string) => void;
}

/** Open thread scroll pane: settled messages and queued sends. The composer's lane pill shows what the agent is doing. */
export function ThreadView({
  scrollRef,
  onScroll,
  onDismissKeyboard,
  composerPad,
  fadeTop,
  headerPad,
  settledMessages,
  queuedMessages,
  onRetry,
  onCancel,
  agentName,
  agent,
  load,
  onSuggest,
}: ThreadViewProps) {
  const knownRef = useRef<Set<string>>(new Set());
  const liveRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  trackIncoming(
    knownRef.current,
    liveRef.current,
    [...settledMessages, ...queuedMessages],
    !seededRef.current,
  );
  seededRef.current = true;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  const [shown, setShown] = useState(PAGE);
  const hidden = Math.max(0, settledMessages.length - shown);
  const drawn = hidden > 0 ? settledMessages.slice(hidden) : settledMessages;
  const isEmpty =
    settledMessages.length === 0 && queuedMessages.length === 0;

  return (
    <div className="absolute inset-0">
      <AnimatePresence initial={false}>
        {isEmpty && load ? (
          <motion.div
            key="empty"
            {...FADE}
            className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-8 [&>*]:pointer-events-auto"
            style={{ paddingBottom: composerPad }}
          >
            {load.error ? (
              <p role="alert" data-selectable className="max-w-[16rem] text-center text-[13px] leading-relaxed text-error">
                Couldn't load messages. {load.error}
              </p>
            ) : (
              <ThreadEmpty name={agentName} agent={agent} onSuggest={onSuggest} />
            )}
          </motion.div>
        ) : null}
        {isEmpty && load === null ? (
          <ThreadSkeleton key="loading" label="Loading messages" bottomPad={composerPad + 16} />
        ) : null}
      </AnimatePresence>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onClick={onDismissKeyboard}
        data-edge-fade="off"
        className={`scroll h-full overflow-y-auto overscroll-contain px-3.5 pb-4 ${
          fadeTop ? "thread-fade-top" : ""
        }`}
        style={{ paddingTop: headerPad + 16, paddingBottom: composerPad }}
      >
        <div className="flex flex-col gap-4">
          {hidden > 0 ? (
            <button type="button" className="ui-trans ui-hover-fill self-center rounded-full px-3.5 py-1.5 text-[13px] text-ink-muted" onClick={() => setShown((count) => count + PAGE)}>
              {`Show ${Math.min(PAGE, hidden)} earlier ${Math.min(PAGE, hidden) === 1 ? "message" : "messages"}`}
            </button>
          ) : null}
          <AnimatePresence initial={false}>
            {drawn.map((msg) => (
              <MessageBubble
                key={messageKey(msg)}
                message={msg}
                live={liveRef.current.has(messageKey(msg))}
                onRetry={
                  msg.from_user ? () => onRetry(msg) : undefined
                }
                onCancel={
                  msg.failed ? () => onCancel(msg.seq) : undefined
                }
              />
            ))}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {queuedMessages.map((msg) => (
              <MessageBubble
                key={messageKey(msg)}
                message={msg}
                live={liveRef.current.has(messageKey(msg))}
                onCancel={() => onCancel(msg.seq)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
