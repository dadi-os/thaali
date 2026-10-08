import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { hath, nas } from "../../shared/api";
import type { AgentRecord } from "../../types/hath";
import { HostPin } from "./HostPin";
import {
  pickLiveBrowser,
  pickLiveTerminal,
} from "../../features/agents/sessions";
import { AgentPopover } from "../../features/agents/AgentPopover";
import type { PopoverAnchor } from "../../shared/components/Popover";
import { useConnection } from "../../shared/hooks/useConnection";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { isMeshOnline } from "../../shared/api";
import {
  addOptimistic,
  clearLiveChat,
  getChatState,
  hydrateThreadMessages,
  ingestLiveMessage,
  listQueuedThread,
  markFailed,
  markPending,
  mergeConversations,
  openAgent,
  openDadi,
  openList,
  removeMessage,
  resolveOptimistic,
  setHistoryState,
  subscribeChat,
  type MessageAttachment,
} from "../../store/chat";
import { DADI_DRAFT_KEY, loadDraft, saveDraft } from "../../store/drafts";
import { failureTarget, pushToast } from "../../store/toasts";
import {
  getRunning,
  isDadiBusy,
  seedRunningFromAgents,
  setDadiBusy,
  subscribeRunning,
} from "../../store/running";
import {
  filesToDraftAttachments,
  MAX_ATTACHMENTS,
  revokeDraftPreviews,
  toMessageAttachments,
  type DraftAttachment,
} from "../../shared/lib/content/attachments";
import { EASE } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { logLine } from "../../shared/lib/platform/log";
import { FloatingComposer } from "./composer";
import {
  COMPOSER_GAP,
  HISTORY_LOG_LIMIT,
  NEAR_BOTTOM_PX,
  TEXTAREA_MAX_PX,
  LIST_REFRESH_MS,
  THREAD_REFRESH_MS,
} from "./constants";
import { ActivityPulse } from "./ActivityPulse";
import { DadiHome, type DadiRouting } from "./DadiHome";
import { partitionByQueued } from "./lanes";
import { ConversationList } from "./list";
import { PaneHeader } from "./PaneHeader";
import { ThreadView } from "./thread";

/** What the open thread can show of its agent, from GET /agents, the one source of its name and record. */
type OpenAgent =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; agent: AgentRecord; agents: AgentRecord[] };

/**
 * Resolve the open thread's agent from the agents query: the query's real error, still
 * loading, or the record (an id the list does not hold is an error, not a blank name).
 * Null when no thread is open.
 */
function resolveOpenAgent(
  agentId: string | null,
  query: UseQueryResult<AgentRecord[]>,
): OpenAgent | null {
  if (agentId === null) {
    return null;
  }
  if (query.isError) {
    return { kind: "error", message: query.error.message };
  }
  if (!query.data) {
    return { kind: "loading" };
  }
  const agent = query.data.find((a) => a.id === agentId);
  return agent
    ? { kind: "ready", agent, agents: query.data }
    : { kind: "error", message: `Hath has no agent ${agentId}` };
}

export interface ChatSidebarProps {
  /** Bumps when chat opens; scrolls the thread to the bottom. */
  sessionKey: number;
  className?: string;
}

/**
 * Conversation list + thread views. Live messages arrive via SSE; history is
 * loaded from durable Hath `GET /threads` and `GET /agents/:id/messages`.
 * Talk to Dadi is a composer onto POST /router.
 */
