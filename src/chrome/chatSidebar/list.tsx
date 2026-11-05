import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Clamp, NameTruncate, Truncate } from "../../shared/ui/Truncate";
import type { Conversation, HistoryStatus } from "../../store/chat";
import type { RunningMap } from "../../store/running";
import { formatRailTime, groupByDay, plainPreview } from "./format";

/** The rail width from which a row shows two lines of its last message. */
export const WIDE_ROW_PX = 440;

/** The mask that fades the list out behind the dock. */
const FADE = "linear-gradient(180deg,#000 calc(100% - 110px),transparent 100%)";
/** How a list state eases in. */
const ARRIVE = "fade 320ms cubic-bezier(.22,.61,.36,1) both";

export type RailRowProps = {
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
};

/** One conversation: its agent's name, when it last spoke, the last message and the unread count. */
export function RailRow({ conversation, unread, working, selected, wide, now, onOpen }: RailRowProps) {
  const preview = (conversation.from_user ? "You: " : "") + plainPreview(conversation.last_message);
  return (
    <button type="button" className="rail-row ui-trans ui-hover-fill" aria-current={selected ? "true" : undefined} onClick={onOpen}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {working ? <span className="rail-dot" /> : null}
        <NameTruncate name={conversation.agent_name} style={{ flex: 1, fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" }} />
        <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap", flex: "none" }}>
          {formatRailTime(conversation.last_at, now)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: wide ? "flex-start" : "center", gap: 8 }}>
        {wide ? (
          <Clamp text={preview} lines={2} style={{ flex: 1, fontSize: 13.5, lineHeight: "19px", color: "var(--ink-muted)" }} />
        ) : (
          <Truncate text={preview} style={{ flex: 1, fontSize: 13.5, color: "var(--ink-muted)" }} />
        )}
        {unread > 0 ? (
          <span aria-label={`${unread} unread`} className="rail-badge">
            {unread}
          </span>
        ) : null}
      </div>
    </button>
  );
}

type ListNoticeProps = {
  mark: React.ReactNode;
  gap: number;
  title: string;
  detail: string | null;
  children?: React.ReactNode;
};

/** What the list shows instead of rows: a mark, a title, one line of detail and, for a failure, a retry. */
function ListNotice({ mark, gap, title, detail, children }: ListNoticeProps) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 300, alignItems: "center", justifyContent: "center", gap, textAlign: "center", padding: "0 20px 96px", animation: ARRIVE }}
    >
      {mark}
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: "18px", maxWidth: 220 }}>{detail}</span>
      {children}
    </div>
  );
}

export type ConversationListProps = {
  /** Thread-agent conversations, newest first. */
  conversations: Conversation[];
  /** Highlighted thread, if any. */
  selectedAgentId: string | null;
  historyStatus: HistoryStatus;
  historyError: string | null;
  /** Reload the conversations after a failed load. */
  onRetry: () => void;
  /** Lanes running per agent: a running agent's row opens with a pulsing dot. */
  running: RunningMap;
  /** Messages to you held while you were busy, per agent. */
  unread: Record<string, number>;
  /** The mesh is out of reach: the last answers stay, dimmed. */
  offline: boolean;
  /** Rows show two lines of their last message. */
  wide: boolean;
  /** Reference instant in ms since epoch. */
  now: number;
  onOpenAgent: (agentId: string) => void;
  onDismissKeyboard: () => void;
};

/**
 * The conversation list: a search over agent names, then the conversations under the day of
 * their last message. Before the first load it holds skeleton rows in the rows' shape; a
 * failed first load or an empty list says so in the middle of the list; the rows stay, dimmed,
 * while the mesh is out of reach. The router dock sits over the list's bottom, so the list
 * leaves room for it and fades out behind it.
 */
export function ConversationList({
  conversations,
  selectedAgentId,
  historyStatus,
  historyError,
  onRetry,
  running,
  unread,
  offline,
  wide,
  now,
  onOpenAgent,
  onDismissKeyboard,
}: ConversationListProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? conversations.filter((conv) => conv.agent_name.toLowerCase().includes(needle)) : conversations;
  const none = conversations.length === 0;
  const loading = none && (historyStatus === "idle" || historyStatus === "loading");
  const failed = none && historyStatus === "error";
  const notice = failed || (none && !loading) || (shown.length === 0 && !none);

  return (
    <>
      <div style={{ padding: "14px 14px 8px", flex: "none" }}>
        <label className="search-field">
          <Icon name="search" size={15} />
          <input
            type="search"
            className="sfi"
            placeholder="Search agents"
            aria-label="Search agents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
              } else if (e.key === "Enter" && shown.length === 1) {
                onOpenAgent(shown[0]!.agent_id);
              }
            }}
          />
        </label>
      </div>
      <div
        className="scroll"
        onClick={onDismissKeyboard}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          ...(offline ? { opacity: 0.62, filter: "saturate(.7)" } : {}),
          paddingBottom: notice ? 0 : 96,
          maskImage: FADE,
          WebkitMaskImage: FADE,
        }}
      >
        {loading ? (
          <div role="status" aria-label="Loading conversations" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 4px" }}>
            <span className="ui-label" style={{ padding: "4px 12px 6px" }}>
              Today
            </span>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Skeleton width={`${48 + ((i * 17) % 30)}%`} height={15} />
                  <Skeleton width={44} height={12} style={{ marginLeft: "auto" }} />
                </div>
                <Skeleton width={`${62 + ((i * 11) % 28)}%`} height={12} />
              </div>
            ))}
          </div>
        ) : failed ? (
          <ListNotice
            gap={10}
            mark={
              <span className="rail-mark" style={{ background: "var(--error-fill)", color: "var(--error)" }}>
                <Icon name="alert" size={18} />
              </span>
            }
            title="Can’t load conversations"
            detail={historyError}
          >
            <Button tone="outline" pill icon="retry" onClick={onRetry} style={{ color: "var(--sage-text)" }}>
              Retry
            </Button>
          </ListNotice>
        ) : none ? (
          <ListNotice
            gap={8}
            mark={
              <span className="rail-mark rail-mark-dadi" style={{ background: "var(--sage-fill)", color: "var(--sage-text)" }}>
                દ
              </span>
            }
            title="No conversations yet"
            detail="Talk to Dadi to start one."
          />
        ) : shown.length === 0 ? (
          <ListNotice
            gap={8}
            mark={
              <span className="rail-mark" style={{ background: "var(--sage-fill)", color: "var(--sage-text)" }}>
                <Icon name="search" size={18} />
              </span>
            }
            title="No agent matches"
            detail={`Nothing is called “${query.trim()}”.`}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 4px" }}>
            {groupByDay(shown, now).flatMap((group) => [
              <span key={`day:${group.label}`} className="ui-label" style={{ padding: "12px 12px 6px" }}>
                {group.label}
              </span>,
              ...group.items.map((conv) => (
                <RailRow
                  key={conv.agent_id}
                  conversation={conv}
                  unread={unread[conv.agent_id] ?? 0}
                  working={running[conv.agent_id]?.work === true || running[conv.agent_id]?.process === true}
                  selected={conv.agent_id === selectedAgentId}
                  wide={wide}
                  now={now}
                  onOpen={() => onOpenAgent(conv.agent_id)}
                />
              )),
            ])}
          </div>
        )}
      </div>
    </>
  );
}
