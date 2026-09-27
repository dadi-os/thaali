import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { dimaag, isMeshOnline } from "../../shared/api";
import type { AgentRecord } from "../../shared/api/types";
import { useConnection } from "../../hooks/useConnection";
import { Popover, type PopoverAnchor, type PopoverHover } from "../../shared/components/Popover";
import { Tooltip } from "../../shared/components/Tooltip";
import { getRunning } from "../../store/running";
import { AgentActivity } from "./AgentActivity";
import { BrowserFrame } from "./BrowserFrame";
import { REVEAL } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { statusLabel, visualState } from "./tree";

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
  /** Hover zone that keeps the panel open while the pointer is on the node or the panel. */
  hover: PopoverHover;
};

/**
 * Agent detail panel. Uses shared Popover for positioning / dismiss. Detail and
 * activity that load after it opens ease in rather than popping into place.
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

  const detailQuery = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => {
      if (!agentId) {
        throw new Error("agentId required");
      }
      return dimaag.getAgent(agentId);
    },
    enabled: connected && !!agentId && open,
  });

  /**
   * Recent logs, shown as activity and read for "last active" (the last log, not
   * agents.updated_at, which only moves on modify_agent).
   */
  const activityQuery = useQuery({
    queryKey: ["agent-logs", agentId, "activity"],
    queryFn: async () => {
      if (!agentId) {
        throw new Error("agentId required");
      }
      const { logs } = await dimaag.getAgentLogs(agentId, { limit: 80 });
      return logs;
    },
    enabled: connected && !!agentId && open,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    setPromptOpen(false);
  }, [agentId]);

  if (!agentId || !anchor) {
    return null;
  }

  const listAgent = agentsById.get(agentId);
  const detail = detailQuery.data;
  const running =
    runningMap[agentId] ??
    detail?.running ??
    listAgent?.running ?? { reasoning: false, conversation: false };
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
  const live = running.reasoning || running.conversation;
  const command = terminal?.last_command?.replace(/\s+/g, " ").trim();
  const hostCaption =
    command && command.length > 0
      ? command
      : terminal
        ? terminal.id
        : null;

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      containerRef={containerRef}
      aria-label={`${name} details`}
      className="max-h-[min(86vh,760px)]"
      style={{ maxHeight: "min(86vh, 760px)" }}
      widthPx={460}
      contentKey={agentId}
      hover={hover}
    >
      <header className="shrink-0 border-b border-rule/60 px-4 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 truncate text-[15px] font-medium text-ink">{name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[11px] tracking-wide text-ink-faint transition-colors duration-slow ease-hath hover:text-ink-muted"
          >
            ESC
          </button>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span
            aria-hidden
            className={`inline-block size-1.5 rounded-full ${
              live ? "bg-sage-deep" : active ? "bg-sage" : "bg-ink-faint"
            }`}
          />
          {status}
        </p>
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
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
          {parent ? (
            <>
              <span className="text-ink-ghost">Parent</span>
              <span className="text-ink-muted">
                <button
                  type="button"
                  className="text-sage-deep"
                  onClick={() => onSelectParent(parent.id)}
                >
                  {parent.name}
                </button>
              </span>
            </>
          ) : null}
        </section>

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
              <section className="mb-4">
                <h3 className="mb-1.5 text-[11px] font-medium tracking-[2px] text-ink-faint">
                  SYSTEM PROMPT
                </h3>
                <p
                  className={`whitespace-pre-wrap text-[13px] leading-relaxed text-ink ${
                    promptOpen ? "" : "line-clamp-4"
                  }`}
                >
                  {detail.system_prompt}
                </p>
                {detail.system_prompt.length > 160 && (
                  <button
                    type="button"
                    className="mt-1 text-[12px] text-sage-deep"
                    onClick={() => setPromptOpen((v) => !v)}
                  >
                    {promptOpen ? "Collapse" : "Expand"}
                  </button>
                )}
              </section>

              <section className="mb-5">
                <h3 className="mb-1.5 text-[11px] font-medium tracking-[2px] text-ink-faint">
                  TOOLS
                </h3>
                {detail.tools.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">No granted tools.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.tools.map((t) => (
                      <li key={t.name}>
                        <div className="text-[13px] font-medium text-ink">
                          {t.name}
                        </div>
                        <div className="text-[12px] leading-snug text-ink-muted">
                          {t.usage}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AgentActivity logs={activityQuery} />
      </div>
    </Popover>
  );
}
