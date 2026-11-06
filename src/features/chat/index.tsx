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
import { FADE, sheetMotion } from "../../shared/motion";
import { hath, nas } from "../../shared/api";
import type { AgentRecord } from "../../types/hath";
import { AgentPopover } from "../agents/AgentPopover";
import { HostPin } from "./HostPin";
import { pickLiveTasks } from "../agents/sessions";
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
  queuedAgentIds,
  markFailed,
  markPending,
  mergeConversations,
  openAgent,
  openList,
  removeMessage,
  resolveOptimistic,
  setHistoryState,
  subscribeChat,
  type MessageAttachment,
} from "../../contexts/chat";
import { DADI_DRAFT_KEY, loadDraft, saveDraft } from "../../contexts/drafts";
import { getDockRequests, subscribeDock } from "../../contexts/dock";
import { asQuote, getReplyRequests, getReplyText, subscribeReply } from "../../contexts/reply";
import { failureTarget, pushToast } from "../../contexts/toasts";
import {
  getRunning,
  isRouting,
  seedRunningFromAgents,
  setLocalSend,
  subscribeRunning,
} from "../../contexts/running";
import {
  filesToDraftAttachments,
  MAX_ATTACHMENTS,
  revokeDraftPreviews,
  toMessageAttachments,
  type DraftAttachment,
} from "../../shared/lib/content/attachments";
import { logLine } from "../../shared/lib/log";
import { hydrateHistory } from "../../shared/hooks/useEvents";
import { reportSendFailure } from "./sendFailure";
import { Composer } from "../../shared/components/Thread/Composer";
import { THREAD_HEADER_PX, ThreadHeader } from "../../shared/components/Thread/ThreadHeader";
import {
  COMPOSER_GAP,
  HISTORY_LOG_LIMIT,
  NEAR_BOTTOM_PX,
  TEXTAREA_MAX_PX,
  LIST_REFRESH_MS,
  THREAD_REFRESH_MS,
} from "./constants";
import { Dock } from "./Dock";
import { partitionByQueued } from "./lanes";
import { ConversationList, WIDE_ROW_PX } from "./list";
import { LaneChip } from "./LaneChip";
import { ResizeHandle, useRailWidth } from "./ResizeHandle";
import { ThreadView } from "./thread";
import { ThreadSkeleton } from "./thread/ThreadSkeleton";
import { useMarkRead } from "./useMarkRead";

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
  className?: string;
}

/**
 * Conversation list + thread views. Live messages arrive via SSE; history is
 * loaded from durable Hath `GET /threads` and `GET /agents/:id/messages`.
 * Talk to Dadi is a composer onto POST /router.
 */
