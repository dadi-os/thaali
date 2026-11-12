import { Button } from "../../shared/ui/Button";
import type { TimelineItem } from "../../types/timeline";
import { usePlanActions } from "./planActions";

export type SessionActionsProps = {
  item: TimelineItem;
  /** The ids of the {@link planActions} to draw as buttons, in the order the plan's list gives them. */
  only: readonly string[];
};


/**
 * Some of what Ankur can do with one session, drawn as buttons on its card: mark it Completed or take the mark back (the
 * only write the app makes), show it in Yaad, or message the agent that keeps it (Dadi when none still runs), with what he
 * wants to say already in the composer. The same actions the right-click menu offers.
 */
export function SessionActions({ item, only }: SessionActionsProps) {
  const actionsFor = usePlanActions();
  const shown = actionsFor(item).flatMap((entry) => (entry !== "separator" && only.includes(entry.id) ? [entry] : []));
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {shown.map((action) => (
        <Button key={action.id} tone={action.id === "mark-done" ? "sage" : "quiet"} size="sm" icon={action.icon} onClick={() => void action.run()}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}
