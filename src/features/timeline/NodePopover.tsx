import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { yaad } from "../../shared/api";
import type { TimelineItem } from "../../types/timeline";
import type { EdgeRecord, NodeRecord } from "../../types/yaad";
import { Popover, type PopoverAnchor } from "../../shared/components/Popover";
import { Tooltip } from "../../shared/components/Tooltip";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { KIND_ORDER, KIND_TOKEN } from "../memory/graph";
import { SOURCE_LABEL } from "../memory/MemoryPopover";
import { formatDayShort, formatTime, isSameDay } from "./dates";
import { SessionActions } from "./SessionActions";

/** Connections listed before the rest fold behind "more". */
const CONNECTIONS_SHOWN = 6;

export type NodePopoverProps = {
  open: boolean;
  /** Node the panel shows; kept while it animates away; changing it glides to the new content. */
  nodeId: string;
  /** The clicked session of the plan, whose times, state and actions the panel shows; absent for a connection. */
  session?: TimelineItem;
  anchor: PopoverAnchor;
  onClose: () => void;
  /** A connection was clicked: show that node instead. */
  onSelect: (nodeId: string) => void;
};

/** A neighbor of the shown node across one current edge. */
type Connection = { edge: EdgeRecord; node: NodeRecord; outgoing: boolean };

/**
 * Timeline detail panel for any Yaad node: when it is, its body, and connections, with a
 * jump to the node in the Yaad graph. For a session it also shows the session's state and
 * offers Completed and a message to the plan's owner; nothing here edits the plan.
 */
export function NodePopover({ open, nodeId, session, anchor, onClose, onSelect }: NodePopoverProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const nodeQuery = useQuery({
    queryKey: ["yaad", "node", nodeId],
    queryFn: () => yaad.getNode(nodeId),
  });
  const neighborsQuery = useQuery({
    queryKey: ["yaad", "graph", "seed", nodeId],
    queryFn: () => yaad.graph({ seed_ids: [nodeId] }),
  });

  useEffect(() => {
    setShowAll(false);
  }, [nodeId]);

  const node = nodeQuery.data;
  const connections = neighborsQuery.data ? connectionsOf(nodeId, neighborsQuery.data) : [];
  const listed = showAll ? connections : connections.slice(0, CONNECTIONS_SHOWN);
  const folded = connections.length - listed.length;
  const shownAt = session ? (session.start_at ?? session.due_at) : node?.occurred_at;
  const shownEnd = session ? session.end_at : null;

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
              <h3 className={`min-w-0 text-[15px] leading-snug font-medium text-ink ${session?.state === "cancelled" ? "line-through" : ""}`}>
                {node.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 text-[11px] tracking-wide text-ink-faint transition-colors duration-slow ease-dadi hover:text-ink-muted"
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
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {shownAt ? (
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink">
                  {session && session.start_at === null ? "Due " : ""}
                  {whenOf(shownAt, shownEnd, session?.all_day === true)}
                </span>
                <Tooltip content={formatAbsolute(shownAt)}>
                  <span className="shrink-0 text-[12px] text-ink-ghost">{formatRelative(shownAt)}</span>
                </Tooltip>
              </div>
            ) : null}

            {session ? (
              <p className="mb-3 text-[12px] text-ink-muted">
                {session.state === "cancelled"
                  ? "Cancelled"
                  : session.outcome === "done"
                    ? "Completed"
                    : session.outcome === "missed"
                      ? "Missed"
                      : session.status === "idea"
                        ? "Someday"
                        : "Not marked"}
                {session.recurrence ? ` · ${session.recurrence}` : ""}
                {session.series ? ` · completed ${session.series.completed} of ${session.series.total}` : ""}
                {session.place ? ` · ${session.place.title}${session.place.room ? ` room ${session.place.room}` : ""}` : ""}
              </p>
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
                        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1 text-left transition-colors duration-slow ease-dadi hover:bg-sage-fill"
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

          </div>

          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-rule/60 px-4 py-2.5">
            <button
              type="button"
              onClick={() => navigate(`/yaad?focus=${node.id}`)}
              className="text-[12px] text-sage-deep transition-colors duration-slow ease-dadi hover:text-ink"
            >
              Open in Yaad →
            </button>
            {session ? <SessionActions item={session} /> : null}
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

/** When something is, e.g. "Fri, Oct 3 · 1:00 PM – 2:30 PM", or "Mon, Oct 19 · All day"; `end` is a plan's end, if any. */
function whenOf(start: string, end: string | null, allDay: boolean): string {
  const startDay = formatDayShort(new Date(start));
  if (allDay) {
    return !end || isSameDay(new Date(start), new Date(end))
      ? `${startDay} · All day`
      : `${startDay} – ${formatDayShort(new Date(end))} · All day`;
  }
  if (!end || end === start) {
    return `${startDay} · ${formatTime(start)}`;
  }
  if (isSameDay(new Date(start), new Date(end))) {
    return `${startDay} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  return `${startDay} ${formatTime(start)} – ${formatDayShort(new Date(end))} ${formatTime(end)}`;
}