export function ChatSidebar({ className }: ChatSidebarProps) {
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
  const dockTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const stickToBottomRef = useRef(true);
  /** The router dock is open as a composer. */
  const [dockOpen, setDockOpen] = useState(false);
  /** First history fetch outcome per open thread; the empty state waits on it. */
  const [threadLoad, setThreadLoad] = useState<{
    agentId: string;
    error: string | null;
  } | null>(null);
  /** Measured floating composer height; the thread pads by it so text clears it. */
  const [composerHeight, setComposerHeight] = useState(0);
  /** The agent whose details popover is open over the name pill. */
  const [details, setDetails] = useState<{ id: string; anchor: DOMRect } | null>(null);
  const refreshThreadRef = useRef<(() => void) | null>(null);

  const routing = isRouting();
  const rail = useRailWidth();

  const agentsQuery = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const { agents } = await hath.listAgents();
      seedRunningFromAgents(agents);
      return agents;
    },
    enabled: connected,
  });

  const tasksQuery = useQuery({
    queryKey: ["nas", "tasks"],
    queryFn: () => nas.listTasks(),
    enabled: connected,
  });

  useEffect(() => {
    if (connection === "disconnected") {
      clearLiveChat();
    }
  }, [connection]);

  const openAgentId =
    chat.open.kind === "agent" ? chat.open.agentId : null;
  const viewingThread = chat.open.kind === "agent";
  const threadMessages = openAgentId
    ? (chat.threads[openAgentId] ?? [])
    : [];

  useMarkRead(
    openAgentId,
    threadMessages,
    openAgentId ? chat.readSeq[openAgentId] : undefined,
    connected,
  );

  const draftKey = openAgentId ?? DADI_DRAFT_KEY;
  const draftKeyRef = useRef(draftKey);
  const [draft, setDraftText] = useState(() => loadDraft(draftKey));
  const setDraft = (text: string) => {
    setDraftText(text);
    saveDraft(draftKeyRef.current, text);
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

  const processBusy = viewingThread && openAgentId ? running[openAgentId]?.process === true : false;
  const workBusy =
    viewingThread && openAgentId
      ? running[openAgentId]?.work === true
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
  }, [chat.open]);

  useLayoutEffect(() => {
    if (!viewingThread || !stickToBottomRef.current) {
      return;
    }
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [threadMessages, processBusy, workBusy, viewingThread, composerHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, [draft, chat.open]);

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
   * reopened. Refreshes run on a slow interval, when the agent's process lane
   * goes idle, and when the window regains focus or becomes visible.
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
    const loadWhenVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    const timer = setInterval(loadWhenVisible, THREAD_REFRESH_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", loadWhenVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", loadWhenVisible);
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
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
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

    const processHeld = running[toId]?.process === true;
    const queueLocally = existingTempSeq === undefined && processHeld;

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

    if (toId === openAgentId) {
      stickToBottomRef.current = true;
    }

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
      resolveOptimistic(toId, tempSeq, res.seq, res.attachments, res.created_at);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      markFailed(toId, tempSeq, message);
      logLine("error", message, "thread_send_failed");
      await reportSendFailure({ key: `thread_send_failed:${toId}`, text: trimmed, message, target: { kind: "chat", agentId: toId } });
    }
  };

  /** Agents whose queue is being sent now, so overlapping flushes never send a message twice or out of order. */
  const flushingRef = useRef(new Set<string>());

  /**
   * Send every agent's queued messages, oldest first, once its process lane is idle,
   * whether or not its thread is open, so a queue never outlives leaving the chat.
   */
  const flushQueues = useEffectEvent(async () => {
    if (!connected) {
      return;
    }
    for (const agentId of queuedAgentIds()) {
      if (running[agentId]?.process === true || flushingRef.current.has(agentId)) {
        continue;
      }
      flushingRef.current.add(agentId);
      try {
        for (const msg of listQueuedThread(agentId)) {
          await sendThread(agentId, msg.content, msg.seq, msg.attachments);
        }
      } finally {
        flushingRef.current.delete(agentId);
      }
    }
  });

  useEffect(() => {
    void flushQueues();
  }, [running, connected]);

  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (processBusy) {
      wasBusyRef.current = true;
      return;
    }
    if (!wasBusyRef.current) {
      return;
    }
    wasBusyRef.current = false;
    refreshThreadRef.current?.();
  }, [processBusy]);

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

  /**
   * Hand a message to Dadi: it leaves the dock, the dock settles back to the bar, and the router
   * sends it on as you. Nothing reports where it went. A message that fails comes back to the dock
   * and a toast says it was copied; a second send waits for the router.
   */
  const sendDadi = async (
    content: string,
    attachments?: MessageAttachment[],
  ) => {
    const trimmed = content.trim();
    if (
      (!trimmed && (!attachments || attachments.length === 0)) ||
      !connected ||
      routing
    ) {
      return;
    }
    const savedDraft = draft;
    const savedAttachments = draftAttachments;
    setDraft("");
    setDockOpen(false);
    setLocalSend(true);
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
        setDockOpen(true);
      }
      logLine("error", message, "dadi_send_failed");
      await reportSendFailure({ key: "dadi_send_failed", text: trimmed, message, target: { kind: "router" } });
    } finally {
      setLocalSend(false);
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
    }
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
  };

  const placeholder = !connected ? "Connect to message agent" : processBusy ? `Processing…` : `Message agent`;

  const canSubmit = connected && (draft.trim().length > 0 || draftAttachments.length > 0);
  const composerPad = composerHeight + COMPOSER_GAP;

  const { settled: settledMessages, queued: queuedMessages } = partitionByQueued(
    threadMessages,
  );


  const openAgentView = resolveOpenAgent(openAgentId, agentsQuery);
  const openAgentRecord = openAgentView?.kind === "ready" ? openAgentView.agent : undefined;
  const { browser: liveBrowser, terminal: liveTerminal } =
    openAgentRecord && tasksQuery.isSuccess
      ? pickLiveTasks(openAgentRecord.sessions, tasksQuery.data)
      : { browser: null, terminal: null };
  const showHostPin = viewingThread && (liveBrowser !== null || liveTerminal !== null);

  const showComposer = openAgentView?.kind === "ready" && openAgentView.agent.active;

  const dockRequests = useSyncExternalStore(subscribeDock, getDockRequests, getDockRequests);
  const seenDockRequests = useRef(dockRequests);
  useEffect(() => {
    if (dockRequests === seenDockRequests.current) {
      return;
    }
    seenDockRequests.current = dockRequests;
    openList();
    setDraftText(loadDraft(DADI_DRAFT_KEY));
    setDockOpen(true);
  }, [dockRequests]);

  const replyRequests = useSyncExternalStore(subscribeReply, getReplyRequests, getReplyRequests);
  const seenReplyRequests = useRef(replyRequests);
  useEffect(() => {
    if (replyRequests === seenReplyRequests.current) {
      return;
    }
    seenReplyRequests.current = replyRequests;
    if (openAgentId === null) {
      return;
    }
    const held = loadDraft(openAgentId);
    const reply = getReplyText();
    setDraft(reply.quote ? `${asQuote(reply.text)}${held}` : `${reply.text}${held === "" ? "" : `\n${held}`}`);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [replyRequests, openAgentId]);

  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => void onPickFiles(input.files);
    input.click();
  };

  return (
    <aside
      className={`rail ${className ?? ""}`}
      style={{ width: rail.width, height: "100%" }}
      data-agent-id={openAgentId ?? undefined}
    >
      <AnimatePresence initial={false} mode="popLayout">
      {viewingThread ? (
        <motion.div key="thread" className="absolute inset-0 flex flex-col" {...sheetMotion("right")}>
          <div className="rail-fade rail-fade--top" aria-hidden />
          <ThreadHeader
            onBack={backToList}
            title={openAgentRecord ? openAgentRecord.name : null}
            error={openAgentView?.kind === "error" ? openAgentView.message : null}
            onOpenDetails={openAgentId === null ? undefined : (anchor) => setDetails({ id: openAgentId, anchor })}
          />
          <div className="relative flex min-h-0 flex-1 flex-col" style={{ paddingTop: showHostPin ? THREAD_HEADER_PX : 0 }}>
            <HostPin browser={liveBrowser} terminal={liveTerminal} />
            <div className="relative min-h-0 flex-1">
              <AnimatePresence initial={false}>
                {openAgentView?.kind === "error" ? (
                  <motion.p
                    key="error"
                    {...FADE}
                    role="alert"
                    data-selectable
                    className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] leading-relaxed text-error"
                    style={{ paddingBottom: composerPad }}
                  >
                    Couldn't load this agent. {openAgentView.message}
                  </motion.p>
                ) : null}
                {openAgentView?.kind === "loading" ? (
                  <ThreadSkeleton key="loading" label="Loading this agent" bottomPad={composerPad + 16} />
                ) : null}
              </AnimatePresence>
              {openAgentId && openAgentRecord ? (
                <ThreadView
                  scrollRef={scrollRef}
                  onScroll={onScroll}
                  onDismissKeyboard={dismissKeyboard}
                  composerPad={composerPad}
                  fadeTop={showHostPin}
                  headerPad={showHostPin ? 0 : THREAD_HEADER_PX}
                  settledMessages={settledMessages}
                  queuedMessages={queuedMessages}
                  onRetry={(msg) => {
                    void sendThread(openAgentId, msg.content, msg.seq, msg.attachments);
                  }}
                  onCancel={cancelQueued}
                  agentName={openAgentRecord.name}
                  agent={openAgentRecord}
                  load={threadLoad?.agentId === openAgentId ? threadLoad : null}
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
          <AnimatePresence initial={false}>
            {showComposer ? (
              <Composer
                key="composer"
                connected={connected}
                draft={draft}
                setDraft={setDraft}
                placeholder={placeholder}
                canSubmit={canSubmit}
                processingMode={processBusy}
                workingMode={workBusy && !processBusy}
                above={<LaneChip process={processBusy} work={workBusy} />}
                fieldMaxPx={TEXTAREA_MAX_PX}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                cameraInputRef={cameraInputRef}
                attachments={draftAttachments}
                onRemoveAttachment={removeDraftAttachment}
                onPickFiles={onPickFiles}
                onSubmit={onSubmit}
                onKeyDown={onKeyDown}
                onHeight={setComposerHeight}
              />
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div key="list" className="absolute inset-0 flex flex-col" {...sheetMotion("left")}>
          <ConversationList
            conversations={chat.conversations}
            selectedAgentId={null}
            historyStatus={chat.historyStatus}
            historyError={chat.historyError}
            onRetry={() => void hydrateHistory()}
            running={running}
            unread={chat.unread}
            offline={!connected}
            wide={rail.width >= WIDE_ROW_PX}
            now={Date.now()}
            onOpenAgent={openAgent}
            onDismissKeyboard={dismissKeyboard}
          />
          <Dock
            open={dockOpen}
            routing={routing}
            offline={!connected}
            draft={draft}
            onDraft={setDraft}
            attachments={draftAttachments}
            onRemoveAttachment={removeDraftAttachment}
            onPickFiles={onPickFiles}
            onAttach={pickFiles}
            onOpen={() => setDockOpen(true)}
            onClose={() => setDockOpen(false)}
            onSend={() => void sendDadi(draft, draftAttachments.length > 0 ? toMessageAttachments(draftAttachments) : undefined)}
            textareaRef={dockTextareaRef}
          />
        </motion.div>
      )}
      </AnimatePresence>
      <AgentPopover agentId={details === null ? null : details.id} anchor={details === null ? null : details.anchor} onSelect={(id) => setDetails((current) => (current === null ? null : { id, anchor: current.anchor }))} onClose={() => setDetails(null)} />
      <ResizeHandle rail={rail} />

    </aside>
  );
}
