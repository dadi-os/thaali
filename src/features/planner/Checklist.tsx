import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { isMeshOnline, planner } from "../../shared/api";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { EASE, FAST_S, REVEAL, SLOW_S, SLOWER_S } from "../../shared/motion";
import { failureProps } from "../../shared/lib/ux/moduleState";
import type { Task } from "../../types/planner";
import { formatAge } from "../../shared/lib/ux/time";
import { dateKey, formatDayShort, isSameDay } from "./dates";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { MessageAgent, useTaskActions } from "./taskActions";
import { closeHint, dayTasksKey, groupSomeday, groupTasks, isUrgent, type SomedayGroup, progressOf, SOMEDAY_KEY } from "./tasks";
import { useTaskTick } from "./useTaskTick";

const LABEL: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: 2.5, lineHeight: "14px", textTransform: "uppercase" };

type CheckProps = {
  done: boolean;
};

/** The round checkbox: an empty ring that fills sage and draws its check in one snap when the task is done. */
function Check({ done }: CheckProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1.5px solid ${done ? "var(--sage-deep)" : "var(--ink-faint)"}`,
        background: done ? "var(--sage-deep)" : "transparent",
        transition: reduce ? "none" : `background ${SLOW_S}s var(--ease), border-color ${SLOW_S}s var(--ease)`,
      }}
    >
      <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="var(--bone)" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={reduce ? { duration: 0 } : { duration: SLOW_S, ease: EASE }} />
      </svg>
    </span>
  );
}

type RowProps = {
  task: Task;
  now: Date;
  onTick: (task: Task, done: boolean) => void;
};

/** One task of the day: tap anywhere on it to tick it or take the tick back. */
function Row({ task, now, onTick }: RowProps) {
  const reduce = useReducedMotion() ?? false;
  const actionsFor = useTaskActions(onTick);
  const context = useContextActions(() => actionsFor(task));
  const hint = closeHint(task, now);
  const urgent = isUrgent(task, now);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: reduce ? { duration: 0 } : { delay: SLOW_S, duration: SLOW_S, ease: EASE } }}
      transition={{ duration: SLOW_S, ease: EASE }}
      style={{ listStyle: "none", overflow: "hidden" }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        {...context}
        className="ui-hover-fill ui-trans"
        onClick={() => onTick(task, !task.done)}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "9px 8px", borderRadius: 12, textAlign: "left" }}
      >
        <span style={{ marginTop: 1 }}>
          <Check done={task.done} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              lineHeight: "19px",
              color: task.done ? "var(--ink-muted)" : "var(--ink)",
              textDecoration: task.done ? "line-through" : "none",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {task.title}
          </span>
          {hint === null && task.hub === null ? null : (
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {hint === null ? null : (
                <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flex: "none", color: urgent ? "var(--late-ink)" : "var(--ink-muted)" }}>{hint}</span>
              )}
              {task.hub === null ? null : (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 999, background: "var(--tide-fill)", color: "var(--tide-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {task.hub.title}
                </span>
              )}
            </span>
          )}
        </span>
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

type SomedayRowProps = {
  task: Task;
  now: Date;
  onTick: (task: Task, done: boolean) => void;
  /** The row sits under a group header: its message button is the icon alone. */
  grouped?: boolean;
};

type SomedayGroupRowProps = {
  group: SomedayGroup;
  now: Date;
  onTick: (task: Task, done: boolean) => void;
};

/** A run of repeated Someday titles as one row with its count; it opens to the individual tasks. A lone task is its own row. */
function SomedayGroupRow({ group, now, onTick }: SomedayGroupRowProps) {
  const [open, setOpen] = useState(false);
  if (group.tasks.length === 1) {
    return <SomedayRow task={group.tasks[0]!} now={now} onTick={onTick} />;
  }
  return (
    <li style={{ listStyle: "none" }}>
      <button type="button" aria-expanded={open} className="ui-hover-fill ui-trans" onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px 7px 12px", borderRadius: 10, textAlign: "left" }}>
        <span style={{ display: "flex", transform: open ? "rotate(90deg)" : "none", transition: `transform ${FAST_S}s var(--ease)` }}>
          <Icon name="chevron" size={12} />
        </span>
        <Truncate text={group.label} style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{`×${group.tasks.length}`}</span>
      </button>
      {open ? (
        <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
          {group.tasks.map((task) => (
            <SomedayRow key={task.id} task={task} now={now} onTick={onTick} grouped />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** A task with no window: tickable, with who keeps it and a way to message them. */
function SomedayRow({ task, now, onTick, grouped = false }: SomedayRowProps) {
  return (
    <li style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
      <button type="button" role="checkbox" aria-checked={task.done} aria-label={task.title} onClick={() => onTick(task, !task.done)} style={{ display: "flex", padding: 4 }}>
        <Check done={task.done} />
      </button>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <Truncate text={task.title} style={{ fontSize: 14, fontWeight: 500 }} />
        <Truncate text={task.verified_at === null || now.getTime() - Date.parse(task.verified_at) < 86_400_000 ? task.owner : `${task.owner} · checked ${formatAge(task.verified_at, now.getTime())} ago`} style={{ fontSize: 12, color: "var(--ink-muted)" }} />
      </span>
      <MessageAgent task={task} iconOnly={grouped} />
    </li>
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
  /** Open the Someday section on arrival. */
  somedayOpen: boolean;
};

/**
 * The Planner's Checklist for a day: Past due on top, then the day's open tasks, a folded Done and a folded
 * Someday, under "n of m checked" and a progress bar. It scrolls on its own and ticks optimistically.
 */
export function Checklist({ day, now, somedayOpen }: ChecklistProps) {
  const { state: connection } = useConnection();
  const [doneOpen, setDoneOpen] = useState(false);
  const [somedayShown, setSomedayShown] = useState(somedayOpen);
  const tick = useTaskTick();
  const somedayRef = useRef<HTMLDivElement>(null);
  const somedayCount = (useQuery<Task[]>({ queryKey: SOMEDAY_KEY, enabled: false, queryFn: skipToken }).data ?? []).length;
  useEffect(() => {
    if (somedayOpen && somedayCount > 0) somedayRef.current?.scrollIntoView({ block: "start" });
  }, [somedayOpen, somedayCount]);
  const online = isMeshOnline(connection);
  const dayQuery = useQuery({ queryKey: dayTasksKey(day), queryFn: async () => (await planner.tasks({ on: dateKey(day) })).items, enabled: online });
  const somedayQuery = useQuery({ queryKey: SOMEDAY_KEY, queryFn: async () => (await planner.tasks({ someday: true })).items, enabled: online });
  const state = useModuleState(dayQuery, () => false);
  const groups = groupTasks(dayQuery.data ?? [], day);
  const { done, total } = progressOf(groups);
  const complete = total > 0 && done === total;
  const [settled] = useState(complete);
  const someday = (somedayQuery.data ?? []).filter((task) => !task.done);
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
              <Row key={task.id} task={task} now={now} onTick={tick} />
            ))}
          </Group>
        )}
        {groups.open.length === 0 ? null : (
          <Group label={openLabel} count={groups.open.length}>
            {groups.open.map((task) => (
              <Row key={task.id} task={task} now={now} onTick={tick} />
            ))}
          </Group>
        )}
        {groups.done.length === 0 ? null : (
          <Fold label="Done" count={groups.done.length} open={doneOpen} onToggle={() => setDoneOpen(!doneOpen)}>
            {groups.done.map((task) => (
              <Row key={task.id} task={task} now={now} onTick={tick} />
            ))}
          </Fold>
        )}
      </div>
    );
  }

  return (
    <Card aria-label="Checklist" style={{ flex: 1, minHeight: 0, minWidth: 0, padding: "14px 10px 0 14px", gap: 8 }}>
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
        {someday.length === 0 ? null : (
          <div ref={somedayRef} style={{ borderTop: "1px solid var(--rule)", marginTop: 4, paddingBottom: 14 }}>
            <Fold label="Someday" count={someday.length} open={somedayShown} onToggle={() => setSomedayShown(!somedayShown)}>
              {groupSomeday(someday).map((group) => (
                <SomedayGroupRow key={group.key} group={group} now={now} onTick={tick} />
              ))}
            </Fold>
          </div>
        )}
      </div>
    </Card>
  );
}
