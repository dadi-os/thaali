import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { yaad } from "../../shared/api";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { asPlan, type PlanNode } from "./plans";

export type SomedayRailProps = {
  /** An idea was clicked: open it beside `el`. */
  onOpen: (nodeId: string, el: Element) => void;
};

/**
 * Side rail of undated idea plans (Yaad `status: idea`), polled on its own. Ideas
 * settle in one after another and open like any timeline entry.
 */
export function SomedayRail({ onOpen }: SomedayRailProps) {
  const ideasQuery = useQuery({
    queryKey: ["yaad", "plans", "ideas"],
    queryFn: async () => {
      const { nodes } = await yaad.query({
        status: "idea",
        limit: 50,
      });
      return nodes.map(asPlan).filter((n): n is PlanNode => n !== null);
    },
    refetchInterval: POLL_MS,
  });

  return (
    <aside className="flex w-[min(200px,28%)] shrink-0 flex-col border-l border-dashed border-sage-line pl-3">
      <span className="mb-2 text-[11px] font-medium tracking-[2px] text-sage-deep">SOMEDAY</span>
      {ideasQuery.isError ? (
        <p className="text-[12px] text-error">{ideasQuery.error.message}</p>
      ) : ideasQuery.isPending ? (
        <p className="text-[12px] text-ink-ghost">…</p>
      ) : ideasQuery.data.length === 0 ? (
        <p className="text-[12px] text-ink-ghost">No ideas yet</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          <AnimatePresence>
            {ideasQuery.data.map((idea, i) => (
              <motion.li
                key={idea.id}
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
                  onClick={(e) => onOpen(idea.id, e.currentTarget)}
                  className="w-full rounded-[6px] border border-dashed border-rule px-2 py-1.5 text-left text-[12px] leading-snug text-ink-muted transition-colors duration-slow ease-hath hover:border-sage-line hover:text-ink"
                >
                  {idea.title}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}
