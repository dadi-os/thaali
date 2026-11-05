import { Button } from "../../shared/ui/Button";
import type { TimelineItem } from "../../types/timeline";
import { usePlanActions } from "./planActions";

export type SessionActionsProps = {
  item: TimelineItem;
};

/** The actions of {@link planActions} a session's card shows as buttons: marking it Completed, and the message to its keeper. */
const SHOWN = new Set(["mark-done", "message"]);

/**
 * What Ankur can do with one session from its card: mark it Completed or take the mark back (the only write the app
 * makes), and message the agent that keeps it, or Dadi when none still runs. The same actions the menus offer.
 */
export function SessionActions({ item }: SessionActionsProps) {
  const actionsFor = usePlanActions();
  const shown = actionsFor(item).flatMap((entry) => (entry !== "separator" && SHOWN.has(entry.id) ? [entry] : []));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {shown.map((action) => (
        <Button key={action.id} tone={action.id === "mark-done" ? "sage" : "quiet"} size="sm" icon={action.icon} onClick={() => void action.run()}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}
