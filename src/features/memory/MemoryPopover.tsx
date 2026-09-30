import { useEffect, useState, type RefObject } from "react";
import type { NodeSource } from "../../shared/api/types";
import { Popover, type PopoverAnchor, type PopoverHover } from "../../shared/components/Popover";
import { Tooltip } from "../../shared/components/Tooltip";
import { formatAbsolute, formatRelative } from "../../shared/lib/ux/time";
import { KIND_TOKEN, connectionsOf, truncate, type MemoryLink, type MemoryNode } from "./graph";

/** Connections listed before the rest fold behind "more". */
const CONNECTIONS_SHOWN = 6;

/** How each write source reads in the header. */
export const SOURCE_LABEL = {
  manual: "added by hand",
  agent: "added by an agent",
  ingest: "learned in conversation",
} as const satisfies Record<NodeSource, string>;

export type MemoryPopoverProps = {
  open: boolean;
  /** Node the panel shows; kept while it animates away. */
  node: MemoryNode;
  /** Every link in the graph; the node's own are listed as connections. */
  links: MemoryLink[];
  anchor: PopoverAnchor;
  containerRef: RefObject<HTMLElement | null>;
  /** Hover zone that keeps the panel open while the pointer is on the node or the panel. */
  hover: PopoverHover;
  onClose: () => void;
  /** A connection was clicked: focus that node. */
  onSelect: (nodeId: string) => void;
};

/**
 * Yaad node detail panel: title with kind and source, the body, when it happened and
 * was remembered and recalled, and its connections, each of which focuses its node.
 */
export function MemoryPopover({
  open,
  node,
  links,
  anchor,
  containerRef,
  hover,
  onClose,
  onSelect,
}: MemoryPopoverProps) {
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setShowAll(false);
  }, [node.id]);
  const connections = connectionsOf(node.id, links);
  const listed = showAll ? connections : connections.slice(0, CONNECTIONS_SHOWN);
  const folded = connections.length - listed.length;

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      containerRef={containerRef}
      aria-label={`${node.title} details`}
      widthPx={340}
      contentKey={node.id}
      hover={hover}
    >
      <header className="shrink-0 border-b border-rule/60 px-4 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-[15px] leading-snug font-medium text-ink">{node.title}</h2>
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
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {node.body ? (
          <p className="mb-4 text-[13px] leading-relaxed text-ink">{truncate(node.body, 320)}</p>
        ) : null}

        <section className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {node.occurred_at ? (
            <>
              <span className="text-ink-ghost">Happened</span>
              <Tooltip content={formatRelative(node.occurred_at)}>
                <span className="text-ink-muted">{formatAbsolute(node.occurred_at)}</span>
              </Tooltip>
            </>
          ) : null}
          <span className="text-ink-ghost">Remembered</span>
          <Tooltip content={formatAbsolute(node.created_at)}>
            <span className="text-ink-muted">{formatRelative(node.created_at)}</span>
          </Tooltip>
          <span className="text-ink-ghost">Recalled</span>
          {node.last_accessed_at ? (
            <Tooltip content={formatAbsolute(node.last_accessed_at)}>
              <span className="text-ink-muted">
                {node.access_count} {node.access_count === 1 ? "time" : "times"} · last{" "}
                {formatRelative(node.last_accessed_at)}
              </span>
            </Tooltip>
          ) : (
            <span className="text-ink-muted">Not yet</span>
          )}
          {node.expires_at ? (
            <>
              <span className="text-ink-ghost">Expires</span>
              <Tooltip content={formatAbsolute(node.expires_at)}>
                <span className="text-ink-muted">{formatRelative(node.expires_at)}</span>
              </Tooltip>
            </>
          ) : null}
        </section>

        <section>
          <h3 className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium tracking-[2px] text-ink-faint">
            CONNECTIONS
            <span className="tracking-normal text-ink-ghost">{connections.length}</span>
          </h3>
          {connections.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Not linked to anything yet.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {listed.map((c) => (
                <li key={c.id}>
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
                      {c.type.replace(/_/g, " ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {folded > 0 ? (
            <button
              type="button"
              className="mt-1 text-[11px] text-sage-deep"
              onClick={() => setShowAll(true)}
            >
              {folded} more
            </button>
          ) : null}
        </section>
      </div>
    </Popover>
  );
}
