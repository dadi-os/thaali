import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { isMeshOnline, planner } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";
import { REVEAL } from "../../shared/motion";
import { StateView } from "../../shared/states/ModuleState";
import { formatAge, formatClock, formatDay } from "../../shared/lib/ux/time";
import { Icon } from "../../shared/ui/Icon";
import { IconButton } from "../../shared/ui/Button";
import { Truncate } from "../../shared/ui/Truncate";
import type { Plan, Task } from "../../types/planner";
import { PLANS_KEY } from "./attended";
import { addDays, dateKey, startOfDay } from "./dates";
import { keptBy, loosePlans } from "./plans";
import { Check } from "./Check";
import { PlanButton } from "./PlanButton";
import { MessageAgent } from "./taskActions";
import { groupSomeday, SOMEDAY_KEY, type SomedayGroup } from "./tasks";
import { useTaskTick } from "./useTaskTick";

/** How far ahead the sheet looks for plans that have a day but no end, in days. */
const LOOK_AHEAD_DAYS = 90;

/** What the Someday sheet holds: tasks with no window, and plans that have a day but no end. */
export type SomedayData = { tasks: Task[]; plans: Plan[]; count: number };

/** The Someday tasks (not done) and loose plans, and how many there are in all. */
export function useSomeday(): SomedayData {
  const { state: connection } = useConnection();
  const online = isMeshOnline(connection);
  const tasks = useQuery({ queryKey: SOMEDAY_KEY, queryFn: async () => (await planner.tasks({ someday: true })).items, enabled: online });
  const today = startOfDay(new Date());
  const plans = useQuery({
    queryKey: [...PLANS_KEY, "someday", dateKey(today)],
    queryFn: async () => loosePlans((await planner.plans({ from: today.toISOString(), to: addDays(today, LOOK_AHEAD_DAYS).toISOString() })).items),
    enabled: online,
  });
  const open = (tasks.data ?? []).filter((task) => !task.done);
  const loose = plans.data ?? [];
  return { tasks: open, plans: loose, count: open.length + loose.length };
}

type SectionProps = {
  label: string;
  count: number;
  children: ReactNode;
};

/** A titled section of the sheet: its label and count over its rows. */
function Section({ label, count, children }: SectionProps) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <span className="ui-label">{label}</span>
        <span className="text-[12px] text-ink-muted tabular-nums">{count}</span>
      </div>
      {children}
    </section>
  );
}

type TaskRowProps = {
  task: Task;
  now: Date;
  onTick: (task: Task, done: boolean) => void;
  /** The row sits under a group header: its message button is the icon alone and its title is the group's. */
  grouped?: boolean;
};

/** One Someday task: a ring to tick it, its title, who keeps it and when it was last checked, and a way to message them. */
function TaskRow({ task, now, onTick, grouped = false }: TaskRowProps) {
  const fresh = task.verified_at === null || now.getTime() - Date.parse(task.verified_at) < 86_400_000;
  const meta = [keptBy(task.owner), fresh ? null : `checked ${formatAge(task.verified_at!, now.getTime())} ago`].filter((part) => part !== null).join(" · ");
  return (
    <li className="flex list-none items-center gap-2 rounded-[12px] px-2 py-1.5">
      <button type="button" role="checkbox" aria-checked={task.done} aria-label={task.title} onClick={() => onTick(task, !task.done)} className="flex p-1">
        <Check done={task.done} />
      </button>
      <span className="flex min-w-0 flex-1 flex-col">
        <Truncate text={task.title} className="text-[14px] font-medium" />
        {meta === "" ? null : <Truncate text={meta} className="text-[12px] text-ink-muted" />}
      </span>
      <MessageAgent task={task} iconOnly={grouped} />
    </li>
  );
}

type GroupProps = {
  group: SomedayGroup;
  now: Date;
  onTick: (task: Task, done: boolean) => void;
};

/** A run of repeated titles as one row with its count, opening to its tasks; a lone task is just its row. */
function Group({ group, now, onTick }: GroupProps) {
  const [open, setOpen] = useState(false);
  if (group.tasks.length === 1) {
    return <TaskRow task={group.tasks[0]!} now={now} onTick={onTick} />;
  }
  return (
    <li className="list-none">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="ui-hover-fill ui-trans flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left">
        <span className="flex flex-none" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform var(--fast) var(--ease)" }}>
          <Icon name="chevron" size={12} />
        </span>
        <Truncate text={group.label.replace(/[\s#:–-]*\d+\s*$/, "").trim() || group.label} className="min-w-0 flex-1 text-[14px] font-medium" />
        <span className="flex-none text-[13px] text-ink-muted tabular-nums">{`×${group.tasks.length}`}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul {...REVEAL} className="m-0 overflow-hidden p-0 pl-4">
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} now={now} onTick={onTick} grouped />
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

export type SomedaySheetProps = {
  /** The ticking clock. */
  now: Date;
  /** Closes the sheet. */
  onClose: () => void;
  /** Opens a loose plan's card beside the chosen row. */
  onOpenPlan: (plan: Plan, element: Element) => void;
};

/**
 * Everything with no time on it, in a sheet of its own: the Someday tasks (repeats grouped under one row with their count,
 * each with its keeper and when it was last checked) and the plans that have a day but no end. Each section says when it
 * is empty. Ticking a task is optimistic with Undo, like the Checklist.
 */
export function SomedaySheet({ now, onClose, onOpenPlan }: SomedaySheetProps) {
  const tick = useTaskTick();
  const { tasks, plans, count } = useSomeday();
  const groups = groupSomeday(tasks);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="m-0 text-[20px] leading-7 font-semibold tracking-[-0.015em]">Someday</h2>
          <span className="text-[13px] text-ink-muted">{count === 0 ? "Nothing waiting for a time" : `${count} ${count === 1 ? "thing" : "things"} with no time yet`}</span>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>
      <div className="scroll flex min-h-0 flex-1 flex-col gap-5 px-4 pb-5">
        <Section label="Tasks" count={tasks.length}>
          {groups.length === 0 ? (
            <StateView dense kind="empty" title="No loose tasks" detail="Tasks with no open or close day appear here." />
          ) : (
            <ul className="m-0 flex flex-col gap-0.5 p-0">
              {groups.map((group) => (
                <Group key={group.key} group={group} now={now} onTick={tick} />
              ))}
            </ul>
          )}
        </Section>
        <Section label="Plans" count={plans.length}>
          {plans.length === 0 ? (
            <StateView dense kind="empty" title="No loose plans" detail="Plans with a day but no end time appear here." />
          ) : (
            <ul className="m-0 flex flex-col gap-0.5 p-0">
              {plans.map((plan) => (
                <li key={plan.id} className="flex list-none items-center gap-1">
                  <PlanButton plan={plan} aria-haspopup="dialog" onClick={(event) => onOpenPlan(plan, event.currentTarget)} className="ui-hover-fill ui-trans flex min-w-0 flex-1 items-center gap-3 rounded-[12px] px-3 py-2 text-left">
                    <span className="flex size-8 flex-none items-center justify-center rounded-full bg-sage-fill text-sage-text">
                      <Icon name="cal" size={15} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Truncate text={plan.title} className="text-[14px] font-medium" />
                      <Truncate text={`${formatDay(plan.start_at)} · ${formatClock(plan.start_at)}${keptBy(plan.owner) === null ? "" : ` · ${plan.owner}`}`} className="text-[12px] text-ink-muted" />
                    </span>
                  </PlanButton>
                  <MessageAgent task={plan} iconOnly />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
