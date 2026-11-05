import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ConversationRow } from "../../shared/components/Thread/ConversationRow";
import { groupByDay } from "../../shared/components/Thread/format";
import { FADE } from "../../shared/motion";
import { StateView } from "../../shared/states/ModuleState";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import type { Conversation, HistoryStatus } from "../../contexts/chat";
import type { RunningMap } from "../../contexts/running";

/** The rail width from which a row shows two lines of its last message. */
export const WIDE_ROW_PX = 440;

/** The mask that fades the list out behind the dock. */
const FADE_MASK = "linear-gradient(180deg,#000 calc(100% - 110px),transparent 100%)";

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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? conversations.filter((conv) => conv.agent_name.toLowerCase().includes(needle)) : conversations;
  const none = conversations.length === 0;
  const loading = none && (historyStatus === "idle" || historyStatus === "loading");
  const failed = none && historyStatus === "error";
  const notice = failed || (none && !loading) || (shown.length === 0 && !none);
  const state = loading ? "loading" : failed ? "failed" : none ? "none" : shown.length === 0 ? "no-match" : "rows";

  return (
    <>
      <div className="flex-none px-3.5 pt-3.5 pb-2">
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
        className={`scroll flex min-h-0 flex-1 flex-col transition-[opacity,filter] duration-slow ease-dadi ${offline ? "opacity-[.62] saturate-[.7]" : ""} ${notice ? "" : "pb-24"}`}
        onClick={onDismissKeyboard}
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={state} {...FADE} className="flex min-h-0 flex-1 flex-col">
            {state === "loading" ? (
              <div role="status" aria-label="Loading conversations" className="flex flex-col gap-1 px-1">
                <span className="ui-label px-3 pt-1 pb-1.5">Today</span>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex flex-col gap-2 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Skeleton width={`${48 + ((i * 17) % 30)}%`} height={15} />
                      <Skeleton width={44} height={12} style={{ marginLeft: "auto" }} />
                    </div>
                    <Skeleton width={`${62 + ((i * 11) % 28)}%`} height={12} />
                  </div>
                ))}
              </div>
            ) : state === "failed" ? (
              <div className="flex min-h-[300px] flex-1 items-center justify-center px-5 pb-24">
                <StateView kind="error" title="Can’t load conversations" detail={historyError ?? undefined} onRetry={onRetry} />
              </div>
            ) : state === "none" ? (
              <div className="flex min-h-[300px] flex-1 items-center justify-center px-5 pb-24">
                <StateView kind="empty" title="No conversations yet" detail="Talk to Dadi to start one." />
              </div>
            ) : state === "no-match" ? (
              <div className="flex min-h-[300px] flex-1 items-center justify-center px-5 pb-24">
                <StateView kind="empty" title="No agent matches" detail={`Nothing is called “${query.trim()}”.`} />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 px-1">
                {groupByDay(shown, now).flatMap((group) => [
                  <span key={`day:${group.label}`} className="ui-label px-3 pt-3 pb-1.5">
                    {group.label}
                  </span>,
                  ...group.items.map((conv) => (
                    <ConversationRow
                      key={conv.agent_id}
                      conversation={conv}
                      unread={unread[conv.agent_id] ?? 0}
                      working={running[conv.agent_id]?.work === true || running[conv.agent_id]?.process === true}
                      selected={conv.agent_id === selectedAgentId}
                      wide={wide}
                      now={now}
                      onOpen={() => onOpenAgent(conv.agent_id)}
                      onOpenInHath={() => navigate({ pathname: "/hath", search: `?agent=${conv.agent_id}` })}
                    />
                  )),
                ])}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
