import { Button } from "../../shared/ui/Button";
import { DetailCard, InsetSection, type FactItem } from "../../shared/ui/DetailCard";
import { LIST_ROW_CLASS, ListRow } from "../../shared/ui/ListRow";
import { Truncate } from "../../shared/ui/Truncate";
import { formatClock } from "../../shared/lib/ux/time";
import type { Plan, Task } from "../../types/planner";
import { duration } from "./phrases";
import { nextPlanId, planStatus, taskStatus, timeState, freeBetween } from "./timeState";
import { PlanButton } from "./PlanButton";
import { attendedLabel, spanRange } from "./plans";
import { startOfDay } from "./dates";

/** What a Month tile's "+N more" opens: one day, with every plan and every task closing on it. */
export type DayDetails = {
  day: Date;
  /** Every plan on the day. */
  plans: Plan[];
  /** Tasks that close on the day, done or not. */
  tasks: Task[];
};

/** How far a day is from today, in words: "Today", "Tomorrow", "Yesterday", "In 6 days", "12 days ago". */
function relation(day: Date, now: Date): string {
  const days = Math.round((startOfDay(day).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** What a plan row says under its title: Declined, the span of a multi-day plan, or where it stands in time; nothing for a plain all-day plan. */
function secondLine(plan: Plan, now: Date, nextId: string | null): string | null {
  if (plan.rsvp === "no") return "Declined";
  if (plan.attended !== null) return attendedLabel(plan);
  if (plan.all_day) return spanRange(plan);
  return planStatus(plan, now, timeState(plan, now, nextId));
}

/** Props of {@link DayCard}. */
export type DayCardProps = {
  details: DayDetails;
  now?: Date;
  /** Opens a plan's details. */
  onOpenPlan: (plan: Plan, element: Element) => void;
  /** Opens a task's details. */
  onOpenTask: (task: Task, element: Element) => void;
  /** Goes to the Day view of this day. */
  onOpenDay: () => void;
};

/**
 * A day in the shared detail anatomy: the date and what it holds as a chip, labelled facts (plans, free time, tasks closing),
 * an Open day action, and each plan and task as a row that says its own situation in words.
 */
export function DayCard({ details, now = new Date(), onOpenPlan, onOpenTask, onOpenDay }: DayCardProps) {
  const { day, plans, tasks } = details;
  const nextId = nextPlanId(plans, now);
  const counted = plans.filter((plan) => plan.rsvp !== "no");
  const free = freeBetween(plans, 30);
  const open = tasks.filter((task) => !task.done);
  const facts: Array<FactItem | null> = [
    { label: "Plans", value: counted.length === 0 ? "None" : `${counted.length} ${counted.length === 1 ? "plan" : "plans"}` },
    free > 0 ? { label: "Free time", value: duration(free), hint: "between plans" } : null,
    tasks.length === 0 ? null : { label: "Tasks closing", value: `${tasks.length}`, hint: open.length === tasks.length ? "none done yet" : `${tasks.length - open.length} done` },
  ];
  return (
    <DetailCard
      title={new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(day)}
      status={{ label: relation(day, now), tone: "calm" }}
      facts={facts}
      actions={
        <Button tone="sage" size="sm" icon="cal" onClick={onOpenDay}>
          Open day
        </Button>
      }
      sections={
        <>
          {plans.length === 0 ? null : (
            <InsetSection title="Plans">
              <ul className="m-0 flex flex-col gap-0.5 p-0">
                {plans.map((plan) => (
                  <li key={plan.id} className="list-none">
                    <PlanButton plan={plan} aria-haspopup="dialog" onClick={(event) => onOpenPlan(plan, event.currentTarget)} className={`${LIST_ROW_CLASS} flex-col items-stretch gap-0 px-2 py-1.5`} style={plan.attended === true ? { background: "var(--slab-attended)", boxShadow: "inset 0 0 0 1px var(--slab-attended-border)" } : undefined}>
                      <span className="flex min-w-0 items-baseline gap-2">
                        <Truncate text={plan.title} className={`min-w-0 flex-1 text-[14px] font-medium ${plan.rsvp === "no" ? "text-ink-muted" : ""} ${plan.attended === false ? "text-ink-muted line-through" : ""}`} />
                        <span className="flex-none text-[12px] text-ink-muted tabular-nums">{plan.all_day ? "All day" : plan.end_at === null ? formatClock(plan.start_at) : `${formatClock(plan.start_at)} – ${formatClock(plan.end_at)}`}</span>
                      </span>
                      {secondLine(plan, now, nextId) === null ? null : <span className="text-[12px] text-ink-muted">{secondLine(plan, now, nextId)}</span>}
                    </PlanButton>
                  </li>
                ))}
              </ul>
            </InsetSection>
          )}
          {tasks.length === 0 ? null : (
            <InsetSection title="Tasks closing">
              <ul className="m-0 flex flex-col gap-0.5 p-0">
                {tasks.map((task) => (
                  <li key={task.id} className="list-none">
                    <ListRow aria-haspopup="dialog" onClick={(event) => onOpenTask(task, event.currentTarget)} className="flex-col items-stretch gap-0 px-2 py-1.5">
                      <Truncate text={task.title} className={`text-[14px] font-medium ${task.done ? "text-ink-muted line-through" : ""}`} />
                      <span className="text-[12px] tabular-nums" style={{ color: taskStatus(task, now).tone === "late" ? "var(--late-ink)" : "var(--ink-muted)" }}>{taskStatus(task, now).label}</span>
                    </ListRow>
                  </li>
                ))}
              </ul>
            </InsetSection>
          )}
        </>
      }
    />
  );
}
