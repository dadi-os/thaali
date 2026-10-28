import { useState } from "react";
import { motion } from "motion/react";
import { InlineMarkdown } from "../../shared/components/Markdown";
import { EASE } from "../../shared/lib/ux/motion";
import type { Conversation, HistoryStatus } from "../../store/chat";
import type { RunningMap } from "../../store/running";
import { formatListTime, groupConversations } from "./format";
import { ThinkingMark } from "./LaneChip";

export interface ConversationListProps {
  /** Thread-agent conversations (excludes Dadi). */
  conversations: Conversation[];
  /** Highlighted thread, if any. */
  selectedAgentId: string | null;
  historyStatus: HistoryStatus;
  historyError: string | null;
  /** Lanes running per agent: a thinking chat shows the flowing dots in its row, a working one the sheen across it. */
  running: RunningMap;
  /** Messages to you held while you were busy, per agent; those rows read bold with a count. */
  unread: Record<string, number>;
  onOpenAgent: (agentId: string) => void;
  onDismissKeyboard: () => void;
  /** Pinned Talk to Dadi control — the sole new-chat entry, marked દ with a ring pulsing out while it routes. Noto Sans Gujarati sets a lone દ 0.0525em above its line box's center, so the circle pads it down by twice that. */
  dadi: {
    available: boolean;
    selected: boolean;
    preview: string | null;
    busy: boolean;
    onOpen: () => void;
  };
}

/** Widths, in percent, of the skeleton rows shown while history loads. */
const SKELETON_ROWS = [52, 40, 60, 46, 56, 38, 50, 44];

/**
 * Conversation list pane grouped by day under a search over agent names, each row its
 * agent's name, last message and when it came. While history loads the rows are skeletons. A busy chat stays in its place and shows it there: the flowing dots while
 * its agent thinks, the working sheen across the row while it works. Enter/exit motion is
 * owned by the sidebar stage — rows stay static so a parent transform can fall away as one
 * surface.
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
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? conversations.filter((conv) => conv.agent_name.toLowerCase().includes(needle))
    : conversations;
  const groups = groupConversations(shown);
  const loading = historyStatus === "loading" && conversations.length === 0;
  const failed = historyStatus === "error" && conversations.length === 0;

  return (
    <div
      onClick={onDismissKeyboard}
      className="absolute inset-0 flex flex-col"
    >
      <label className="mx-3.5 mt-3.5 mb-1.5 flex h-[34px] shrink-0 items-center gap-2 rounded-[10px] border border-(--chat-edge) bg-(--chat-field) px-3 text-ink-ghost transition-colors duration-slow ease-dadi focus-within:border-sage">
        <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
            } else if (e.key === "Enter" && shown.length === 1) {
              onOpenAgent(shown[0].agent_id);
            }
          }}
          placeholder="Search agents"
          aria-label="Search agents"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-ghost [&::-webkit-search-cancel-button]:appearance-none"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
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
          <div role="status" aria-label="Loading conversations" className="flex flex-col gap-1 px-2.5 pt-4">
            <span className="skeleton mb-2 h-2.5 w-12" />
            {SKELETON_ROWS.map((width, index) => (
              <span key={index} className="flex flex-col gap-2 py-2.5">
                <span className="skeleton h-2.5" style={{ width: `${width}%` }} />
                <span className="skeleton h-2" style={{ width: `${width + 22}%` }} />
              </span>
            ))}
          </div>
        ) : shown.length === 0 && needle ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <p className="text-center text-[13px] text-ink-ghost">
              No agent matches &ldquo;{query.trim()}&rdquo;
            </p>
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
                <p className="px-2.5 pt-3.5 pb-1.5 text-[11px] font-semibold text-ink-ghost">
                  {group.bucket}
                </p>
                {group.items.map((conv) => {
                  const selected = conv.agent_id === selectedAgentId;
                  const thinking = running[conv.agent_id]?.conversation === true;
                  const working = running[conv.agent_id]?.reasoning === true;
                  const held = unread[conv.agent_id];
                  return (
                    <button
                      key={conv.agent_id}
                      type="button"
                      onClick={() => onOpenAgent(conv.agent_id)}
                      className={`flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-[9px] text-left transition-colors duration-fast ease-dadi ${
                        selected
                          ? "bg-(--chat-active)"
                          : "hover:bg-(--chat-hover)"
                      } ${working ? "lane-sheen" : ""}`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-[14px] text-ink ${held ? "font-bold" : "font-semibold"}`}
                          >
                            {conv.agent_name}
                          </span>
                          <time
                            dateTime={conv.last_at}
                            className={`shrink-0 text-[11.5px] ${held ? "text-sage-text" : "text-ink-ghost"}`}
                          >
                            {formatListTime(conv.last_at)}
                          </time>
                        </span>
                        {thinking ? (
                          <span className="flex h-[18px] items-center">
                            <ThinkingMark />
                          </span>
                        ) : (
                          <span className={`truncate text-[12.5px] ${held ? "text-ink" : "text-ink-muted"}`}>
                            {conv.from_user ? "You: " : ""}
                            <InlineMarkdown content={conv.last_message} />
                          </span>
                        )}
                      </span>
                      {held ? (
                        <span
                          aria-label={`${held} unread`}
                          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sage-deep px-1.5 text-[11px] font-bold text-bone"
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

      <div className="shrink-0 p-2.5">
        <motion.button
          type="button"
          onClick={dadi.onOpen}
          disabled={!dadi.available}
          whileHover={dadi.available ? { scale: 1.012 } : undefined}
          whileTap={dadi.available ? { scale: 0.985 } : undefined}
          transition={{ duration: 0.18, ease: EASE }}
          className={`flex w-full items-center gap-3 rounded-[14px] border border-(--chat-edge) px-3 py-2.5 text-left shadow-[var(--shadow)] transition-colors duration-fast ease-dadi disabled:opacity-60 ${
            dadi.selected ? "bg-(--chat-active)" : "bg-(--chat-card) hover:bg-(--chat-field)"
          }`}
        >
          <span className="relative inline-flex size-8 shrink-0 text-[15px]" aria-hidden>
            {dadi.busy ? (
              <span className="animate-pulse-out absolute inset-0 rounded-full bg-sage/45 [--pulse-scale:1.55]" />
            ) : null}
            <span
              className={`relative flex size-full items-center justify-center rounded-full pt-[0.105em] font-gujarati leading-none ${
                dadi.busy ? "bg-sage-active text-sage-deep" : "bg-sage-fill text-sage-text"
              }`}
            >
              દ
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">
              Talk to Dadi
            </span>
            {dadi.busy ? (
              <span className="flex items-center gap-1.5 text-[12px] text-sage-text">
                <ThinkingMark />
                routing
              </span>
            ) : (
              <span className="block truncate text-[12px] text-ink-ghost">
                {!dadi.available ? (
                  "Back when dadi reconnects"
                ) : dadi.preview ? (
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
