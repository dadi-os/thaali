import { Card } from "../../shared/components/Card";
import { IconButton } from "../../shared/components/Button";
import { Truncate } from "../../shared/components/Truncate";
import { formatAge, formatClock, formatDay } from "../../shared/lib/ux/time";
import type { NodeKind } from "../../types/yaad";
import { KIND_TOKEN, connectionsOf, type MemoryLink, type MemoryNode } from "./graph";

/** The name each kind goes by in the sheet's header. */
const KIND_NAME = { person: "Person", place: "Place", memory: "Memory", plan: "Plan" } as const satisfies Record<NodeKind, string>;

export type NodeSheetProps = {
  /** The focused node. */
  node: MemoryNode;
  /** Every link in the graph; the node's own are its connections. */
  links: MemoryLink[];
  /** A connection was clicked: focus that node. */
  onSelect: (nodeId: string) => void;
  /** The close control was pressed. */
  onClose: () => void;
};

type CellProps = {
  /** What the figure measures. */
  name: string;
  /** The figure itself. */
  value: string;
  /** The line under the value; none when the figure says it all. */
  note?: string;
};

/** One figure of the usage box: its caps name, the figure and a quiet line under it. */
function Cell({ name, value, note }: CellProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", borderRadius: 12, background: "var(--sage-fill)", minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--ink-muted)" }}>{name}</span>
      <span style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: "22px" }}>{value}</span>
      {note ? <Truncate text={note} style={{ fontSize: 12.5, color: "var(--ink-muted)" }} /> : null}
    </div>
  );
}

/**
 * The focused node's sheet, docked beside the graph: its kind and name, what it says, every node it connects to (people
 * first, each with the edge's type, an arrow when the edge points at this node) and how it has been used, every figure
 * from the node itself.
 */
export function NodeSheet({ node, links, onSelect, onClose }: NodeSheetProps) {
  const connections = connectionsOf(node.id, links);
  return (
    <Card style={{ width: 344, flex: "none", background: "var(--glass-sheet)", minHeight: 0, animation: "slide-in 550ms var(--ease) both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "18px 18px 10px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--sage-text)" }}>
            <span className="dot" style={{ width: 8, height: 8, background: `var(${KIND_TOKEN[node.kind]})` }} />
            {KIND_NAME[node.kind]}
          </span>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", overflowWrap: "anywhere", lineHeight: "26px" }}>{node.title}</span>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {node.body ? <span style={{ fontSize: 14, lineHeight: "21px", color: "var(--ink)" }}>{node.body}</span> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ui-label">Connections</span>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ink-muted)" }}>{connections.length}</span>
          </div>
          {connections.length > 0 ? (
            connections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                className="ui-trans ui-hover-fill"
                onClick={() => onSelect(connection.node.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, padding: "0 10px", borderRadius: 10 }}
              >
                <span className="dot" style={{ width: 8, height: 8, background: `var(${KIND_TOKEN[connection.node.kind]})` }} />
                <Truncate text={connection.node.title} style={{ flex: 1, fontSize: 14 }} />
                <span className="ui-mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{`${connection.outgoing ? "" : "← "}${connection.type}`}</span>
              </button>
            ))
          ) : (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Not connected to anything yet.</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="ui-label">Usage</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Cell name="Used" value={String(node.access_count)} note={node.access_count === 1 ? "time" : "times"} />
            {node.last_accessed_at === null ? (
              <Cell name="Last used" value="Never" />
            ) : (
              <Cell name="Last used" value={`${formatAge(node.last_accessed_at)} ago`} note={`${formatDay(node.last_accessed_at)}, ${formatClock(node.last_accessed_at)}`} />
            )}
            <Cell name="Stored" value={`${formatAge(node.created_at)} ago`} note={formatDay(node.created_at)} />
            <Cell name="Updated" value={`${formatAge(node.updated_at)} ago`} note={formatDay(node.updated_at)} />
            <Cell name="Connections" value={String(connections.length)} note={connections.length === 1 ? "link" : "links"} />
            <Cell name="Source" value={node.source === "agent" ? "Agent" : node.source} note={node.agent_id ?? undefined} />
          </div>
        </div>
      </div>
    </Card>
  );
}
