import { useMutation, useQueryClient } from "@tanstack/react-query";
import { timeline } from "../../shared/api";
import { openAgent, openDadi } from "../../store/chat";
import type { TimelineItem } from "../../types/timeline";

/** Owners that are not agents: a plan made by hand or by plain ingest has no thread to message. */
const NO_AGENT = new Set(["manual", "ingest"]);

export type SessionActionsProps = {
  item: TimelineItem;
};

/**
 * What Ankur can do with one session: mark it Completed or take the mark back (the only
 * write the app makes), and message the agent that keeps it, or Dadi when no agent does.
 * Changes go through that conversation, never through edits here.
 */
export function SessionActions({ item }: SessionActionsProps) {
  const queryClient = useQueryClient();
  const date = item.occurrence_date;
  const completed = item.outcome === "done";
  const toggle = useMutation({
    mutationFn: (occurrenceDate: string) =>
      timeline.setOutcome({ plan_id: item.id, occurrence_date: occurrenceDate, outcome: completed ? null : "done" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["yaad", "timeline"] }),
  });
  const agent = NO_AGENT.has(item.owner) ? null : item.owner;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (agent === null ? openDadi() : openAgent(agent))}
          className="min-w-0 truncate text-[12px] text-sage-deep transition-colors duration-slow ease-dadi hover:text-ink"
        >
          {agent === null ? "Tell Dadi" : `Message ${agent}`}
        </button>
        {date !== null && item.state !== "cancelled" ? (
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(date)}
            className="shrink-0 rounded-[7px] border border-sage-line bg-bone-raised px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-sage-deep uppercase shadow-[var(--shadow)] transition-[background-color,border-color] duration-fast ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-progress"
          >
            {completed ? "Undo completed" : "Completed"}
          </button>
        ) : null}
      </div>
      {toggle.isError ? <p className="text-[12px] text-error">{toggle.error.message}</p> : null}
    </div>
  );
}
