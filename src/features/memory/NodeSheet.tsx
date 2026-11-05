import { useEffect, useState, type ReactNode } from "react";
import { Button, IconButton } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import { formatAge, formatClock, formatDay } from "../../shared/lib/ux/time";
import type { NodeKind } from "../../types/yaad";
import { KIND_TOKEN, MEMORIES_SHOWN, SOURCE_LABEL, connectionsOf, sectionsOf, type Connection, type MemoryLink, type MemoryNode } from "./graph";

/** The name each kind goes by in the sheet's header. */
const KIND_NAME = { person: "Person", place: "Place", memory: "Memory", plan: "Plan" } as const satisfies Record<NodeKind, string>;

export type NodeSheetProps = {
  /** The focused node. */
  node: MemoryNode;
  /** Every link in the graph; the node's own are its connections. */
  links: MemoryLink[];
  /** The name of the agent with this id, or undefined when the agents list does not hold it. */
  agentName: (agentId: string) => string | undefined;
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
  /** The note is an id a person may want to copy. */
  selectable?: boolean;
};

/** One figure of the usage box: its caps name, the figure and a quiet line under it. */
function Cell({ name, value, note, selectable = false }: CellProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", borderRadius: 12, background: "var(--sage-fill)", minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--ink-muted)" }}>{name}</span>
      <span style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: "22px" }}>{value}</span>
      {note ? <Truncate text={note} selectable={selectable} style={{ fontSize: 13, color: "var(--ink-muted)" }} /> : null}
    </div>
  );
}

type SectionProps = {
  title: string;
  /** How many rows the section holds. */
  count: number;
  children: ReactNode;
};

/** A caps title with the row count at its right, and the rows under it. */
function Section({ title, count, children }: SectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ui-label">{title}</span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-muted)" }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

type ConnectionRowProps = {
  connection: Connection;
  onSelect: (nodeId: string) => void;
  children: ReactNode;
};

/** A row that focuses the node it names. */
function ConnectionRow({ connection, onSelect, children }: ConnectionRowProps) {
  return (
    <button type="button" className="ui-trans ui-hover-fill" onClick={() => onSelect(connection.node.id)} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, padding: "0 10px", borderRadius: 10 }}>
      {children}
    </button>
  );
}

/**
 * The focused node's sheet, the page's side panel (docked beside the graph, a drawer over it on a narrow window): its kind and name, what it says, the plans still ahead and the memories
 * attached to it (newest first, each from the agent that wrote it), the other nodes it connects to (people first, each with the
 * edge's type, an arrow when the edge points at this node) and how it has been used, every figure from the node itself.
 */
export function NodeSheet({ node, links, agentName, onSelect, onClose }: NodeSheetProps) {
  const [allMemories, setAllMemories] = useState(false);
  useEffect(() => setAllMemories(false), [node.id]);
  const connections = connectionsOf(node.id, links);
  const { comingUp, memories, others } = sectionsOf(connections, Date.now());
  const shownMemories = allMemories ? memories : memories.slice(0, MEMORIES_SHOWN);
  const origin = (of: MemoryNode) => {
    const name = of.agent_id === null ? undefined : agentName(of.agent_id);
    return name === undefined ? SOURCE_LABEL[of.source] : `from ${name}`;
  };
  return (
    <Card style={{ width: 344, flex: "none", background: "var(--glass-sheet)", minHeight: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "18px 18px 10px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--sage-text)" }}>
            <span className="dot" style={{ width: 8, height: 8, background: `var(${KIND_TOKEN[node.kind]})` }} />
            {KIND_NAME[node.kind]}
          </span>
          <span data-selectable style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", overflowWrap: "anywhere", lineHeight: "26px" }}>{node.title}</span>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {node.body ? <span data-selectable style={{ fontSize: 14, lineHeight: "21px", color: "var(--ink)" }}>{node.body}</span> : null}
        {comingUp.length > 0 ? (
          <Section title="Coming up" count={comingUp.length}>
            {comingUp.map((connection) => (
              <ConnectionRow key={connection.id} onSelect={onSelect} connection={connection}>
                <span style={{ flex: "none", fontSize: 13, fontWeight: 600, color: "var(--due-ink)", whiteSpace: "nowrap" }}>{`${formatDay(connection.node.occurred_at!)}, ${formatClock(connection.node.occurred_at!)}`}</span>
                <Truncate text={connection.node.title} style={{ flex: 1, fontSize: 14 }} />
              </ConnectionRow>
            ))}
          </Section>
        ) : null}
        {memories.length > 0 ? (
          <Section title="Remembered" count={memories.length}>
            {shownMemories.map((connection) => (
              <button
                key={connection.id}
                type="button"
                className="ui-trans ui-hover-card"
                onClick={() => onSelect(connection.node.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "10px 12px", borderRadius: 12, background: "rgba(250, 250, 247, 0.8)", border: "1px solid var(--glass-border)", textAlign: "left" }}
              >
                <span data-selectable><Clamp text={connection.node.title} lines={3} style={{ fontSize: 14, lineHeight: "20px" }} /></span>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{`${formatDay(connection.node.created_at)} · ${origin(connection.node)}`}</span>
              </button>
            ))}
            {memories.length > MEMORIES_SHOWN && !allMemories ? (
              <Button tone="sage" size="sm" style={{ alignSelf: "flex-start" }} onClick={() => setAllMemories(true)}>
                {`All ${memories.length} memories`}
              </Button>
            ) : null}
          </Section>
        ) : null}
        {others.length > 0 || connections.length === 0 ? (
          <Section title="Connections" count={others.length}>
            {others.length > 0 ? (
              others.map((connection) => (
                <ConnectionRow key={connection.id} onSelect={onSelect} connection={connection}>
                  <span className="dot" style={{ width: 8, height: 8, background: `var(${KIND_TOKEN[connection.node.kind]})` }} />
                  <Truncate text={connection.node.title} style={{ flex: 1, fontSize: 14 }} />
                  <span className="ui-mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{`${connection.outgoing ? "" : "← "}${connection.type}`}</span>
                </ConnectionRow>
              ))
            ) : (
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Not connected to anything yet.</span>
            )}
          </Section>
        ) : null}
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
            <Cell name="Source" value={node.source === "agent" ? "Agent" : node.source} note={node.agent_id ?? undefined} selectable />
          </div>
        </div>
      </div>
    </Card>
  );
}
