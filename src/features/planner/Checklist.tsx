import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { isMeshOnline, planner } from "../../shared/api";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { EASE, FAST_S, REVEAL, SLOW_S, SLOWER_S } from "../../shared/motion";
import { failureProps } from "../../shared/lib/ux/moduleState";
import type { Task } from "../../types/planner";
import { dateKey, formatDayShort, isSameDay } from "./dates";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { Check } from "./Check";
import { useSomeday } from "./Someday";
import { useTaskActions } from "./taskActions";
import { dayTasksKey, groupTasks, progressOf } from "./tasks";
import { taskStatus } from "./timeState";
import { useTaskTick } from "./useTaskTick";

const LABEL: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: 2.5, lineHeight: "14px", textTransform: "uppercase" };

type RowProps = {
  task: Task;
  now: Date;
  onTick: (task: Task, done: boolean) => void;
  /** Opens the task's details beside the chosen control. */
  onOpen: (task: Task, element: Element) => void;
};

/** How a task's situation reads in its row, by tone. */
const HINT_INK = { done: "var(--ink-muted)", late: "var(--late-ink)", soon: "var(--ink)", open: "var(--ink-muted)", none: "var(--ink-muted)" } as const;

/**
 * One task of the day: its ring ticks it (or takes the tick back) and the rest of the row opens its details. Under the title the
 * row says its situation in words ("Past due by 5 days", "Closes today 5:00 PM · in 3 h") and its course.
 */
function Row({ task, now, onTick, onOpen }: RowProps) {
  const reduce = useReducedMotion() ?? false;
  const actionsFor = useTaskActions(onTick);
  const context = useContextActions(() => actionsFor(task));
  const status = taskStatus(task, now);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: reduce ? { duration: 0 } : { delay: SLOW_S, duration: SLOW_S, ease: EASE } }}
      transition={{ duration: SLOW_S, ease: EASE }}
      style={{ listStyle: "none", overflow: "hidden" }}
      {...context}
      className="flex items-start gap-1 rounded-[12px]"
    >
      <button type="button" role="checkbox" aria-checked={task.done} aria-label={`${task.done ? "Take back" : "Mark done:"} ${task.title}`} onClick={() => onTick(task, !task.done)} className="ui-hover-fill ui-trans flex flex-none rounded-[12px] p-2.5 pr-1.5 active:scale-90">
        <Check done={task.done} />
      </button>
      <button type="button" aria-haspopup="dialog" onClick={(event) => onOpen(task, event.currentTarget)} className="ui-hover-fill ui-trans flex min-w-0 flex-1 flex-col gap-1 rounded-[12px] py-2.5 pr-2 pl-1.5 text-left">
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: "19px", color: task.done ? "var(--ink-muted)" : "var(--ink)", textDecoration: task.done ? "line-through" : "none", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{task.title}</span>
        {task.done ? null : <span style={{ fontSize: 12, lineHeight: "16px", fontVariantNumeric: "tabular-nums", color: HINT_INK[status.tone], fontWeight: status.tone === "late" ? 600 : 400 }}>{status.label}</span>}
        {task.hub === null ? null : (
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 12, lineHeight: "16px", color: "var(--ink-muted)" }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--tide)", flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.hub.title}</span>
          </span>
        )}
      </button>
    </motion.li>
  );
}

type GroupProps = {
  label: string;
  count: number;
  tone?: "late";
  children: ReactNode;
};

/** A labelled group of rows. */
function Group({ label, count, tone, children }: GroupProps) {
  return (
    <section aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ ...LABEL, display: "flex", alignItems: "center", gap: 7, padding: "10px 8px 4px", color: tone === "late" ? "var(--late-ink)" : "var(--ink-muted)" }}>
        {tone === "late" ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--late)" }} /> : null}
        {label}
        <span style={{ fontWeight: 500, letterSpacing: 0.5 }}>{count}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
    </section>
  );
}

type FoldProps = {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A group that starts folded: its label and count open it. */
function Fold({ label, count, open, onToggle, children }: FoldProps) {
  return (
    <section aria-label={label}>
      <button type="button" aria-expanded={open} className="ui-hover-fill ui-trans" onClick={onToggle} style={{ ...LABEL, display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "10px 8px 6px", borderRadius: 10, color: "var(--ink-muted)", textAlign: "left" }}>
        <span style={{ display: "flex", transform: open ? "rotate(90deg)" : "none", transition: `transform ${FAST_S}s var(--ease)` }}>
          <Icon name="chevron" size={12} />
        </span>
        {label}
        <span style={{ fontWeight: 500, letterSpacing: 0.5 }}>{count}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul {...REVEAL} style={{ margin: 0, padding: 0, overflow: "hidden" }}>
            <AnimatePresence initial={false}>{children}</AnimatePresence>
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

type CompletionProps = {
  /** The list was already complete when it first showed: no moment to play. */
  settled: boolean;
};

/** The one small moment when the last task is ticked: a check that pops once with a ring that fades outward. */
function Completion({ settled }: CompletionProps) {
  const reduce = useReducedMotion() ?? false;
  const still = settled || reduce;
  return (
    <span aria-hidden style={{ position: "relative", width: 22, height: 22, flex: "none" }}>
      {still ? null : (
        <motion.span initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: SLOWER_S, ease: EASE }} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--sage)" }} />
      )}
      <motion.span
        initial={still ? false : { scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: SLOW_S, bounce: 0.45 }}
        style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--sage-deep)", color: "var(--bone)", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="check" size={13} />
      </motion.span>
    </span>
  );
}

