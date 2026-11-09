import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, IconButton } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import {
  FieldRow,
  SectionHeader,
  SheetHeader,
} from "../../shared/components/Module";
import { REVEAL, RISE } from "../../shared/motion";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import { formatAge, formatClock, formatDay } from "../../shared/lib/ux/time";
import type { NodeKind } from "../../types/yaad";
import {
  KIND_TOKEN,
  MEMORIES_SHOWN,
  SOURCE_LABEL,
  connectionsOf,
  sectionsOf,
  type Connection,
  type MemoryLink,
  type MemoryNode,
} from "./graph";

/** The name each kind goes by in the sheet's header. */
const KIND_NAME = {
  person: "Person",
  place: "Place",
  memory: "Memory",
  plan: "Plan",
} as const satisfies Record<NodeKind, string>;

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

type SectionProps = {
  title: string;
  /** How many rows the section holds. */
  count: number;
  children: ReactNode;
};

/** A caps title with the row count at its right, and the rows under it; the section eases open when it first has rows and shut when it loses them. */
function Section({ title, count, children }: SectionProps) {
  return (
    <motion.div {...REVEAL} className="flex-none overflow-hidden">
      <div className="flex flex-col gap-2">
        <SectionHeader title={title} count={count} />
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </motion.div>
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
    <motion.button
      {...RISE}
      layout="position"
      type="button"
      className="ui-trans ui-hover-fill flex min-h-10 min-w-0 items-center gap-3 rounded-[10px] px-3"
      onClick={() => onSelect(connection.node.id)}
    >
      {children}
    </motion.button>
  );
}

/**
 * The focused node's sheet, the page's side panel (docked beside the graph, a drawer over it on a narrow window): its kind and name, what it says, the plans still ahead and the memories
 * attached to it (newest first, each from the agent that wrote it), the other nodes it connects to (people first, each with the
 * edge's type, an arrow when the edge points at this node) and how it has been used, every figure from the node itself.
 */
export function NodeSheet({
  node,
  links,
  agentName,
  onSelect,
  onClose,
}: NodeSheetProps) {
  const [allMemories, setAllMemories] = useState(false);
  useEffect(() => setAllMemories(false), [node.id]);
  const connections = connectionsOf(node.id, links);
  const { comingUp, memories, others } = sectionsOf(connections, Date.now());
  const shownMemories = allMemories
    ? memories
    : memories.slice(0, MEMORIES_SHOWN);
  const origin = (of: MemoryNode) => {
    const name = of.agent_id === null ? undefined : agentName(of.agent_id);
    return name === undefined ? SOURCE_LABEL[of.source] : `from ${name}`;
  };
  return (
    <Card className="min-h-0 w-[344px] max-w-full flex-none bg-glass-sheet">
      <SheetHeader
        name={
          <>
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-sage-text">
              <span
                className="dot size-2"
                style={{ background: `var(${KIND_TOKEN[node.kind]})` }}
              />
              {KIND_NAME[node.kind]}
            </span>
            <span
              data-selectable
              className="text-[20px] leading-[28px] font-semibold tracking-[-0.015em] [overflow-wrap:anywhere]"
            >
              {node.title}
            </span>
          </>
        }
        action={<IconButton icon="close" label="Close" onClick={onClose} />}
      />
      <div className="scroll flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
        {node.body ? (
          <span data-selectable className="text-[14px] leading-[20px] text-ink">
            {node.body}
          </span>
        ) : null}
        <AnimatePresence initial={false}>
          {comingUp.length > 0 ? (
            <Section key="coming" title="Coming up" count={comingUp.length}>
              {comingUp.map((connection) => (
                <ConnectionRow
                  key={connection.id}
                  onSelect={onSelect}
                  connection={connection}
                >
                  <span className="flex-none text-[13px] font-semibold whitespace-nowrap text-due-ink tabular-nums">{`${formatDay(connection.node.occurred_at!)}, ${formatClock(connection.node.occurred_at!)}`}</span>
                  <Truncate
                    text={connection.node.title}
                    className="min-w-0 flex-1 text-left text-[14px]"
                  />
                </ConnectionRow>
              ))}
            </Section>
          ) : null}
          {memories.length > 0 ? (
            <Section
              key="remembered"
              title="Remembered"
              count={memories.length}
            >
              {shownMemories.map((connection) => (
                <motion.button
                  key={connection.id}
                  {...RISE}
                  layout="position"
                  type="button"
                  className="ui-trans ui-hover-card flex flex-col items-start gap-1 rounded-[12px] border border-glass-border bg-[var(--bone-80)] px-3 py-3 text-left"
                  onClick={() => onSelect(connection.node.id)}
                >
                  <span data-selectable className="text-[14px] leading-[20px]">
                    <Clamp text={connection.node.title} lines={3} />
                  </span>
                  <span className="text-[13px] text-ink-muted">{`${formatDay(connection.node.created_at)} · ${origin(connection.node)}`}</span>
                </motion.button>
              ))}
              {memories.length > MEMORIES_SHOWN && !allMemories ? (
                <motion.div key="all" {...RISE} className="flex">
                  <Button
                    tone="sage"
                    size="sm"
                    onClick={() => setAllMemories(true)}
                  >
                    {`All ${memories.length} memories`}
                  </Button>
                </motion.div>
              ) : null}
            </Section>
          ) : null}
          {others.length > 0 || connections.length === 0 ? (
            <Section
              key="connections"
              title="Connections"
              count={others.length}
            >
              {others.length > 0 ? (
                others.map((connection) => (
                  <ConnectionRow
                    key={connection.id}
                    onSelect={onSelect}
                    connection={connection}
                  >
                    <span
                      className="dot size-2"
                      style={{
                        background: `var(${KIND_TOKEN[connection.node.kind]})`,
                      }}
                    />
                    <Truncate
                      text={connection.node.title}
                      className="min-w-0 flex-1 text-left text-[14px]"
                    />
                    <span className="ui-mono flex-none text-[11px] whitespace-nowrap">{`${connection.outgoing ? "" : "← "}${connection.type}`}</span>
                  </ConnectionRow>
                ))
              ) : (
                <motion.span
                  key="none"
                  {...RISE}
                  className="text-[13px] text-ink-muted"
                >
                  Not connected to anything yet.
                </motion.span>
              )}
            </Section>
          ) : null}
        </AnimatePresence>
        <div className="flex flex-none flex-col gap-2">
          <SectionHeader title="Usage" />
          <div className="grid grid-cols-2 gap-2">
            <FieldRow
              label="Used"
              value={String(node.access_count)}
              note={node.access_count === 1 ? "time" : "times"}
            />
            {node.last_accessed_at === null ? (
              <FieldRow label="Last used" value="Never" />
            ) : (
              <FieldRow
                label="Last used"
                value={`${formatAge(node.last_accessed_at)} ago`}
                note={`${formatDay(node.last_accessed_at)}, ${formatClock(node.last_accessed_at)}`}
              />
            )}
            <FieldRow
              label="Stored"
              value={`${formatAge(node.created_at)} ago`}
              note={formatDay(node.created_at)}
            />
            <FieldRow
              label="Updated"
              value={`${formatAge(node.updated_at)} ago`}
              note={formatDay(node.updated_at)}
            />
            <FieldRow
              label="Connections"
              value={String(connections.length)}
              note={connections.length === 1 ? "link" : "links"}
            />
            <FieldRow
              label="Source"
              value={node.source === "agent" ? "Agent" : node.source}
              note={node.agent_id ?? undefined}
              selectable
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
