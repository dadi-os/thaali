import { motion } from "motion/react";
import { InlineMarkdown } from "../../../shared/components/Markdown";
import { EASE } from "../../../shared/lib/ux/motion";
import type { Conversation, HistoryStatus } from "../../../store/chat";
import type { RunningMap } from "../../../store/running";
import { ActivityPulse } from "../ActivityPulse";
import { Avatar } from "../Avatar";
import { groupConversations } from "../format";
import { LaneMark } from "../LaneChip";
import { laneChipLabel } from "../toolStatus";

export interface ConversationListProps {
  /** Thread-agent conversations (excludes Dadi). */
  conversations: Conversation[];
  /** Highlighted thread, if any. */
  selectedAgentId: string | null;
  historyStatus: HistoryStatus;
  historyError: string | null;
  /** Lanes running per agent; busy chats rise into a Working group with a live status line. */
  running: RunningMap;
  /** Messages to you held while you were busy, per agent; those rows read bold with a count. */
  unread: Record<string, number>;
  onOpenAgent: (agentId: string) => void;
  onDismissKeyboard: () => void;
  /** Pinned Talk to Dadi control — the sole new-chat entry. */
  dadi: {
    available: boolean;
    selected: boolean;
    preview: string | null;
    busy: boolean;
    onOpen: () => void;
  };
}

/**
 * Conversation list pane: chats whose agent is thinking or working sit in a Working
 * group on top, the rest group by day. Enter/exit motion is owned by the sidebar stage —
 * rows stay static so a parent transform can fall away as one surface.
 */
export function ConversationList({
  conversations,
  selectedAgentId,
  historyStatus,
  historyError,
  running,
  unread,
  onOpenAgent,
  onDismissKeyboard,
  dadi,
}: ConversationListProps) {
  const busy = (agentId: string) =>
    running[agentId]?.conversation === true || running[agentId]?.reasoning === true;
  const working = conversations.filter((c) => busy(c.agent_id));
  const groups = [
    ...(working.length > 0 ? [{ bucket: "Working", items: working }] : []),
    ...groupConversations(conversations.filter((c) => !busy(c.agent_id))),
  ];
  const loading = historyStatus === "loading" && conversations.length === 0;
  const failed = historyStatus === "error" && conversations.length === 0;

  return (
    <div
      onClick={onDismissKeyboard}
      className="absolute inset-0 flex flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <p className="text-center text-[13px] text-ink-muted">
              Couldn&apos;t load conversations
            </p>
            <p className="mt-1.5 max-w-[16rem] text-center text-[12px] leading-relaxed text-ink-ghost">
              {historyError}
            </p>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center">
            <ActivityPulse />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <p className="text-center text-[13px] text-ink-ghost">
              No conversations
            </p>
          </div>
        ) : (
          <div className="flex flex-col pb-2">
            {groups.map((group) => (
              <div key={group.bucket} className="mt-1 first:mt-0">
                <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium text-ink-ghost">
                  {group.bucket}
                </p>
                {group.items.map((conv) => {
                  const selected = conv.agent_id === selectedAgentId;
                  const lanes = running[conv.agent_id];
                  const conversation = lanes?.conversation === true;
                  const reasoning = lanes?.reasoning === true;
                  const lane = laneChipLabel(conversation, reasoning);
                  const held = unread[conv.agent_id];
                  return (
                    <button
                      key={conv.agent_id}
                      type="button"
                      onClick={() => onOpenAgent(conv.agent_id)}
                      className={`flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors duration-fast ease-dadi ${
                        selected
                          ? "bg-(--chat-active)"
                          : "hover:bg-(--chat-hover)"
                      }`}
                    >
                      <Avatar
                        glyph={conv.agent_name.charAt(0).toUpperCase()}
                        live={lane !== null}
                        className="size-7 text-[12px]"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={`truncate text-[13.5px] text-ink ${held ? "font-semibold" : "font-medium"}`}
                        >
                          {conv.agent_name}
                        </span>
                        {lane ? (
                          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-sage-text">
                            <LaneMark conversation={conversation} reasoning={reasoning} />
                            {lane}
                          </span>
                        ) : (
                          <span className={`truncate text-[12px] ${held ? "text-ink-muted" : "text-ink-ghost"}`}>
                            {conv.from_user ? "You: " : ""}
                            <InlineMarkdown content={conv.last_message} />
                          </span>
                        )}
                      </span>
                      {held ? (
                        <span
                          aria-label={`${held} unread`}
                          className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-sage-deep px-1.5 text-[10.5px] font-semibold text-bone"
                        >
                          {held}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-(--chat-edge) px-2 py-2">
        <motion.button
          type="button"
          onClick={dadi.onOpen}
          disabled={!dadi.available}
          whileHover={dadi.available ? { scale: 1.012 } : undefined}
          whileTap={dadi.available ? { scale: 0.985 } : undefined}
          transition={{ duration: 0.18, ease: EASE }}
          className={`flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left transition-colors duration-fast ease-dadi disabled:opacity-50 ${
            dadi.selected
              ? "bg-(--chat-active)"
              : "hover:bg-(--chat-hover)"
          }`}
        >
          <Avatar glyph="દ" gujarati live={dadi.busy} className="size-8 text-[15px]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-ink">
              Talk to Dadi
            </span>
            {dadi.busy ? (
              <span className="flex items-center gap-1.5 text-[12px] text-sage-text">
                <LaneMark conversation reasoning={false} />
                routing
              </span>
            ) : (
              <span className="block truncate text-[12px] text-ink-ghost">
                {dadi.preview ? (
                  <InlineMarkdown content={dadi.preview} />
                ) : (
                  "Start something new"
                )}
              </span>
            )}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
