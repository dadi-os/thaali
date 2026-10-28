import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatRelative } from "../../shared/lib/ux/time";
import { KIND_TOKEN, connectionsOf, truncate, type Connection, type MemoryLink, type MemoryNode } from "./graph";
import type { AgentRecord } from "../../types/hath";
import { SOURCE_LABEL } from "./MemoryPopover";

/** Memories listed before the rest fold behind "All N memories". */
const MEMORIES_SHOWN = 4;

const DAY = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const WHEN = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

export type MemorySheetProps = {
  /** The focused node. */
  node: MemoryNode;
  /** Every link in the graph; the node's own become its sections. */
  links: MemoryLink[];
  /** A plan, memory or connection was clicked: focus that node. */
  onSelect: (nodeId: string) => void;
};

/**
 * The focused node's sheet, docked beside the graph as on the canvas: its kind and how many
 * connections it has, its name and body, then the plans still ahead under Coming up, the
 * memories attached to it under Remembered (newest first, the rest folded, each with the agent
 * that wrote it), and every other connection as a chip.
 */
export function MemorySheet({ node, links, onSelect }: MemorySheetProps) {
  const [allMemories, setAllMemories] = useState(false);
  useEffect(() => {
    setAllMemories(false);
  }, [node.id]);

  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, enabled: false });
  /** "from seas-research-manager" for an agent's write the sidebar knows, else how it was written. */
  const origin = (of: MemoryNode) => {
    const agent = of.agent_id === null ? undefined : agents.data?.find((candidate) => candidate.id === of.agent_id);
    return agent ? `from ${agent.name}` : SOURCE_LABEL[of.source];
  };
  const connections = connectionsOf(node.id, links);
  const now = Date.now();
  const ahead = (c: Connection) => c.node.kind === "plan" && c.node.occurred_at !== null && new Date(c.node.occurred_at).getTime() >= now;
  const comingUp = connections.filter(ahead).sort((a, b) => a.node.occurred_at!.localeCompare(b.node.occurred_at!));
  const memories = connections.filter((c) => c.node.kind === "memory").sort((a, b) => b.node.created_at.localeCompare(a.node.created_at));
  const others = connections.filter((c) => c.node.kind !== "memory" && !ahead(c));
  const shownMemories = allMemories ? memories : memories.slice(0, MEMORIES_SHOWN);

  return (
    <motion.aside
      key={node.id}
      aria-label={`${node.title} details`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      className="pointer-events-auto flex max-h-full w-[344px] flex-col overflow-y-auto rounded-[22px] border border-(--glass-border) bg-(--glass-sheet) p-6 shadow-[0_1px_2px_rgba(92,107,82,0.05),0_10px_30px_rgba(44,48,42,0.05)] backdrop-blur-md"
    >
      <span className="text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost uppercase">
        {node.kind} · {connections.length} {connections.length === 1 ? "connection" : "connections"}
      </span>
      <h2 className="m-0 mt-1.5 text-[24px] leading-tight font-bold tracking-[-0.3px] text-ink">{node.title}</h2>
      {node.body ? <p className="m-0 mt-2 text-[14px] leading-relaxed text-ink-muted">{truncate(node.body, 320)}</p> : null}
      <p className="m-0 mt-2 text-[12px] text-ink-ghost">
        Remembered {formatRelative(node.created_at)} · {origin(node)}
      </p>

      {comingUp.length > 0 ? (
        <Section title="Coming up">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {comingUp.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.node.id)}
                  className="flex w-full items-baseline gap-2.5 text-left text-[14px] hover:text-sage-deep"
                >
                  <span className="shrink-0 font-semibold text-[color-mix(in_srgb,var(--clay)_75%,var(--ink))]">
                    {WHEN.format(new Date(c.node.occurred_at!))}
                  </span>
                  <span className="min-w-0 truncate text-ink">{c.node.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {memories.length > 0 ? (
        <Section title="Remembered">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {shownMemories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.node.id)}
                  className="flex w-full flex-col gap-1 rounded-[14px] border border-rule bg-bone px-4 py-3 text-left transition-[border-color,box-shadow] duration-slow ease-dadi hover:border-sage-line hover:shadow-[var(--shadow)]"
                >
                  <span className="line-clamp-3 text-[14px] leading-snug text-ink">{c.node.title}</span>
                  <span className="text-[12px] text-ink-ghost">
                    {DAY.format(new Date(c.node.created_at))} · {origin(c.node)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {memories.length > MEMORIES_SHOWN && !allMemories ? (
            <button
              type="button"
              onClick={() => setAllMemories(true)}
              className="mt-3 text-[13px] font-semibold text-sage-deep hover:text-ink"
            >
              All {memories.length} memories →
            </button>
          ) : null}
        </Section>
      ) : null}

      {others.length > 0 ? (
        <Section title="Connected">
          <div className="flex flex-wrap gap-1.5">
            {others.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.type.replace(/_/g, " ")}
                onClick={() => onSelect(c.node.id)}
                className="flex max-w-full items-center gap-1.5 rounded-full border border-rule bg-bone px-2.5 py-1 text-[12.5px] text-ink transition-colors duration-slow ease-dadi hover:border-sage-line"
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: `var(${KIND_TOKEN[c.node.kind]})` }} />
                <span className="truncate">{c.node.title}</span>
              </button>
            ))}
          </div>
        </Section>
      ) : null}
    </motion.aside>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

/** A hairline, a caps label and what sits under it. */
function Section({ title, children }: SectionProps) {
  return (
    <section className="mt-5 border-t border-rule pt-4">
      <h3 className="m-0 mb-3 text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost uppercase">{title}</h3>
      {children}
    </section>
  );
}
