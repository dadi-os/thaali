import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { hath, isMeshOnline } from "../../shared/api";
import type { AgentRecord } from "../../types/hath";
import { useConnection } from "../../shared/hooks/useConnection";
import { MarkdownBody } from "../../shared/components/Markdown";
import { Popover, type PopoverAnchor, type PopoverHover } from "../../shared/components/Popover";
import { Tooltip } from "../../shared/components/Tooltip";
import { openAgent } from "../../store/chat";
import { getRunning } from "../../store/running";
import { AgentActivity } from "./activity";
import { BrowserFrame } from "./BrowserFrame";
import { ScheduleSection } from "./ScheduleSection";
import { REVEAL } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { statusLabel, visualState } from "./tree";

/** Longest the panel waits for its first data before opening anyway. */
const SETTLE_MS = 250;

/** Agent detail query; shared with the graph so hovering a node can prefetch it. */
export function agentDetailQuery(agentId: string | null) {
  return queryOptions({
    queryKey: ["agent", agentId],
    queryFn: () => {
      if (!agentId) {
        throw new Error("agentId required");
      }
      return hath.getAgent(agentId);
    },
  });
}

/** How many of an agent's newest wakes the activity feed loads, every row of each. */
const ACTIVITY_WAKES = 10;

/**
 * Recent logs, shown as activity and read for "last active" (the last log, not
 * agents.updated_at, which only moves on modify_agent): every row of the agent's newest
 * wakes, so a long wake never loses the message that started it off the end of a fixed
 * row window. A hath without the `wakes` read refuses it, and then the newest 80 rows
 * serve. Shared with the graph's prefetch; lane SSE events invalidate it under
 * `["agent-logs", agentId]`.
 */
export function agentActivityQuery(agentId: string | null) {
  return queryOptions({
    queryKey: ["agent-logs", agentId, "activity"],
    queryFn: async () => {
      if (!agentId) {
        throw new Error("agentId required");
      }
      try {
        const { logs } = await hath.getAgentLogs(agentId, { wakes: ACTIVITY_WAKES });
        return logs;
      } catch (err) {
        console.warn("hath refused the wake log read; reading the newest rows instead", err);
        const { logs } = await hath.getAgentLogs(agentId, { limit: 80 });
        return logs;
      }
    },
  });
}

export type AgentPopoverProps = {
  open: boolean;
  agentId: string | null;
  agentsById: Map<string, AgentRecord>;
  runningMap: ReturnType<typeof getRunning>;
  anchor: PopoverAnchor | null;
  containerRef: RefObject<HTMLElement | null>;
  /** Live Nas browser for this agent, or null. */
  browserId: number | null;
  /** Live terminal caption, or null. */
  terminal: { id: string; last_command: string | null } | null;
  onClose: () => void;
  onSelectParent: (id: string) => void;
  /** Hover zone that keeps the panel open while the pointer is on the node or the panel; absent when it opens on click. */
  hover?: PopoverHover;
};

/**
 * Agent detail panel. Uses shared Popover for positioning / dismiss. It is always its full
 * height, so content that arrives after it opens (activity easing in) fills it instead of
 * growing it, which made Popover re-clamp it to the viewport and spring it back up. It
 * holds its first open until detail and activity have loaded (at most SETTLE_MS). While
 * a scheduled message is being edited the panel ignores the pointer leaving it, so a
 * draft is not lost; ESC and outside clicks still close it.
 */
