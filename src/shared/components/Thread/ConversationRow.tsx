import { AnimatePresence, motion } from "motion/react";
import type { Conversation } from "../../../store/chat";
import { useContextActions } from "../../interaction/contextMenu";
import { FADE, RISE } from "../../motion";
import { AgentName } from "../../ui/AgentName";
import { Clamp, Truncate } from "../../ui/Truncate";
import { conversationActions, type ConversationActionDeps } from "./actions";
import { formatRailTime, plainPreview } from "./format";

/** Props of {@link ConversationRow}. */
export type ConversationRowProps = {
  conversation: Conversation;
  /** Messages to you this conversation holds unread. */
  unread: number;
  /** An agent lane is running: a pulsing dot opens the row. */
  working: boolean;
  selected: boolean;
  /** Show two lines of the last message instead of one. */
  wide: boolean;
  /** Reference instant in ms since epoch for the time on the right. */
  now: number;
  onOpen: () => void;
  /** Open the agent in the Hath page, for the right-click menu. */
  onOpenInHath: ConversationActionDeps["onOpenInHath"];
};

/**
 * One conversation: the agent's full name, when it last spoke, the last message and the unread count. It
 * enters with RISE, and right-click offers open thread, open in Hath and mark read.
 */
export function ConversationRow({ conversation, unread, working, selected, wide, now, onOpen, onOpenInHath }: ConversationRowProps) {
  const preview = (conversation.from_user ? "You: " : "") + plainPreview(conversation.last_message);
  const context = useContextActions(() => conversationActions(conversation, { unread, onOpenThread: onOpen, onOpenInHath }));
  return (
    <motion.div {...RISE} {...context} layout="position">
      <button type="button" className="rail-row ui-trans ui-hover-fill" aria-current={selected ? "true" : undefined} onClick={onOpen}>
        <div className="flex items-start gap-2">
          <AnimatePresence initial={false}>{working ? <motion.span key="working" {...FADE} className="rail-dot mt-[7px]" /> : null}</AnimatePresence>
          <AgentName name={conversation.agent_name} selectable={false} className="flex-1 text-[15px] leading-snug font-semibold tracking-[-0.005em]" />
          <span className="flex-none pt-0.5 text-[12px] whitespace-nowrap text-ink-muted">{formatRailTime(conversation.last_at, now)}</span>
        </div>
        <div className={`flex gap-2 ${wide ? "items-start" : "items-center"}`}>
          {wide ? (
            <Clamp text={preview} lines={2} style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: "19px", color: "var(--ink-muted)" }} />
          ) : (
            <Truncate text={preview} className="min-w-0 flex-1 text-[13.5px] text-ink-muted" />
          )}
          <AnimatePresence initial={false}>
            {unread > 0 ? (
              <motion.span key="unread" {...FADE} aria-label={`${unread} unread`} className="rail-badge">
                {unread}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </button>
    </motion.div>
  );
}
