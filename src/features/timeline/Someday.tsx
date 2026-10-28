import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { timeline } from "../../shared/api";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import { formatDayShort, startOfDay } from "./dates";
import { itemKey, keeperOf } from "./plans";

/** Span of the someday query; the view reads its start as now and lists ideas and unscheduled tasks from there. */
const SOMEDAY_DAYS = 1;

/** Yaad's someday view: ideas, and tasks with a due or an open but no time yet. */
function useSomeday() {
  const from = startOfDay(new Date());
  return useQuery({
    queryKey: ["yaad", "timeline", "someday", from.toISOString()],
    queryFn: async () =>
      (
        await timeline.query({
          from: from.toISOString(),
          to: new Date(from.getTime() + SOMEDAY_DAYS * 86_400_000).toISOString(),
          view: "someday",
        })
      ).items,
  });
}

/** "Due Fri Oct 30 · opens Mon": when a task without a time is due and opens; null for an idea. */
function needsLine(item: TimelineItem): string | null {
  if (item.status === "idea") {
    return null;
  }
  return [
    item.due_at ? `Due ${formatDayShort(new Date(item.due_at))}` : "No due date",
    item.opens_at ? `opens ${formatDayShort(new Date(item.opens_at))}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type EntryProps = {
  item: TimelineItem;
  index: number;
  onOpen: (item: TimelineItem, el: Element) => void;
  /** The active agent that keeps it, named at the row's end; null shows no name. */
  keeper: AgentRecord | null;
};

/** One someday entry: a solid card for a task that needs a time, a dashed one for an idea. */
function Entry({ item, index, onOpen, keeper }: EntryProps) {
  const line = needsLine(item);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: SLOW_S, ease: EASE, delay: Math.min(index * 0.03, 0.24) }}
    >
      <button
        type="button"
        onClick={(e) => onOpen(item, e.currentTarget)}
        className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition-[border-color,transform] duration-slow ease-dadi hover:-translate-y-px hover:border-sage ${
          line ? "border-rule bg-[var(--glass-sheet)]" : "border-dashed border-sage-line"
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px] text-ink">{item.title}</span>
          <span className={`truncate text-[11.5px] ${line ? "text-[var(--clay)]" : "text-ink-ghost"}`}>{line ?? "Anytime"}</span>
        </span>
        {keeper ? <span className="max-w-[40%] shrink-0 truncate text-[11px] text-ink-ghost">{keeper.name}</span> : null}
      </button>
    </motion.li>
  );
}

export type SomedayProps = {
  /** An entry was clicked: open it beside `el`. */
  onOpen: (item: TimelineItem, el: Element) => void;
};

/** Skeleton rows while the someday view loads. */
function SomedaySkeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton h-11 rounded-[10px]" />
      ))}
    </div>
  );
}

/**
 * Side rail beside Week and Month: what needs a time (tasks with a due first) then ideas,
 * so agents' open work stays in view while you look at the calendar.
 */
export function SomedayRail({ onOpen }: SomedayProps) {
  const query = useSomeday();
  return (
    <aside className="flex w-[min(230px,28%)] shrink-0 flex-col border-l border-dashed border-sage-line pl-3">
      <span className="mb-2 flex items-baseline justify-between text-[11px] font-medium tracking-[2px] text-sage-deep">
        NEEDS A TIME
        {query.data ? <span className="tracking-normal text-ink-ghost">{query.data.length}</span> : null}
      </span>
      {query.isError ? (
        <p className="text-[12px] text-error">{query.error.message}</p>
      ) : query.isPending ? (
        <SomedaySkeleton rows={5} />
      ) : query.data.length === 0 ? (
        <p className="text-[12px] text-ink-ghost">Nothing waiting for a time</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
          <AnimatePresence>
            {sorted(query.data).map((item, i) => (
              <Entry key={itemKey(item)} item={item} index={i} onOpen={onOpen} keeper={null} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}

/** Tasks that need a time first, soonest due first; ideas after, in the view's order. */
function sorted(items: TimelineItem[]): TimelineItem[] {
  const due = (item: TimelineItem) => (item.due_at ? new Date(item.due_at).getTime() : Infinity);
  return [
    ...items.filter((item) => item.status !== "idea").sort((a, b) => due(a) - due(b)),
    ...items.filter((item) => item.status === "idea"),
  ];
}

/**
 * The Needs a time view: tasks waiting for a time (soonest due first) beside ideas, each
 * naming the agent that keeps it. Agents place them; clicking one opens it like any entry.
 */
export function NeedsATime({ onOpen }: SomedayProps) {
  const query = useSomeday();
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, enabled: false });
  if (query.isError) {
    return <p className="text-[12.5px] text-error">{query.error.message}</p>;
  }
  const tasks = query.data ? sorted(query.data).filter((item) => item.status !== "idea") : [];
  const ideas = query.data ? query.data.filter((item) => item.status === "idea") : [];
  const columns = [
    { label: "WITH A DEADLINE", note: "soonest first", items: tasks, empty: "Nothing with a deadline is waiting" },
    { label: "IDEAS", note: "", items: ideas, empty: "No ideas yet" },
  ];
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-hidden">
      {columns.map((column) => (
        <section key={column.label} className="flex min-h-0 flex-col">
          <span className="mb-2 flex items-baseline justify-between px-1 text-[11px] font-medium tracking-[2px] text-sage-deep">
            {column.label}
            {query.data ? (
              <span className="tracking-normal text-ink-ghost">
                {column.items.length}
                {column.note ? ` · ${column.note}` : ""}
              </span>
            ) : null}
          </span>
          {query.isPending ? (
            <SomedaySkeleton rows={7} />
          ) : column.items.length === 0 ? (
            <p className="px-1 text-[12.5px] text-ink-ghost">{column.empty}</p>
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1">
              <AnimatePresence>
                {column.items.map((item, i) => (
                  <Entry key={itemKey(item)} item={item} index={i} onOpen={onOpen} keeper={keeperOf(item, agents.data)} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
