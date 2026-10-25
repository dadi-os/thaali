import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { timeline } from "../../shared/api";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import type { TimelineItem } from "../../types/timeline";
import { formatDayShort, startOfDay } from "./dates";
import { itemKey } from "./plans";

/** Span of the someday query; the view reads its start as now and lists ideas and unscheduled tasks from there. */
const SOMEDAY_DAYS = 1;

export type SomedayRailProps = {
  /** An entry was clicked: open it beside `el`. */
  onOpen: (item: TimelineItem, el: Element) => void;
};

/**
 * Side rail of Yaad's someday view: ideas, and tasks with a due or an open but no time yet
 * ("needs a time"). Entries settle in one after another and open like any timeline entry.
 */
export function SomedayRail({ onOpen }: SomedayRailProps) {
  const from = startOfDay(new Date());
  const ideasQuery = useQuery({
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

  return (
    <aside className="flex w-[min(200px,28%)] shrink-0 flex-col border-l border-dashed border-sage-line pl-3">
      <span className="mb-2 text-[11px] font-medium tracking-[2px] text-sage-deep">SOMEDAY</span>
      {ideasQuery.isError ? (
        <p className="text-[12px] text-error">{ideasQuery.error.message}</p>
      ) : ideasQuery.isPending ? (
        <p className="text-[12px] text-ink-ghost">…</p>
      ) : ideasQuery.data.length === 0 ? (
        <p className="text-[12px] text-ink-ghost">Nothing for someday</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
          <AnimatePresence>
            {ideasQuery.data.map((idea, i) => (
              <motion.li
                key={itemKey(idea)}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{
                  duration: SLOW_S,
                  ease: EASE,
                  delay: Math.min(i * 0.03, 0.2),
                }}
              >
                <button
                  type="button"
                  onClick={(e) => onOpen(idea, e.currentTarget)}
                  className="w-full rounded-[6px] border border-dashed border-rule px-2 py-1.5 text-left text-[12px] leading-snug text-ink-muted transition-colors duration-slow ease-dadi hover:border-sage-line hover:text-ink"
                >
                  {idea.title}
                  {idea.status !== "idea" ? (
                    <span className="mt-0.5 block text-[10.5px] text-[var(--clay)]">
                      Needs a time
                      {idea.opens_at ? ` · opens ${formatDayShort(new Date(idea.opens_at))}` : ""}
                      {idea.due_at ? ` · due ${formatDayShort(new Date(idea.due_at))}` : ""}
                    </span>
                  ) : null}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}
