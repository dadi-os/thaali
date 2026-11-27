import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { skipToken, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { addOptimistic, removeMessage, resolveOptimistic } from "../../contexts/chat";
import { pushToast } from "../../contexts/toasts";
import { hath, isMeshOnline, planner } from "../../shared/api";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { useConnection } from "../../shared/hooks/useConnection";
import { PreviewModal } from "../../shared/overlay/PreviewModal";
import { SPRING } from "../../shared/motion";
import { StateView } from "../../shared/states/ModuleState";
import { failureProps } from "../../shared/lib/ux/moduleState";
import { formatAge, formatClock, formatDay } from "../../shared/lib/ux/time";
import { useContextActions } from "../../shared/interaction/contextMenu";
import type { ActionList } from "../../shared/interaction/actions";
import { CheckCircle } from "../../shared/ui/CheckCircle";
import { Expandable } from "../../shared/ui/Expandable";
import { FIELD_INPUT, Field } from "../../shared/ui/Field";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import type { AgentRecord } from "../../types/hath";
import type { Plan, Task } from "../../types/planner";
import { PLANS_KEY } from "./attended";
import { addDays, dateKey, parseDateKey, startOfDay } from "./dates";
import { keptBy, loosePlans, ownerAgent } from "./plans";
import { SomedayCard } from "./SomedayCard";
import { matchesQuery, neighbor, somedayDays, type Box, type Direction } from "./somedayBoard";
import { createAskGuard, dayLabel, scheduleMessage, sendScheduleAsk } from "./somedayAsk";
import { SomedayDock } from "./SomedayDock";
import { useSomedayDrag } from "./somedayDrag";
import { MessageAgent, useTaskActions } from "./taskActions";
import { dayTasksKey, groupByTitle, isSomeday, SOMEDAY_KEY } from "./tasks";
import { useTaskTick } from "./useTaskTick";

/** How far ahead the modal looks for plans that have a day but no end, in days. */
const LOOK_AHEAD_DAYS = 90;

/** What the Someday modal holds: tasks with no window, and plans that have a day but no end, and how the reads are going. */
export type SomedayData = { tasks: Task[]; plans: Plan[]; count: number; online: boolean; loading: boolean; failure: unknown; retry: () => void };

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
  const withOpening = useQuery({ queryKey: dayTasksKey(today), queryFn: async () => (await planner.tasks({ on: dateKey(today) })).items, enabled: online });
  const seen = new Set<string>();
  const open = [...(tasks.data ?? []), ...(withOpening.data ?? []).filter(isSomeday)].filter((task) => {
    if (task.done || seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
  const loose = plans.data ?? [];
  const failure = tasks.error ?? plans.error ?? withOpening.error;
  return {
    tasks: open,
    plans: loose,
    count: open.length + loose.length,
    online,
    loading: online && (tasks.isPending || plans.isPending),
    failure,
    retry: () => void Promise.all([tasks.refetch(), plans.refetch(), withOpening.refetch()]),
  };
}


/** The grid every run of cards sits in. */
const GRID = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))" } as const;

/** How long a ticked card stays on the board, struck through, before it collapses away, in ms. */
const LINGER_MS = 700;

const ARROWS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

/** A task's quiet lines: who keeps it, and when it was last checked once that is more than a day ago. */
function taskMeta(task: Task, now: Date): string[] {
  const fresh = task.verified_at === null || now.getTime() - Date.parse(task.verified_at) < 86_400_000;
  return [keptBy(task.owner), fresh ? null : `Checked ${formatAge(task.verified_at!, now.getTime())} ago`].filter((part) => part !== null);
}

type ItemProps = {
  now: Date;
  armed: boolean;
  lifted: boolean;
  /** What the task is waiting on, "Asked health-specialist" over "to schedule · Fri, Nov 27", or null. */
  asked: string[] | null;
  actions: (task: Task) => ActionList;
  onTick: (task: Task, done: boolean) => void;
  onOpen: (task: Task, element: Element) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, task: Task) => void;
  drag: ReturnType<typeof useSomedayDrag>;
  task: Task;
};

