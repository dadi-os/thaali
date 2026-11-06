import { Card } from "../../shared/ui/Card";
import { Truncate } from "../../shared/ui/Truncate";
import { formatDayShort } from "./dates";
import { itemKey } from "./plans";
import { useNeedsATime } from "./Someday";

/** Props of {@link NeedsTimeCard}. */
export type NeedsTimeCardProps = {
  /** The card was pressed: open the Needs a time sheet. */
  onOpen: () => void;
};

/** The day view's side card for what has no time yet: every task waiting for one, soonest due first, and a count of the ideas; it opens the Needs a time sheet. */
export function NeedsTimeCard({ onOpen }: NeedsTimeCardProps) {
  const { tasks, ideas, pending } = useNeedsATime();
  return (
    <Card style={{ padding: 16, minWidth: 0, flex: "none", gap: 10 }}>
      <button type="button" onClick={onOpen} className="ui-hover-fill ui-trans -mx-1 flex items-baseline justify-between rounded-[8px] px-1 text-left">
        <span className="ui-label">Needs a time</span>
        <span className="text-[12px] text-ink-muted tabular-nums">{pending ? "" : `${tasks.length + ideas.length}`}</span>
      </button>
      {pending ? null : tasks.length === 0 && ideas.length === 0 ? (
        <span className="text-[13px] text-ink-muted">Nothing is waiting for a time.</span>
      ) : (
        <>
          {tasks.map((task) => (
            <button key={itemKey(task)} type="button" onClick={onOpen} className="ui-hover-fill ui-trans flex min-w-0 items-center gap-2 text-left">
              <span className="w-[3.75rem] flex-none whitespace-nowrap text-[12px] text-ink-muted tabular-nums">{task.due_at ? formatDayShort(new Date(task.due_at)) : "open"}</span>
              <Truncate text={task.title} className="min-w-0 flex-1 text-[13px]" />
            </button>
          ))}
          {ideas.length > 0 ? (
            <button type="button" onClick={onOpen} className="text-left text-[12px] text-ink-muted">
              {`${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"}`}
            </button>
          ) : null}
        </>
      )}
    </Card>
  );
}