export function AgentPopover({
  open,
  agentId,
  agentsById,
  runningMap,
  anchor,
  containerRef,
  browserId,
  terminal,
  onClose,
  onSelectParent,
  hover,
}: AgentPopoverProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const [promptOpen, setPromptOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanes = agentId ? runningMap[agentId] : undefined;
  const busy = lanes !== undefined && (lanes.work || lanes.process);

  const detailQuery = useQuery({
    ...agentDetailQuery(agentId),
    enabled: connected && !!agentId && open,
  });

  const activityQuery = useQuery({
    ...agentActivityQuery(agentId),
    enabled: connected && !!agentId && open,
    refetchInterval: busy ? POLL_MS : false,
  });

  useEffect(() => {
    setPromptOpen(false);
  }, [agentId]);

  const [settling, setSettling] = useState(true);
  const loading = detailQuery.isLoading || activityQuery.isLoading;
  useEffect(() => {
    if (!open) {
      setSettling(true);
      return;
    }
    const timer = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    if (open && !loading) {
      setSettling(false);
    }
  }, [open, loading]);

  if (!agentId || !anchor) {
    return null;
  }

  const listAgent = agentsById.get(agentId);
  const detail = detailQuery.data;
  const running =
    runningMap[agentId] ??
    detail?.running ??
    listAgent?.running ?? { work: false, process: false };
  const active = detail?.active ?? listAgent?.active ?? false;
  const name = detail?.name ?? listAgent?.name ?? "…";
  const createdAt = detail?.created_at ?? listAgent?.created_at;
  const updatedAt = detail?.updated_at ?? listAgent?.updated_at;
  const lastActiveAt =
    activityQuery.data?.[0]?.created_at ?? updatedAt ?? null;
  const visual = visualState(
    {
      id: agentId,
      name,
      system_prompt: "",
      parent_agent_id: detail?.parent_agent_id ?? listAgent?.parent_agent_id ?? null,
      active,
      running,
      created_at: createdAt ?? new Date(0).toISOString(),
      updated_at: lastActiveAt ?? updatedAt ?? new Date(0).toISOString(),
      sessions: { browsers: [], terminals: [] },
    },
    running,
  );
  const status = statusLabel(visual, running);
  const parentId = detail?.parent_agent_id ?? listAgent?.parent_agent_id ?? null;
  const parent = parentId ? agentsById.get(parentId) : undefined;
  const live = running.work || running.process;
  const command = terminal?.last_command?.replace(/\s+/g, " ").trim();
  const hostCaption =
    command && command.length > 0
      ? command
      : terminal
        ? terminal.id
        : null;

  return (
    <Popover
      open={open && !(settling && loading)}
      onClose={onClose}
      anchor={anchor}
      containerRef={containerRef}
      aria-label={`${name} details`}
      className="max-h-[min(86vh,760px)]"
      style={{ height: "min(86vh, 760px)", maxHeight: "min(86vh, 760px)" }}
      widthPx={460}
      contentKey={agentId}
      hover={editingSchedule && hover ? { onInside: hover.onInside, onOutside: () => {} } : hover}
    >
      <header className="shrink-0 border-b border-rule/60 px-5 pt-4 pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[19px] font-semibold tracking-[-0.015em] text-ink">{name}</h2>
            <p className={`mt-1 flex items-center gap-2 text-[12.5px] ${live ? "text-sage-text" : "text-ink-muted"}`}>
              {live ? (
                <span aria-hidden className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="animate-breath size-1 rounded-full bg-sage-text" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              ) : (
                <span aria-hidden className={`inline-block size-1.5 rounded-full ${active ? "bg-sage" : "bg-ink-faint"}`} />
              )}
              {status}
            </p>
          </div>
          {active ? (
            <button
              type="button"
              onClick={() => openAgent(agentId)}
              className="shrink-0 rounded-[10px] bg-sage-deep px-3 py-1.5 text-[12.5px] font-semibold text-bone transition-opacity duration-slow ease-dadi hover:opacity-90"
            >
              Open thread
            </button>
          ) : null}
        </div>
      </header>

      {browserId !== null ? (
        <div className="shrink-0 border-b border-rule/60 px-3 py-3">
          {hostCaption ? (
            <p
              className="mb-2 truncate font-mono text-[11px] text-ink-muted"
              title={hostCaption}
            >
              {hostCaption}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-[12px] border border-sage-line/70">
            <BrowserFrame browserId={browserId} variant="detail" />
          </div>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [overflow-anchor:none]">
        <section className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
          {parent ? (
            <>
              <span className="text-ink-ghost">Parent</span>
              <span className="text-ink">
                <button type="button" className="text-sage-deep" onClick={() => onSelectParent(parent.id)}>
                  {parent.name}
                </button>
              </span>
            </>
          ) : null}
          <span className="text-ink-ghost">Created</span>
          <Tooltip content={createdAt ? formatAbsolute(createdAt) : "—"}>
            <span className="text-ink-muted">
              {createdAt ? formatRelative(createdAt) : "—"}
            </span>
          </Tooltip>
          <span className="text-ink-ghost">Last active</span>
          <Tooltip content={lastActiveAt ? formatAbsolute(lastActiveAt) : "—"}>
            <span className="text-ink-muted">
              {live
                ? "Now"
                : lastActiveAt
                  ? formatRelative(lastActiveAt)
                  : "—"}
            </span>
          </Tooltip>
        </section>

        <ScheduleSection
          agentId={agentId}
          enabled={connected && open}
          onEditingChange={setEditingSchedule}
        />

        {detailQuery.isError && (
          <p className="mb-4 text-[13px] text-ink-muted">
            Could not load agent detail.
          </p>
        )}

        <AnimatePresence initial={false}>
          {detailQuery.isPending ? (
            <motion.div key="loading" {...REVEAL} className="overflow-hidden">
              <div aria-label="Loading agent detail" className="flex flex-col gap-2 pb-5">
                <span className="h-2.5 w-24 animate-pulse rounded-full bg-rule/70" />
                <span className="h-2.5 w-full animate-pulse rounded-full bg-rule/50" />
                <span className="h-2.5 w-4/5 animate-pulse rounded-full bg-rule/50" />
              </div>
            </motion.div>
          ) : null}
          {detail ? (
            <motion.div key="detail" {...REVEAL} className="overflow-hidden">
              <section className="mb-4 border-t border-rule/60 pt-3.5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost">CHARTER</h3>
                  <button type="button" className="text-[12px] font-semibold text-sage-deep" onClick={() => setPromptOpen((v) => !v)}>
                    {promptOpen ? "Hide" : `Show · ${(detail.system_prompt.length / 1000).toFixed(1)}k chars`}
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {promptOpen ? (
                    <motion.div key="charter" {...REVEAL} className="overflow-hidden">
                      <div className="pt-2 text-[13px] leading-relaxed text-ink">
                        <MarkdownBody content={detail.system_prompt} compact />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>

              <section className="mb-5 border-t border-rule/60 pt-3.5">
                <h3 className="mb-2 text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost">TOOLS</h3>
                {detail.tools.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">No granted tools.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {detail.tools.map((t) => (
                      <li key={t.name}>
                        <Tooltip content={t.usage}>
                          <span className="block rounded-[7px] bg-sage-fill px-2 py-[3px] font-mono text-[11px] text-sage-text">{t.name}</span>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AgentActivity
          key={agentId}
          logs={activityQuery}
          running={running}
          scrollRef={scrollRef}
        />
      </div>
    </Popover>
  );
}