/** A Someday task as a card: ring, title, keeper; draggable onto the day strip, with the task's menu on right click. */
function TaskItem({ task, now, armed, lifted, asked, actions, onTick, onOpen, onKeyDown, drag }: ItemProps) {
  const context = useContextActions(() => actions(task));
  return (
    <SomedayCard
      title={task.title}
      meta={taskMeta(task, now)}
      asked={asked}
      done={task.done}
      armed={armed}
      lifted={lifted}
      lead={<CheckCircle done={task.done} label={`Mark done: ${task.title}`} onToggle={() => onTick(task, !task.done)} />}
      trail={<MessageAgent task={task} iconOnly />}
      onOpen={(element) => onOpen(task, element)}
      onKeyDown={(event) => onKeyDown(event, task)}
      onPointerDown={(event) => drag.onPointerDown(event, task.id, task.title)}
      wasDragged={drag.wasDragged}
      rest={context}
    />
  );
}

/** A loose plan as a card: its day and time, its keeper; it opens the plan's card. */
function PlanItem({ plan, onOpenPlan, onKeyDown }: { plan: Plan; onOpenPlan: (plan: Plan, element: Element) => void; onKeyDown: (event: KeyboardEvent<HTMLElement>) => void }) {
  const keeper = keptBy(plan.owner);
  return (
    <SomedayCard
      title={plan.title}
      meta={[`${formatDay(plan.start_at)} · ${formatClock(plan.start_at)}`, ...(keeper === null ? [] : [keeper])]}
      lead={
        <span className="m-0.5 ml-2 flex size-8 flex-none items-center justify-center rounded-full bg-sage-fill text-sage-text">
          <Icon name="cal" size={15} />
        </span>
      }
      trail={<MessageAgent task={plan} iconOnly />}
      onOpen={(element) => onOpenPlan(plan, element)}
      onKeyDown={onKeyDown}
    />
  );
}

type RunProps<T> = {
  label: string;
  items: T[];
  /** Items that share a title fold into one row that opens to their cards. */
  render: (item: T) => ReactNode;
  expanded: Set<string>;
  onToggle: (key: string) => void;
};

/** One section of the board: its label and count, repeated titles as folding rows, then the rest as a grid of cards. */
function Run<T extends { id: string; title: string }>({ label, items, render, expanded, onToggle }: RunProps<T>) {
  const groups = groupByTitle(items);
  const repeats = groups.filter((group) => group.items.length > 1);
  const singles = groups.filter((group) => group.items.length === 1).map((group) => group.items[0]!);
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-1">
        <span className="ui-label">{label}</span>
        <span className="text-[12px] text-ink-muted tabular-nums">{items.length}</span>
      </div>
      <div style={GRID}>
        <AnimatePresence initial={false} mode="popLayout">
          {singles.map(render)}
        </AnimatePresence>
      </div>
      {repeats.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          {repeats.map((group) => (
            <Expandable key={group.key} look="folder" title={group.label} trailing={group.items.length} open={expanded.has(`${label}:${group.key}`)} onToggle={() => onToggle(`${label}:${group.key}`)}>
              <div className="py-2 pr-1 pl-2" style={GRID}>
                <AnimatePresence initial={false} mode="popLayout">
                  {group.items.map(render)}
                </AnimatePresence>
              </div>
            </Expandable>
          ))}
        </div>
      )}
    </section>
  );
}

/** The card under the pointer while a task is dragged. */
function Ghost({ title, x, y, blocked }: { title: string; x: number; y: number; blocked: boolean }) {
  return createPortal(
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1.04, opacity: blocked ? 0.6 : 1, rotate: -2 }}
      transition={SPRING}
      className="pointer-events-none fixed flex max-w-[240px] items-center gap-2 rounded-[16px] border px-4 py-3"
      style={{ left: x, top: y, translate: "-50% -130%", zIndex: "var(--z-popover)", background: "var(--glass-solid)", borderColor: "var(--glass-border)", boxShadow: "var(--shadow-deep)" }}
    >
      <Truncate text={title} className="text-[14px] font-medium" />
    </motion.div>,
    document.body,
  );
}

export type SomedayModalProps = {
  /** Whether the modal is showing. */
  open: boolean;
  /** The ticking clock. */
  now: Date;
  /** Closes the modal. */
  onClose: () => void;
  /** Opens a loose plan's card beside the chosen card. */
  onOpenPlan: (plan: Plan, element: Element) => void;
  /** Opens a task's card beside the chosen card. */
  onOpenTask: (task: Task, element: Element) => void;
};

/** The modal's panel: wide enough for three cards across, as tall as the window allows. */
const PANEL = "h-[min(820px,calc(100%-96px))] w-[min(960px,calc(100%-48px))]";