export type ChecklistProps = {
  /** The local day whose tasks are listed. */
  day: Date;
  /** The ticking clock: close hints and Today read from it. */
  now: Date;
  /** Open the Someday sheet. */
  onSomeday: () => void;
  /** Opens a task's details beside the chosen control. */
  onOpenTask: (task: Task, element: Element) => void;
  /** A fixed height in px, for a Checklist under the timeline on a narrow page; it fills its column when absent. */
  height?: number;
};

/**
 * The Planner's Checklist for a day: Past due on top, then the day's open tasks, a folded Done and a folded
 * a "Someday" row that opens the sheet, under "n of m checked" and a progress bar. It scrolls on its own and ticks optimistically.
 */
export function Checklist({ day, now, onSomeday, onOpenTask, height }: ChecklistProps) {
  const { state: connection } = useConnection();
  const [doneOpen, setDoneOpen] = useState(false);
  const tick = useTaskTick();
  const online = isMeshOnline(connection);
  const dayQuery = useQuery({ queryKey: dayTasksKey(day), queryFn: async () => (await planner.tasks({ on: dateKey(day) })).items, enabled: online });
  const someday = useSomeday();
  const state = useModuleState(dayQuery, () => false);
  const groups = groupTasks(dayQuery.data ?? [], day);
  const { done, total } = progressOf(groups);
  const complete = total > 0 && done === total;
  const [settled] = useState(complete);
  const today = isSameDay(day, now);
  const openLabel = today ? "Today" : formatDayShort(day);

  let body: ReactNode;
  if (state.kind === "loading") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 4px" }}>
        {[70, 52, 64, 44].map((w, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton width={20} height={20} radius={10} />
            <Skeleton width={`${w}%`} height={12} />
          </div>
        ))}
      </div>
    );
  } else if (state.kind !== "ready") {
    body = (
      <StateView
        dense
        kind={state.kind}
        title={state.kind === "offline" ? "dadi is unreachable" : state.kind === "module-offline" ? "Yaad isn’t answering" : "Couldn’t load the checklist"}
        detail={state.kind === "offline" ? "Waiting for the mesh to reconnect" : state.kind === "module-offline" ? "Your other modules still work." : state.kind === "error" ? failureProps(state.error).detail : ""}
        {...(state.kind === "module-offline" || state.kind === "error" ? failureProps(state.error) : {})}
        onRetry={state.kind === "offline" || state.kind === "empty" ? undefined : () => void dayQuery.refetch()}
      />
    );
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8 }}>
        {total === 0 ? (
          <StateView dense kind="empty" title="Nothing to check off" detail="Tasks appear here as agents add them." />
        ) : null}
        {groups.pastDue.length === 0 ? null : (
          <Group label="Past due" count={groups.pastDue.length} tone="late">
            {groups.pastDue.map((task) => (
              <Row key={task.id} task={task} now={now} onTick={tick} onOpen={onOpenTask} />
            ))}
          </Group>
        )}
        {groups.open.length === 0 ? null : (
          <Group label={openLabel} count={groups.open.length}>
            {groups.open.map((task) => (
              <Row key={task.id} task={task} now={now} onTick={tick} onOpen={onOpenTask} />
            ))}
          </Group>
        )}
        {groups.done.length === 0 ? null : (
          <Fold label="Done" count={groups.done.length} open={doneOpen} onToggle={() => setDoneOpen(!doneOpen)}>
            {groups.done.map((task) => (
              <Row key={task.id} task={task} now={now} onTick={tick} onOpen={onOpenTask} />
            ))}
          </Fold>
        )}
      </div>
    );
  }

  return (
    <Card aria-label="Checklist" style={{ flex: height === undefined ? 1 : "none", height, minHeight: 0, minWidth: 0, padding: "14px 10px 0 14px", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "none", padding: "0 4px 4px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 24 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "var(--sage-text)" }}>Checklist</span>
          <div style={{ flex: 1 }} />
          {state.kind !== "ready" || total === 0 ? null : complete ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--sage-deep)" }}>
              <Completion settled={settled} />
              All done
            </span>
          ) : (
            <span style={{ fontSize: 14, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{`${done} of ${total} checked`}</span>
          )}
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={{ height: 6, borderRadius: 3, background: "color-mix(in srgb, var(--sage-deep) 14%, transparent)", overflow: "hidden" }}>
          <motion.span initial={false} animate={{ width: total === 0 ? "0%" : `${(done / total) * 100}%`, backgroundColor: complete ? "var(--sage-deep)" : "var(--sage)" }} transition={{ duration: SLOW_S, ease: EASE }} style={{ display: "block", height: "100%" }} />
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, paddingRight: 4 }}>
        {state.kind === "ready" && state.stale !== null ? (
          <div style={{ fontSize: 12, color: "var(--ink-muted)", padding: "0 8px 6px" }}>Showing the last answer from Yaad</div>
        ) : null}
        {body}
        {someday.count === 0 ? null : (
          <button type="button" className="ui-hover-fill ui-trans" onClick={onSomeday} style={{ ...LABEL, display: "flex", alignItems: "center", gap: 7, width: "100%", margin: "4px 0 14px", padding: "12px 8px", borderRadius: 12, color: "var(--ink-muted)", textAlign: "left", borderTop: "1px solid var(--rule)" }}>
            Someday
            <span style={{ fontWeight: 500, letterSpacing: 0.5 }}>{someday.count}</span>
            <span style={{ flex: 1 }} />
            <Icon name="chevron" size={12} />
          </button>
        )}
      </div>
    </Card>
  );
}
