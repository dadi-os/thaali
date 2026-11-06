import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { timeline } from "../../shared/api";
import { openAgent } from "../../contexts/chat";
import { requestDock } from "../../contexts/dock";
import { saveDraft } from "../../contexts/drafts";
import { RISE, stagger } from "../../shared/motion";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { failureProps } from "../../shared/lib/ux/moduleState";
import { StateView } from "../../shared/states/ModuleState";
import { IconButton } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import { formatDayShort, startOfDay } from "./dates";
import { PlanButton } from "./PlanButton";
import { itemKey, keeperOf } from "./plans";

/** Span of the someday query; the view reads its start as now and lists ideas and unscheduled tasks from there. */
const SOMEDAY_DAYS = 1;

/** A task this many days out or fewer is drawn in clay. */
const SOON_DAYS = 3;

/** Tasks that need a time first, soonest due first, and the ideas after them. */
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

/** When a task is due, as a time to sort by; a task with no due date goes last. */
function dueTime(item: TimelineItem): number {
  return item.due_at ? new Date(item.due_at).getTime() : Infinity;
}

/** What Yaad holds that has no time: the tasks waiting for one (soonest due first) and the ideas, and whether the first answer is still on its way. */
export function useNeedsATime() {
  const query = useSomeday();
  const items = query.data ?? [];
  return {
    query,
    tasks: items.filter((item) => item.status !== "idea").sort((a, b) => dueTime(a) - dueTime(b)),
    ideas: items.filter((item) => item.status === "idea"),
    pending: query.isPending,
  };
}

