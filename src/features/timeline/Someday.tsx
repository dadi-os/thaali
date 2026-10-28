import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { timeline } from "../../shared/api";
import { openAgent, openDadi } from "../../store/chat";
import { DADI_DRAFT_KEY, saveDraft } from "../../store/drafts";
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
};

/** One someday entry: a solid card for a task that needs a time, a dashed one for an idea. */
function Entry({ item, index, onOpen }: EntryProps) {
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
        onContextMenu={(e) => {
          e.preventDefault();
          onOpen(item, e.currentTarget);
        }}
        className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition-[border-color,box-shadow] duration-slow ease-dadi hover:border-sage hover:shadow-[var(--shadow)] ${
          line ? "border-rule bg-[var(--glass-sheet)]" : "border-dashed border-sage-line"
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px] text-ink">{item.title}</span>
          <span className={`truncate text-[11.5px] ${line ? "text-[var(--clay)]" : "text-ink-ghost"}`}>{line ?? "Anytime"}</span>
        </span>
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
    <aside className="flex w-[min(230px,28%)] shrink-0 flex-col border-l border-dashed border-sage-line pl-3 portrait:max-h-[24%] portrait:w-full portrait:border-t portrait:border-l-0 portrait:pt-3 portrait:pl-0">
      <span className="mb-2 flex items-baseline justify-between text-[11px] font-medium tracking-[2px] text-sage-deep">
        NEEDS A TIME
        {query.data ? <span className="tracking-normal text-ink-ghost">{query.data.length}</span> : null}
      </span>
      {query.isError && !query.data ? (
        <p className="text-[12px] text-error">{query.error.message}</p>
      ) : query.isPending ? (
        <SomedaySkeleton rows={5} />
      ) : query.data.length === 0 ? (
        <p className="text-[12px] text-ink-ghost">Nothing waiting for a time</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden portrait:grid portrait:grid-cols-3 portrait:content-start">
          <AnimatePresence>
            {sorted(query.data).map((item, i) => (
              <Entry key={itemKey(item)} item={item} index={i} onOpen={onOpen} />
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

/** Whole days from today to `at`, by calendar date. */
function daysUntil(at: Date): number {
  return Math.round((startOfDay(at).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks". */
function dueIn(days: number): string {
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`;
}

/** Opens the keeper's chat (or Dadi's) with "About “title”: " waiting in the composer. */
function askAbout(item: TimelineItem, keeper: AgentRecord | null) {
  const due = item.due_at ? ` (due ${formatDayShort(new Date(item.due_at))})` : "";
  const text = `About “${item.title}”${due}: `;
  if (keeper) {
    saveDraft(keeper.id, text);
    openAgent(keeper.id);
  } else {
    saveDraft(DADI_DRAFT_KEY, text);
    openDadi();
  }
}

type PlaceRowProps = {
  item: TimelineItem;
  keeper: AgentRecord | null;
  index: number;
  onOpen: (item: TimelineItem, el: Element) => void;
};

/** One task that needs a time: when it is due, what it is and who keeps it, and a way to ask them to place it. */
function PlaceRow({ item, keeper, index, onOpen }: PlaceRowProps) {
  const due = item.due_at ? new Date(item.due_at) : null;
  const days = due ? daysUntil(due) : null;
  const soon = days !== null && days <= 3;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: SLOW_S, ease: EASE, delay: Math.min(index * 0.04, 0.3) }}
      className="flex items-center gap-4 rounded-[14px] border border-rule bg-[var(--glass-sheet)] px-4 py-3 transition-[border-color,box-shadow] duration-slow ease-dadi hover:border-sage-line hover:shadow-[var(--shadow)]"
    >
      <span
        className={`flex w-14 shrink-0 flex-col items-center rounded-[10px] py-1.5 ${
          soon ? "bg-[color-mix(in_srgb,var(--clay)_16%,transparent)] text-[color-mix(in_srgb,var(--clay)_70%,var(--ink))]" : "bg-sage-fill text-sage-text"
        }`}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[1px]">{due ? due.toLocaleDateString(undefined, { weekday: "short" }) : "open"}</span>
        <span className="text-[18px] font-semibold leading-tight tabular-nums">{due ? due.getDate() : "—"}</span>
      </span>
      <button
        type="button"
        onClick={(e) => onOpen(item, e.currentTarget)}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpen(item, e.currentTarget);
        }}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span className="truncate text-[14px] font-medium text-ink">{item.title}</span>
        <span className="truncate text-[12px] text-ink-ghost">
          {days !== null ? <span className={soon ? "text-[var(--clay)]" : ""}>due {dueIn(days)}</span> : null}
          {item.opens_at ? `${days !== null ? " · " : ""}opens ${formatDayShort(new Date(item.opens_at))}` : ""}
          {keeper ? ` · ${keeper.name}` : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={() => askAbout(item, keeper)}
        className="shrink-0 rounded-full border border-sage-line px-3 py-1 text-[12px] font-semibold text-sage-deep transition-colors duration-slow ease-dadi hover:bg-sage-fill"
      >
        {keeper ? "Ask to place it" : "Tell Dadi"}
      </button>
    </motion.li>
  );
}

/**
 * The Needs a time view: what is still up in the air. On the left, tasks waiting for a time,
 * soonest due first, each with a day badge (clay when it is three days off or less) and a
 * button that opens its keeper's chat to ask them to place it. On the right, ideas grouped by
 * the agent that keeps them, so each group can be raised with that agent at once.
 */
export function NeedsATime({ onOpen }: SomedayProps) {
  const query = useSomeday();
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, enabled: false });
  if (query.isError && !query.data) {
    return <p className="text-[12.5px] text-error">{query.error.message}</p>;
  }
  const tasks = query.data ? sorted(query.data).filter((item) => item.status !== "idea") : [];
  const ideas = query.data ? query.data.filter((item) => item.status === "idea") : [];
  const groups = new Map<string, { keeper: AgentRecord | null; items: TimelineItem[] }>();
  for (const idea of ideas) {
    const keeper = keeperOf(idea, agents.data);
    const key = keeper?.id ?? "";
    const group = groups.get(key) ?? { keeper, items: [] };
    group.items.push(idea);
    groups.set(key, group);
  }
  const ideaGroups = [...groups.values()].sort((a, b) => b.items.length - a.items.length);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 overflow-hidden portrait:grid-cols-1 portrait:grid-rows-[auto_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col">
        <header className="mb-3 flex items-baseline justify-between px-1">
          <span className="text-[15px] font-semibold text-ink">To place</span>
          <span className="text-[12px] text-ink-ghost">{query.data ? `${tasks.length} waiting for a time · soonest first` : ""}</span>
        </header>
        {query.isPending ? (
          <SomedaySkeleton rows={6} />
        ) : tasks.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-ghost">Nothing is waiting for a time.</p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-1">
            <AnimatePresence>
              {tasks.map((item, i) => (
                <PlaceRow key={itemKey(item)} item={item} keeper={keeperOf(item, agents.data)} index={i} onOpen={onOpen} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <section className="flex min-h-0 flex-col">
        <header className="mb-3 flex items-baseline justify-between px-1">
          <span className="text-[15px] font-semibold text-ink">Ideas</span>
          <span className="text-[12px] text-ink-ghost">{query.data ? `${ideas.length} with no date yet` : ""}</span>
        </header>
        {query.isPending ? (
          <SomedaySkeleton rows={4} />
        ) : ideaGroups.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-ghost">No ideas yet.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-1">
            {ideaGroups.map((group, g) => (
              <motion.section
                key={group.keeper?.id ?? "none"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: SLOW_S, ease: EASE, delay: Math.min(0.1 + g * 0.05, 0.4) }}
                className="rounded-[14px] border border-dashed border-sage-line px-4 py-3"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-sage-deep">{group.keeper?.name ?? "No agent keeps these"}</span>
                  <span className="text-[11.5px] text-ink-ghost">{group.items.length}</span>
                </div>
                <ul className="flex flex-col">
                  {group.items.map((idea) => (
                    <li key={itemKey(idea)} className="group flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => onOpen(idea, e.currentTarget)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onOpen(idea, e.currentTarget);
                        }}
                        className="-mx-2 min-w-0 flex-1 truncate rounded-[8px] px-2 py-1.5 text-left text-[13px] text-ink transition-colors duration-slow ease-dadi hover:bg-sage-fill"
                      >
                        {idea.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => askAbout(idea, group.keeper)}
                        className="shrink-0 text-[11.5px] font-semibold text-sage-deep opacity-0 transition-opacity duration-slow ease-dadi group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        {group.keeper ? "Ask" : "Tell Dadi"}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
