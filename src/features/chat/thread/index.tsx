import { useEffect, useRef, useState, type RefObject, type UIEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../../shared/motion";
import type { AgentRecord } from "../../../types/hath";
import { latestAgentStatus, messageKey, type ChatMessage } from "../../../contexts/chat";
import { trackIncoming } from "../incoming";
import { ScrollEdge } from "../../../shared/ui/ScrollEdge";
import { MessageBubble } from "../../../shared/components/Thread/Message";
import { parseReply, quotes } from "../../../shared/components/Thread/replyQuote";
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
  messages: ChatMessage[];
  onRetry: (msg: ChatMessage) => void;
  onDismiss: (seq: number) => void;
  /** Display name of the open agent, for the empty state. */
  agentName: string;
  /** Open agent's record once loaded; adds spawn time to the empty state. */
  agent?: AgentRecord;
  /**
   * History fetch outcome for this thread: null while loading, then either
   * settled (`error` null) or failed with the server message.
   */
  load: { error: string | null } | null;
  /** The pane has finished sliding in: until then a skeleton stands in for the messages, so drawing them never competes with the slide. */
  ready: boolean;
  /** Fill the composer with an empty-state starter prompt. */
  onSuggest: (text: string) => void;
}

/** Room the scroll-edge effect takes beyond the floating elements, so text dissolves before it reaches them. */
const EDGE_REACH_PX = 44;

/** The key of the newest message before `index` that `quote` was taken from, or null when it is not loaded. */
function quotedKey(messages: ChatMessage[], index: number, quote: string): string | null {
  for (let i = index - 1; i >= 0; i--) {
    if (quotes(quote, messages[i]!.content)) {
      return messageKey(messages[i]!);
    }
  }
  return null;
}

/** Scrolls the message with this key to the middle of the pane and washes it briefly. */
function flashMessage(pane: HTMLElement | null, key: string): void {
  const row = pane?.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(key)}"]`);
  if (!row) {
    return;
  }
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  row.classList.remove("message-flash");
  void row.offsetWidth;
  row.classList.add("message-flash");
  row.addEventListener("animationend", () => row.classList.remove("message-flash"), { once: true });
}

/** Open thread scroll pane: the human thread's messages. The composer's activity pill shows what the agent is doing, and the agent's newest message carries what the thread still waits on. */
export function ThreadView({
  scrollRef,
  onScroll,
  onDismissKeyboard,
  composerPad,
  fadeTop,
  headerPad,
  messages,
  onRetry,
  onDismiss,
  agentName,
  agent,
  load,
  ready,
  onSuggest,
}: ThreadViewProps) {
  const knownRef = useRef<Set<string>>(new Set());
  const liveRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  trackIncoming(
    knownRef.current,
    liveRef.current,
    messages,
    !seededRef.current,
  );
  seededRef.current = true;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [scrollRef, ready]);

  const [shown, setShown] = useState(PAGE);
  const hidden = Math.max(0, messages.length - shown);
  const drawn = hidden > 0 ? messages.slice(hidden) : messages;
  const isEmpty = messages.length === 0;
  const standing = latestAgentStatus(messages);
  const newestAgent = [...messages].reverse().find((msg) => msg.seq >= 0 && !msg.from_user);

  return (
    <div className="absolute inset-0">
      {headerPad > 0 ? <ScrollEdge edge="top" size={headerPad + EDGE_REACH_PX - 16} /> : null}
      {composerPad > 0 ? <ScrollEdge edge="bottom" size={composerPad + EDGE_REACH_PX - 16} /> : null}
      <AnimatePresence initial={false}>
        {ready && isEmpty && load ? (
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
        {!ready || (isEmpty && load === null) ? (
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
        <motion.div className="flex flex-col gap-4" initial={false} animate={{ opacity: ready ? 1 : 0 }} transition={{ duration: 0.22 }}>
          {!ready ? null : hidden > 0 ? (
            <button type="button" className="ui-trans ui-hover-fill self-center rounded-full px-3.5 py-1.5 text-[13px] text-ink-muted" onClick={() => setShown((count) => count + PAGE)}>
              {`Show ${Math.min(PAGE, hidden)} earlier ${Math.min(PAGE, hidden) === 1 ? "message" : "messages"}`}
            </button>
          ) : null}
          <AnimatePresence initial={false}>
            {drawn.map((msg, index) => {
              const quote = parseReply(msg.content).quote;
              const original = quote === null ? null : quotedKey(drawn, index, quote);
              return (
              <MessageBubble
                key={messageKey(msg)}
                message={msg}
                live={liveRef.current.has(messageKey(msg))}
                onRetry={
                  msg.from_user ? () => onRetry(msg) : undefined
                }
                onCancel={
                  msg.failed ? () => onDismiss(msg.seq) : undefined
                }
                standing={msg === newestAgent ? standing : null}
                onJumpToQuote={original === null ? undefined : () => flashMessage(scrollRef.current, original)}
              />
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
