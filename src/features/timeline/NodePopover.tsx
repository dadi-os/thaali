import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { yaad } from "../../shared/api";
import type {
  DeleteNodeResponse,
  EdgeRecord,
  NodeRecord,
  PatchNodeRequest,
  PlanDetail,
  PlanStatus,
} from "../../shared/api/types";
import { Glider } from "../../shared/components/Glider";
import { Popover, type PopoverAnchor } from "../../shared/components/Popover";
import { Tooltip } from "../../shared/components/Tooltip";
import { REVEAL } from "../../shared/lib/ux/motion";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { KIND_ORDER, KIND_TOKEN } from "../memory/graph";
import { SOURCE_LABEL } from "../memory/MemoryPopover";
import { formatDayShort, formatTime, isSameDay } from "./dates";

const STATUS_OPTIONS: Array<{ value: PlanStatus; label: string }> = [
  { value: "idea", label: "Idea" },
  { value: "tentative", label: "Tentative" },
  { value: "confirmed", label: "Confirmed" },
];

/** Connections listed before the rest fold behind "more". */
const CONNECTIONS_SHOWN = 6;

export type NodePopoverProps = {
  open: boolean;
  /** Node the panel shows; kept while it animates away; changing it glides to the new content. */
  nodeId: string;
  anchor: PopoverAnchor;
  onClose: () => void;
  /** A connection was clicked: show that node instead. */
  onSelect: (nodeId: string) => void;
  /** The node was deleted; `title` is what it was called. */
  onDeleted: (result: DeleteNodeResponse, title: string) => void;
};

/** A neighbor of the shown node across one current edge. */
type Connection = { edge: EdgeRecord; node: NodeRecord; outgoing: boolean };

/**
 * Timeline detail panel for any Yaad node: when it is, its status (plans), body, and
 * connections, with in-place title and status edits, delete, and a jump to the node
 * in the Yaad graph.
 */