export function ChatSidebar({ sessionKey, className }: ChatSidebarProps) {
  const queryClient = useQueryClient();
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const chat = useSyncExternalStore(subscribeChat, getChatState, getChatState);
  const running = useSyncExternalStore(
    subscribeRunning,
    getRunning,
    getRunning,
  );

  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>(
    [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const stickToBottomRef = useRef(true);
  /** Talk to Dadi send in flight: the text being routed, until a thread opens. */
  const [routing, setRouting] = useState<DadiRouting | null>(null);
  /** Server message from the last failed Talk to Dadi send. */
  const [routeError, setRouteError] = useState<string | null>(null);
  /** First history fetch outcome per open thread; the empty state waits on it. */
  const [threadLoad, setThreadLoad] = useState<{
    agentId: string;
    error: string | null;
  } | null>(null);
  /** Measured floating composer height; the thread pads by it so text clears it. */
  const [composerHeight, setComposerHeight] = useState(0);
  const refreshThreadRef = useRef<(() => void) | null>(null);
  /** Where the open agent's details popover anchors, relative to the rail: its right edge, level with the name bubble; null while closed. */
  const [detailsAnchor, setDetailsAnchor] = useState<PopoverAnchor | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  const dadiBusy = isDadiBusy();

  const agentsQuery = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const { agents } = await hath.listAgents();
      seedRunningFromAgents(agents);
      return agents;
    },
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const browsersQuery = useQuery({
    queryKey: ["nas", "browsers"],
    queryFn: () => nas.listBrowsers(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const terminalsQuery = useQuery({
    queryKey: ["nas", "terminals"],
    queryFn: () => nas.listTerminals(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    if (connection === "disconnected") {
      clearLiveChat();
      setDadiBusy(false);
    }
  }, [connection]);

  const openAgentId =
    chat.open.kind === "agent" ? chat.open.agentId : null;
  const viewingDadi = chat.open.kind === "dadi";
  const viewingThread = chat.open.kind === "agent";
  const threadMessages = openAgentId
    ? (chat.threads[openAgentId] ?? [])
    : [];

  const draftKey = openAgentId ?? DADI_DRAFT_KEY;
  const draftKeyRef = useRef(draftKey);
  const [draft, setDraftText] = useState(() => loadDraft(draftKey));
  const setDraft = (text: string) => {
    setDraftText(text);
    saveDraft(draftKeyRef.current, text);
    if (routeError) {
      setRouteError(null);
    }
  };
  useLayoutEffect(() => {
    if (draftKeyRef.current === draftKey) {
      return;
    }
    draftKeyRef.current = draftKey;
    setDraftText(loadDraft(draftKey));
    setDraftAttachments((prev) => {
      revokeDraftPreviews(prev);
      return [];
    });
  }, [draftKey]);

  const conversationBusy =
    viewingThread && openAgentId
      ? running[openAgentId]?.conversation === true
      : dadiBusy;
  const reasoningBusy =
    viewingThread && openAgentId
      ? running[openAgentId]?.reasoning === true
      : false;

  const scrollToBottom = useEffectEvent((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
  });

  useEffect(() => {
    stickToBottomRef.current = true;
    scrollToBottom("auto");
  }, [sessionKey, chat.open]);

  useLayoutEffect(() => {
    if (!viewingThread || !stickToBottomRef.current) {
      return;
    }
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [threadMessages, conversationBusy, reasoningBusy, viewingThread, composerHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, [draft, chat.open]);

  useEffect(() => {
    setDetailsAnchor(null);
  }, [chat.open]);

  const draftAttachmentsRef = useRef(draftAttachments);
  draftAttachmentsRef.current = draftAttachments;
  useEffect(() => {
    return () => {
      revokeDraftPreviews(draftAttachmentsRef.current);
    };
  }, []);

  /**
   * Load the open thread, then keep it fresh. SSE has no replay, so a dropped
   * stream or tunnel flap would otherwise hide replies until the thread is
   * reopened. Refreshes run on an interval, when the agent's conversation lane
   * goes idle, and when the window regains focus.
   */
  useEffect(() => {
    if (!connected || !openAgentId) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    let first = true;
    const load = () => {
      if (inFlight || cancelled) {
        return;
      }
      inFlight = true;
      const live = !first;
      void hath
        .listMessages(openAgentId, { limit: HISTORY_LOG_LIMIT })
        .then(({ messages }) => {
          if (cancelled) {
            return;
          }
          first = false;
          hydrateThreadMessages(openAgentId, messages, { live });
          setThreadLoad({ agentId: openAgentId, error: null });
        })
        .catch((err: unknown) => {
          if (cancelled) {
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          if (live) {
            logLine("warn", message, "thread_refresh_failed");
            return;
          }
          logLine("error", message, "thread_history_failed");
          setHistoryState("error", message);
          setThreadLoad({ agentId: openAgentId, error: message });
        })
        .finally(() => {
          inFlight = false;
        });
    };
    load();
    refreshThreadRef.current = load;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        load();
      }
    }, THREAD_REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      if (refreshThreadRef.current === load) {
        refreshThreadRef.current = null;
      }
    };
  }, [connected, openAgentId, chat.historyStatus]);

  /**
   * Keep the conversation list's previews current. The list only loads on connect and
   * otherwise follows SSE, which has no replay, so a dropped event left a stale preview
   * until reconnect. A failed refresh is logged and toasted, and the next one tries again.
   */
  useEffect(() => {
    if (!connected) {
      return;
    }
    const refresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      hath
        .listThreads()
        .then(({ threads }) => mergeConversations(threads))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logLine("warn", message, "threads_refresh_failed");
          pushToast({
            key: "threads_refresh_failed",
            tone: "error",
            title: "Chat list refresh failed",
            body: message,
            target: failureTarget(err),
          });
        });
    };
    const timer = setInterval(refresh, LIST_REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [connected]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= NEAR_BOTTOM_PX;
  };

  const dismissKeyboard = () => {
    textareaRef.current?.blur();
  };

  const clearDraftAttachments = () => {
    setDraftAttachments((prev) => {
      revokeDraftPreviews(prev);
      return [];
    });
  };

  const sendThread = async (
    toId: string,
    content: string,
    existingTempSeq?: number,
    attachments?: MessageAttachment[],
  ) => {
    const trimmed = content.trim();
    if (
      (!trimmed && (!attachments || attachments.length === 0)) ||
      !connected
    ) {
      return;
    }

    const conversationHeld = running[toId]?.conversation === true;
    const queueLocally = existingTempSeq === undefined && conversationHeld;

    let tempSeq: number;
    if (existingTempSeq !== undefined) {
      markPending(toId, existingTempSeq);
      tempSeq = existingTempSeq;
    } else {
      tempSeq = addOptimistic(toId, trimmed, {
        queued: queueLocally,
        attachments,
      });
      setDraft("");
      clearDraftAttachments();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const el = textareaRef.current;
        if (el) {
          el.style.height = "auto";
        }
      });
    }

    stickToBottomRef.current = true;

    if (queueLocally) {
      return;
    }

    try {
      const res = await hath.postMessage({
        to_agent_id: toId,
        content: trimmed,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
      });
      resolveOptimistic(toId, tempSeq, res.seq, res.attachments);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      markFailed(toId, tempSeq, message);
      logLine("error", message, "thread_send_failed");
    }
  };

  const flushQueues = useEffectEvent(async () => {
    if (!connected) {
      return;
    }
    const targetId = openAgentId;
    if (!targetId) {
      return;
    }
    const queued = listQueuedThread(targetId);
    for (const msg of queued) {
      await sendThread(
        targetId,
        msg.content,
        msg.seq,
        msg.attachments,
      );
    }
  });

  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (conversationBusy) {
      wasBusyRef.current = true;
      return;
    }
    if (!wasBusyRef.current) {
      return;
    }
    wasBusyRef.current = false;
    refreshThreadRef.current?.();
    void flushQueues();
  }, [conversationBusy]);

  const cancelQueued = (seq: number) => {
    if (openAgentId) {
      removeMessage(openAgentId, seq);
    }
  };

  const onPickFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) {
      return;
    }
    try {
      const next = await filesToDraftAttachments(files);
      setDraftAttachments((prev) => {
        const room = MAX_ATTACHMENTS - prev.length;
        if (room <= 0) {
          revokeDraftPreviews(next);
          return prev;
        }
        const keep = next.slice(0, room);
        revokeDraftPreviews(next.slice(room));
        return [...prev, ...keep];
      });
    } catch (err) {
      logLine(
        "error",
        err instanceof Error ? err.message : String(err),
        "invalid_request",
      );
    }
  };

  const removeDraftAttachment = (index: number) => {
    setDraftAttachments((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  /** Hand a message to Dadi: it vanishes here, the router sends it on as you, and the router opens the chat it landed in. */
  const sendDadi = async (
    content: string,
    attachments?: MessageAttachment[],
  ) => {
    const trimmed = content.trim();
    if (
      (!trimmed && (!attachments || attachments.length === 0)) ||
      !connected ||
      dadiBusy
    ) {
      return;
    }
    const savedDraft = draft;
    const savedAttachments = draftAttachments;
    setDraft("");
    setRouteError(null);
    setRouting({ text: trimmed, attachments: attachments?.length ?? 0 });
    setDadiBusy(true);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    try {
      const res = await hath.postRouter({
        content: trimmed,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
      });
      clearDraftAttachments();
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      for (const sent of res.messages) {
        ingestLiveMessage(sent.to_agent_id, {
          seq: sent.seq,
          from_user: true,
          content: sent.content,
          files: sent.attachments,
          at: sent.created_at,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      saveDraft(DADI_DRAFT_KEY, savedDraft);
      if (draftKeyRef.current === DADI_DRAFT_KEY) {
        setDraftText(savedDraft);
        setDraftAttachments(savedAttachments);
        setRouteError(message);
      }
      logLine("error", message, "dadi_send_failed");
    } finally {
      setRouting(null);
      setDadiBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const attachments =
      draftAttachments.length > 0
        ? toMessageAttachments(draftAttachments)
        : undefined;
    if (viewingThread && openAgentId) {
      void sendThread(openAgentId, draft, undefined, attachments);
      return;
    }
    void sendDadi(draft, attachments);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  };

  const backToList = () => {
    openList();
    clearDraftAttachments();
    setRouteError(null);
  };

  const startNewChat = () => {
    clearDraftAttachments();
    setRouteError(null);
    openDadi();
  };

  const placeholder = !connected
    ? "Connect to message Dadi"
    : viewingDadi
      ? "Message Dadi…"
      : conversationBusy
        ? `Thinking…`
        : `Message agent`;

  const canSubmit =
    connected &&
    !dadiBusy &&
    (draft.trim().length > 0 || draftAttachments.length > 0);
  const composerPad = composerHeight + COMPOSER_GAP;

  const { settled: settledMessages, queued: queuedMessages } = partitionByQueued(
    threadMessages,
  );


  const openAgentView = resolveOpenAgent(openAgentId, agentsQuery);
  const openAgentRecord = openAgentView?.kind === "ready" ? openAgentView.agent : undefined;
  const liveBrowserId =
    openAgentRecord && browsersQuery.isSuccess
      ? pickLiveBrowser(
          openAgentRecord.sessions.browsers,
          browsersQuery.data,
        )
      : null;
  const liveTerminal =
    openAgentRecord && terminalsQuery.isSuccess
      ? pickLiveTerminal(
          openAgentRecord.sessions.terminals,
          terminalsQuery.data,
        )
      : null;
  const showHostPin =
    viewingThread && (liveBrowserId !== null || liveTerminal !== null);

  const showComposer =
    viewingDadi || (openAgentView?.kind === "ready" && openAgentView.agent.active);

  const paneKey = viewingThread
    ? `agent:${openAgentId ?? ""}`
    : viewingDadi
      ? "dadi"
      : "list";

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const paneTransition = {
    duration: reducedMotion ? 0 : 0.24,
    ease: EASE,
  };

  const listProps = {
    conversations: chat.conversations,
    selectedAgentId: openAgentId,
    historyStatus: chat.historyStatus,
    historyError: chat.historyError,
    running,
    unread: chat.unread,
    onOpenAgent: openAgent,
    onDismissKeyboard: dismissKeyboard,
    dadi: {
      available: connected,
      selected: viewingDadi,
      preview: null as string | null,
      busy: dadiBusy,
      onOpen: startNewChat,
    },
  };

  return (
    <aside
      ref={asideRef}
      className={`chat-rail relative flex h-full min-h-0 flex-col overflow-hidden ${className ?? ""}`}
      data-agent-id={openAgentId ?? undefined}
      data-session-key={sessionKey}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={paneKey}
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18, pointerEvents: "none" }}
            transition={paneTransition}
          >
            {paneKey === "list" ? (
              <ConversationList {...listProps} />
            ) : null}

            {paneKey === "dadi" ? (
              <>
                <PaneHeader onBack={backToList} title="દાદી" gujarati />
                <div className="relative min-h-0 flex-1">
                  <DadiHome
                    composerPad={composerPad}
                    routing={routing}
                    error={routeError}
                  />
                </div>
              </>
            ) : null}

            {viewingThread ? (
              <>
                <PaneHeader
                  onBack={backToList}
                  title={openAgentRecord ? openAgentRecord.name : null}
                  error={openAgentView?.kind === "error" ? openAgentView.message : null}
                  detailsOpen={detailsAnchor !== null}
                  onOpenDetails={(box) => {
                    const rail = asideRef.current!.getBoundingClientRect();
                    setDetailsAnchor(
                      detailsAnchor
                        ? null
                        : { x: rail.width, y: box.top - rail.top + box.height / 2, radius: 0 },
                    );
                  }}
                />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {showHostPin ? (
                    <HostPin browserId={liveBrowserId} terminal={liveTerminal} />
                  ) : null}
                  <div className="relative min-h-0 flex-1">
                    {openAgentView?.kind === "error" ? (
                      <p
                        role="alert"
                        className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] leading-relaxed text-error"
                        style={{ paddingBottom: composerPad }}
                      >
                        Couldn't load this agent. {openAgentView.message}
                      </p>
                    ) : null}
                    {openAgentView?.kind === "loading" ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ paddingBottom: composerPad }}
                      >
                        <ActivityPulse />
                      </div>
                    ) : null}
                    {openAgentId && openAgentRecord ? (
                    <ThreadView
                      scrollRef={scrollRef}
                      onScroll={onScroll}
                      onDismissKeyboard={dismissKeyboard}
                      composerPad={composerPad}
                      fadeTop={showHostPin}
                      settledMessages={settledMessages}
                      queuedMessages={queuedMessages}
                      onRetry={(msg) => {
                        void sendThread(
                          openAgentId,
                          msg.content,
                          msg.seq,
                          msg.attachments,
                        );
                      }}
                      onCancel={cancelQueued}
                      agentName={openAgentRecord.name}
                      agent={openAgentRecord}
                      load={
                        threadLoad?.agentId === openAgentId ? threadLoad : null
                      }
                      onSuggest={(text) => {
                        setDraft(text);
                        requestAnimationFrame(() => {
                          textareaRef.current?.focus();
                        });
                      }}
                    />
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}


          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showComposer ? (
            <FloatingComposer
              key="composer"
              connected={connected}
              draft={draft}
              setDraft={setDraft}
              placeholder={placeholder}
              canSubmit={canSubmit}
              thinkingMode={conversationBusy}
              workingMode={reasoningBusy && !conversationBusy}
              lanes={{ conversation: conversationBusy, reasoning: reasoningBusy }}
              textareaRef={textareaRef}
              fileInputRef={fileInputRef}
              cameraInputRef={cameraInputRef}
              attachments={draftAttachments}
              onRemoveAttachment={removeDraftAttachment}
              onPickFiles={onPickFiles}
              onSubmit={onSubmit}
              onKeyDown={onKeyDown}
              autoFocus={viewingDadi}
              onHeight={setComposerHeight}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {openAgentView?.kind === "ready" ? (
        <AgentPopover
          open={detailsAnchor !== null}
          agentId={openAgentView.agent.id}
          agentsById={new Map(openAgentView.agents.map((a) => [a.id, a]))}
          runningMap={running}
          anchor={detailsAnchor}
          containerRef={asideRef}
          browserId={liveBrowserId}
          terminal={liveTerminal}
          onClose={() => setDetailsAnchor(null)}
          onSelectParent={openAgent}
        />
      ) : null}
    </aside>
  );
}