/**
 * Everything with no time on it, in a {@link PreviewModal} of its own: a board of floating cards, the Someday tasks (repeats folded under one row
 * with their count) and the plans that have a day but no end, over a strip of the next seven days. The only way to give a task a day is to ask the agent
 * that keeps it, so a card dragged onto a tile (or armed with S or "Schedule", then a tile, 1 to 7 or a date) sends that agent `Please schedule "…" for Fri, Nov 27.` as Ankur
 * and waits, showing "Asked … to schedule", until the task gains a close date and leaves; a failed send puts the card back with Retry, and one drop sends once. A task nobody keeps cannot take a day. Ticking is optimistic with Undo, the card staying struck for a moment before it collapses. Arrow keys move
 * between cards, Space ticks, Enter opens; the search narrows tasks and plans by title and keeper.
 */
export function SomedayModal({ open, now, onClose, onOpenPlan, onOpenTask }: SomedayModalProps) {
  const tick = useTaskTick();
  const { tasks, plans, count, online, loading, failure, retry } = useSomeday();
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, queryFn: skipToken });
  const taskActions = useTaskActions(tick);
  const [query, setQuery] = useState("");
  const [armedId, setArmedId] = useState<string | null>(null);
  const [lingering, setLingering] = useState<Map<string, Task>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [asks, setAsks] = useState<Map<string, string[]>>(new Map());
  const guard = useMemo(() => createAskGuard(), []);
  const board = useRef<HTMLDivElement>(null);
  const days = somedayDays(now);
  const shownTasks = [...tasks, ...[...lingering.values()].filter((held) => !tasks.some((task) => task.id === held.id))].filter((task) => matchesQuery(task, query));
  const shownPlans = plans.filter((plan) => matchesQuery(plan, query));
  const byId = (id: string) => shownTasks.find((task) => task.id === id) ?? null;
  const canDrop = (id: string) => {
    const task = byId(id);
    return task !== null && ownerAgent(task.owner, agents.data) !== null;
  };

  const tickCard = (task: Task, done: boolean) => {
    tick(task, done);
    setLingering((held) => {
      const next = new Map(held);
      if (done) next.set(task.id, { ...task, done: true });
      else next.delete(task.id);
      return next;
    });
    if (done) {
      window.setTimeout(
        () =>
          setLingering((held) => {
            const next = new Map(held);
            next.delete(task.id);
            return next;
          }),
        LINGER_MS,
      );
    }
  };

  const askedText = (id: string) => (guard.pendingDay(id, now.getTime()) === null ? null : (asks.get(id) ?? null));

  const ask = async (task: Task, agent: AgentRecord, day: Date) => {
    const dayKey = dateKey(day);
    if (!guard.begin(task.id, dayKey, Date.now())) return;
    const label = dayLabel(day);
    setAsks((held) => new Map(held).set(task.id, [`Asked ${agent.name}`, `to schedule · ${label}`]));
    const temp = addOptimistic(agent.id, scheduleMessage(task.title, day));
    try {
      const { stored } = await sendScheduleAsk(hath, agent.id, task.title, day);
      resolveOptimistic(agent.id, temp, stored.seq, stored.created_at);
      pushToast({ key: `planner:ask:${task.id}`, tone: "ok", title: `Sent to ${agent.name}`, body: `${task.title} · ${label}`, target: { kind: "chat", agentId: agent.id } });
    } catch (error) {
      removeMessage(agent.id, temp);
      guard.release(task.id, dayKey);
      setAsks((held) => {
        const next = new Map(held);
        next.delete(task.id);
        return next;
      });
      pushToast({
        key: `planner:ask-failed:${task.id}`,
        tone: "error",
        title: `Couldn’t send to ${agent.name}`,
        body: error instanceof Error ? error.message : String(error),
        action: { label: "Retry", run: () => void ask(task, agent, day) },
      });
    }
  };

  const schedule = (id: string, day: Date) => {
    const task = byId(id);
    const agent = task === null ? null : ownerAgent(task.owner, agents.data);
    setArmedId(null);
    if (task === null) return;
    if (agent === null) {
      pushToast({ key: "planner:schedule-nobody", tone: "info", title: "No agent keeps this task", body: task.title });
      return;
    }
    void ask(task, agent, day);
  };

  const drag = useSomedayDrag({ canDrop, onDrop: (id, day) => schedule(id, parseDateKey(day)) });

  const actions = (task: Task): ActionList => {
    const base = taskActions(task);
    return [...base, { id: "schedule", label: "Schedule…", detail: "Give it a close date", icon: "cal", shortcut: "s", disabledReason: canDrop(task.id) ? undefined : "No agent keeps this task", run: () => setArmedId(task.id) }];
  };

  const cards = () => [...(board.current?.querySelectorAll<HTMLElement>("[data-card]") ?? [])];
  const move = (from: HTMLElement, direction: Direction): HTMLElement | null => {
    const all = cards();
    const boxes: Box[] = all.map((el) => el.getBoundingClientRect());
    const to = neighbor(boxes, all.indexOf(from), direction);
    return to === null ? null : all[to]!;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, task: Task | null) => {
    const card = event.currentTarget;
    if (event.target !== card) return;
    const direction = ARROWS[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      move(card, direction)?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      card.click();
    } else if (/^[1-7]$/.test(event.key) && armedId !== null) {
      event.preventDefault();
      schedule(armedId, days[Number(event.key) - 1]!);
    } else if (task !== null && event.key === " ") {
      event.preventDefault();
      (move(card, "right") ?? move(card, "left") ?? move(card, "down") ?? move(card, "up"))?.focus();
      tickCard(task, true);
    } else if (task !== null && event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      setArmedId(armedId === task.id ? null : task.id);
    }
  };

  const armed = armedId === null ? null : byId(armedId);
  const ghostBlocked = drag.ghost !== null && !canDrop(drag.ghost.id);
  const hint =
    drag.ghost !== null
      ? ghostBlocked
        ? "No agent keeps this task, so it can’t be given a day"
        : "Release on a day to ask its agent to schedule it"
      : armed !== null
        ? `Pick a day for “${armed.title}”, press 1 to 7, or choose a date`
        : "Drag a task onto a day, or press S on one, to ask its agent to schedule it";

  const body = (): ReactNode => {
    if (loading) {
      return (
        <div style={GRID}>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} width="100%" height={124} radius={18} />
          ))}
        </div>
      );
    }
    if (failure !== null && failure !== undefined) return <StateView kind="error" title="Couldn’t load Someday" {...failureProps(failure)} onRetry={retry} />;
    if (!online && count === 0) return <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />;
    if (count === 0) return <StateView dense kind="empty" title="Nothing is waiting for a day" detail="Tasks with no close date, and plans with a day but no end time, appear here." />;
    if (shownTasks.length === 0 && shownPlans.length === 0) return <StateView dense kind="empty" title="No match" detail={`Nothing in Someday matches “${query}”.`} />;
    const toggle = (key: string) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (!next.delete(key)) next.add(key);
        return next;
      });
    return (
      <>
        {shownTasks.length === 0 ? null : (
          <Run
            label="Tasks"
            items={shownTasks}
            expanded={expanded}
            onToggle={toggle}
            render={(task) => (
              <TaskItem key={task.id} task={task} now={now} armed={armedId === task.id} lifted={drag.ghost?.id === task.id} asked={askedText(task.id)} actions={actions} onTick={tickCard} onOpen={onOpenTask} onKeyDown={onKeyDown} drag={drag} />
            )}
          />
        )}
        {shownPlans.length === 0 ? null : <Run label="Plans" items={shownPlans} expanded={expanded} onToggle={toggle} render={(plan) => <PlanItem key={plan.id} plan={plan} onOpenPlan={onOpenPlan} onKeyDown={(event) => onKeyDown(event, null)} />} />}
      </>
    );
  };

  return (
    <PreviewModal
      open={open}
      onClose={onClose}
      label="Someday"
      panelClassName={PANEL}
      title={<span className="text-[17px] leading-6 font-semibold tracking-[-0.015em] text-ink">Someday</span>}
      subtitle={count === 0 ? "Nothing waiting for a time" : `${count} ${count === 1 ? "thing" : "things"} with no time yet`}
      actions={
        <div className="w-56">
          <Field extra={<Icon name="search" size={15} />}>
            <input className={FIELD_INPUT} aria-label="Search Someday" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </Field>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={board} className="scroll flex min-h-0 flex-1 flex-col gap-6 p-5">
          {body()}
        </div>
        {loading || (failure !== null && failure !== undefined) || count === 0 ? null : (
          <SomedayDock days={days} now={now} hot={drag.ghost?.over ?? null} hint={hint} picking={armed !== null} onPick={(day) => (armed === null ? undefined : schedule(armed.id, day))} minDate={days[0]!} />
        )}
      </div>
      {drag.ghost === null ? null : <Ghost title={drag.ghost.title} x={drag.ghost.x} y={drag.ghost.y} blocked={ghostBlocked} />}
    </PreviewModal>
  );
}