export function NodePopover({ open, nodeId, anchor, onClose, onSelect, onDeleted }: NodePopoverProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const nodeQuery = useQuery({
    queryKey: ["yaad", "node", nodeId],
    queryFn: () => yaad.getNode(nodeId),
  });
  const neighborsQuery = useQuery({
    queryKey: ["yaad", "graph", "seed", nodeId],
    queryFn: () => yaad.graph({ seed_ids: [nodeId] }),
  });

  const patch = useMutation({
    mutationFn: (body: PatchNodeRequest) => yaad.patchNode(nodeId, body),
    onSuccess: (node) => {
      queryClient.setQueryData(["yaad", "node", node.id], node);
      void queryClient.invalidateQueries({ queryKey: ["yaad", "plans"] });
      void queryClient.invalidateQueries({ queryKey: ["yaad", "memories"] });
    },
  });
  const remove = useMutation({
    mutationFn: (_title: string) => yaad.deleteNode(nodeId),
    onSuccess: (result, title) => {
      void queryClient.invalidateQueries({ queryKey: ["yaad"] });
      onDeleted(result, title);
    },
  });

  useEffect(() => {
    setDraft(null);
    setConfirming(false);
    setShowAll(false);
    patch.reset();
    remove.reset();
  }, [nodeId]);

  const node = nodeQuery.data;
  const connections = neighborsQuery.data ? connectionsOf(nodeId, neighborsQuery.data) : [];
  const listed = showAll ? connections : connections.slice(0, CONNECTIONS_SHOWN);
  const folded = connections.length - listed.length;
  const plan = node?.kind === "plan" ? (node.detail as PlanDetail) : null;
  const mutationError = patch.error ?? remove.error;

  const saveTitle = () => {
    const next = draft?.trim();
    setDraft(null);
    if (node && next && next !== node.title) {
      patch.mutate({ title: next });
    }
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      aria-label={node ? `${node.title} details` : "Node details"}
      widthPx={360}
      contentKey={nodeId}
    >
      {nodeQuery.isError ? (
        <p className="px-4 py-4 text-[13px] text-error">{nodeQuery.error.message}</p>
      ) : !node ? (
        <p className="px-4 py-4 text-[13px] text-ink-ghost">Loading…</p>
      ) : (
        <>
          <header className="shrink-0 border-b border-rule/60 px-4 pt-3.5 pb-3">
            <div className="flex items-baseline justify-between gap-3">
              {draft !== null ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveTitle();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setDraft(null);
                    }
                  }}
                  className="min-w-0 flex-1 rounded-[6px] bg-sage-fill px-1.5 py-0.5 text-[15px] leading-snug font-medium text-ink outline-none ring-1 ring-sage-line"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setDraft(node.title)}
                  className="min-w-0 rounded-[6px] text-left text-[15px] leading-snug font-medium text-ink transition-colors duration-slow ease-hath hover:text-sage-deep"
                  title="Rename"
                >
                  {node.title}
                </button>
              )}
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
                className="inline-block size-1.5 rounded-full"
                style={{ background: `var(${KIND_TOKEN[node.kind]})` }}
              />
              <span className="capitalize">{node.kind}</span>
              <span className="text-ink-ghost">·</span>
              {SOURCE_LABEL[node.source]}
              {patch.isPending ? <span className="ml-auto text-ink-ghost">Saving…</span> : null}
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {node.occurred_at ? (
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink">{whenOf(node.occurred_at, plan ? plan.end_at : null)}</span>
                <Tooltip content={formatAbsolute(node.occurred_at)}>
                  <span className="shrink-0 text-[12px] text-ink-ghost">{formatRelative(node.occurred_at)}</span>
                </Tooltip>
              </div>
            ) : null}

            {plan ? (
              <div className="mb-3 flex items-center justify-between gap-3">
                <Glider
                  options={STATUS_OPTIONS}
                  value={plan.status}
                  onChange={(status) => patch.mutate({ detail: { status } })}
                  label="Plan status"
                  size="sm"
                />
                {plan.series_id || plan.recurrence ? (
                  <span className="text-[11px] tracking-wide text-ink-ghost">Repeats</span>
                ) : null}
              </div>
            ) : null}

            {node.body ? <p className="mb-4 text-[13px] leading-relaxed text-ink">{node.body}</p> : null}

            <section className="mb-1">
              <h3 className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium tracking-[2px] text-ink-faint">
                CONNECTIONS
                <span className="tracking-normal text-ink-ghost">
                  {neighborsQuery.data ? connections.length : null}
                </span>
              </h3>
              {neighborsQuery.isError ? (
                <p className="text-[13px] text-error">{neighborsQuery.error.message}</p>
              ) : !neighborsQuery.data ? (
                <p className="text-[13px] text-ink-ghost">Loading…</p>
              ) : connections.length === 0 ? (
                <p className="text-[13px] text-ink-muted">Not linked to anything yet.</p>
              ) : (
                <ul className="-mx-2 flex flex-col">
                  {listed.map((c, i) => (
                    <motion.li
                      key={c.edge.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.18) }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(c.node.id)}
                        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1 text-left transition-colors duration-slow ease-hath hover:bg-sage-fill"
                      >
                        <span
                          aria-hidden
                          className="inline-block size-1.5 shrink-0 rounded-full"
                          style={{ background: `var(${KIND_TOKEN[c.node.kind]})` }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{c.node.title}</span>
                        <span className="shrink-0 text-[11px] text-ink-ghost">
                          {c.outgoing ? null : "← "}
                          {c.edge.type.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
              {folded > 0 ? (
                <button type="button" className="mt-1 text-[11px] text-sage-deep" onClick={() => setShowAll(true)}>
                  {folded} more
                </button>
              ) : null}
            </section>

            <AnimatePresence initial={false}>
              {mutationError ? (
                <motion.p {...REVEAL} className="overflow-hidden pt-2 text-[12px] text-error">
                  {mutationError.message}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-rule/60 px-4 py-2.5">
            <button
              type="button"
              onClick={() => navigate(`/memory?focus=${node.id}`)}
              className="text-[12px] text-sage-deep transition-colors duration-slow ease-hath hover:text-ink"
            >
              Open in Yaad →
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => (confirming ? remove.mutate(node.title) : setConfirming(true))}
              onMouseLeave={() => setConfirming(false)}
              className={`rounded-[6px] px-2 py-1 text-[12px] transition-colors duration-slow ease-hath ${
                confirming ? "bg-error-fill text-error" : "text-ink-faint hover:text-error"
              }`}
            >
              {remove.isPending ? "Deleting…" : confirming ? "Delete for good?" : "Delete"}
            </button>
          </footer>
        </>
      )}
    </Popover>
  );
}

/** Every neighbor of `nodeId` in a seeded `/graph` response, people first, then by title. */
function connectionsOf(nodeId: string, graph: { nodes: NodeRecord[]; edges: EdgeRecord[] }): Connection[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.edges
    .flatMap((edge) =>
      edge.src_id === nodeId
        ? [{ edge, node: byId.get(edge.dst_id)!, outgoing: true }]
        : edge.dst_id === nodeId
          ? [{ edge, node: byId.get(edge.src_id)!, outgoing: false }]
          : [],
    )
    .sort((a, b) => KIND_ORDER[a.node.kind] - KIND_ORDER[b.node.kind] || a.node.title.localeCompare(b.node.title));
}

/** When something is, e.g. "Fri, Oct 3 · 1:00 PM – 2:30 PM"; `end` is a plan's end, if any. */
function whenOf(start: string, end: string | null): string {
  const startDay = formatDayShort(new Date(start));
  if (!end || end === start) {
    return `${startDay} · ${formatTime(start)}`;
  }
  if (isSameDay(new Date(start), new Date(end))) {
    return `${startDay} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  return `${startDay} ${formatTime(start)} – ${formatDayShort(new Date(end))} ${formatTime(end)}`;
}