/** Whole days from today to `at`, by calendar date. */
function daysUntil(at: Date): number {
  return Math.round((startOfDay(at).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks". */
function dueIn(days: number): string {
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`;
}

/** Opens the keeper's chat (or Dadi's dock) with "About “title”: " waiting in the composer. */
function askAbout(item: TimelineItem, keeper: AgentRecord | null): void {
  const due = item.due_at ? ` (due ${formatDayShort(new Date(item.due_at))})` : "";
  const text = `About “${item.title}”${due}: `;
  if (keeper) {
    saveDraft(keeper.id, text);
    openAgent(keeper.id);
  } else {
    requestDock(text);
  }
}

/** The shape of what is coming while the first answer is on its way. */
function Skeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="sk h-[68px] rounded-[16px]" />
      ))}
    </div>
  );
}

/** The label above one of the sheet's lists, with how many it holds. */
function ListHead({ title, count }: { title: string; count: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <span className="ui-label">{title}</span>
      <span className="text-[12px] text-ink-muted tabular-nums">{count}</span>
    </div>
  );
}

type AskProps = {
  item: TimelineItem;
  keeper: AgentRecord | null;
};

/** The one control to raise an item with whoever can place it: a send glyph that darkens to sage under the pointer, with no box around it; it opens the keeper's chat (or Dadi's dock) with the item already in the composer. */
function Ask({ item, keeper }: AskProps) {
  const label = keeper ? `Ask ${keeper.name} to place it` : "Tell Dadi about it";
  return (
    <button type="button" aria-label={label} title={label} onClick={() => askAbout(item, keeper)} className="ui-trans flex size-8 flex-none items-center justify-center rounded-full text-ink-ghost hover:text-sage-deep">
      <Icon name="send" size={16} />
    </button>
  );
}

type PlaceRowProps = {
  item: TimelineItem;
  keeper: AgentRecord | null;
  index: number;
  onOpen: (item: TimelineItem, el: Element) => void;
};

/** One task that needs a time: a day badge, what it is, when it is due and who keeps it, and the send glyph to ask them to place it; the card's edge warms to sage under the pointer. */
function PlaceRow({ item, keeper, index, onOpen }: PlaceRowProps) {
  const due = item.due_at ? new Date(item.due_at) : null;
  const days = due ? daysUntil(due) : null;
  const soon = days !== null && days <= SOON_DAYS;
  return (
    <motion.li
      layout
      {...RISE}
      transition={{ ...RISE.transition, delay: stagger(index) }}
      className="ui-trans flex items-center gap-3 rounded-[16px] border border-rule bg-glass-sheet p-2.5 pr-2 hover:border-sage-line hover:shadow-[var(--shadow)]"
    >
      <span className={`flex size-12 flex-none flex-col items-center justify-center rounded-[12px] ${soon ? "bg-[color-mix(in_srgb,var(--clay)_16%,transparent)] text-[color-mix(in_srgb,var(--clay)_70%,var(--ink))]" : "bg-sage-fill text-sage-text"}`}>
        <span className="text-[11px] leading-3 font-semibold">{due ? due.toLocaleDateString(undefined, { weekday: "short" }) : "Open"}</span>
        <span className="text-[17px] leading-5 font-semibold tabular-nums">{due ? due.getDate() : "—"}</span>
      </span>
      <PlanButton item={item} onClick={(e) => onOpen(item, e.currentTarget)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="truncate text-[14px] font-medium text-ink">{item.title}</span>
        <span className="truncate text-[12.5px] text-ink-muted">
          {[days !== null ? `due ${dueIn(days)}` : "no due date", item.opens_at ? `opens ${formatDayShort(new Date(item.opens_at))}` : null, keeper?.name ?? null].filter(Boolean).join(" · ")}
        </span>
      </PlanButton>
      <Ask item={item} keeper={keeper} />
    </motion.li>
  );
}

/** Props of {@link NeedsATime}. */
export type NeedsATimeProps = {
  /** An entry was clicked: open it beside `el`. */
  onOpen: (item: TimelineItem, el: Element) => void;
  /** The close control was pressed. */
  onClose: () => void;
};

/**
 * The body of the Needs a time sheet: a header with what is waiting, then the tasks waiting for a time (soonest due
 * first, each with a day badge that turns clay at three days out and a button that asks its keeper to place it), then the
 * ideas grouped by the agent that keeps them so each group can be raised at once.
 */
export function NeedsATime({ onOpen, onClose }: NeedsATimeProps) {
  const { query, tasks, ideas, pending } = useNeedsATime();
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, enabled: false });
  const groups = new Map<string, { keeper: AgentRecord | null; items: TimelineItem[] }>();
  for (const idea of ideas) {
    const keeper = keeperOf(idea, agents.data);
    const group = groups.get(keeper?.id ?? "") ?? { keeper, items: [] };
    group.items.push(idea);
    groups.set(keeper?.id ?? "", group);
  }
  const ideaGroups = [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  return (
    <>
      <header className="flex flex-none items-start justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="m-0 text-[20px] leading-7 font-semibold tracking-[-0.015em]">Needs a time</h2>
          <span className="text-[13px] text-ink-muted">{pending ? "Loading…" : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} waiting · ${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"}`}</span>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </header>
      <div className="scroll flex min-h-0 flex-1 flex-col gap-6 px-4 pb-14">
        {query.isError && !query.data ? (
          <StateView kind="error" title="Couldn’t load what needs a time" {...failureProps(query.error)} onRetry={() => void query.refetch()} />
        ) : pending ? (
          <Skeleton rows={5} />
        ) : tasks.length === 0 && ideas.length === 0 ? (
          <StateView kind="empty" title="Nothing needs a time" detail="Agents place tasks into open time as they find it." />
        ) : (
          <>
            <section>
              <ListHead title="To place" count="soonest due first" />
              {tasks.length === 0 ? (
                <p className="px-1 text-[13px] text-ink-muted">Nothing is waiting for a time.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  <AnimatePresence>
                    {tasks.map((item, i) => (
                      <PlaceRow key={itemKey(item)} item={item} keeper={keeperOf(item, agents.data)} index={i} onOpen={onOpen} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
            <section>
              <ListHead title="Ideas" count="no date yet" />
              {ideaGroups.length === 0 ? (
                <p className="px-1 text-[13px] text-ink-muted">No ideas yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {ideaGroups.map((group, g) => (
                    <motion.section
                      key={group.keeper?.id ?? "none"}
                      {...RISE}
                      transition={{ ...RISE.transition, delay: stagger(g + 2) }}
                      className="rounded-[16px] border border-dashed border-sage-line px-4 py-3"
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-sage-deep">{group.keeper?.name ?? "No agent keeps these"}</span>
                        <span className="text-[12px] text-ink-muted tabular-nums">{group.items.length}</span>
                      </div>
                      <ul className="m-0 flex list-none flex-col p-0">
                        {group.items.map((idea) => (
                          <li key={itemKey(idea)} className="flex items-center gap-1">
                            <PlanButton item={idea} onClick={(e) => onOpen(idea, e.currentTarget)} className="ui-trans min-w-0 flex-1 truncate py-1.5 text-left text-[13px] text-ink hover:text-sage-deep">
                              {idea.title}
                            </PlanButton>
                            <Ask item={idea} keeper={group.keeper} />
                          </li>
                        ))}
                      </ul>
                    </motion.section>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
