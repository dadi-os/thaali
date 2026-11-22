import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, planner } from "../../shared/api";
import { StateView } from "../../shared/states/ModuleState";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { formatClock } from "../../shared/lib/ux/time";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { usePlanActions } from "./planActions";
import { addDays, dateKey, startOfDay } from "./dates";
import { formatSpan } from "./layout";
import { dayTasksKey, groupTasks, progressOf } from "./tasks";
import { nextPlanId, planStatus, timeState, type TimeState } from "./timeState";
import { dayRecap, ROW, tilePlans, windowRows, type WidgetRow } from "./widget";

/** How often the widget moves its progress and its window. */
const TICK_MS = 60_000;
/** Height of the tasks footer and the gap above it, in px. */
const FOOTER = 44;
/** Width of the time column, and where the spine's dots sit from the row's start. */
const TIME_COL = 68;
const PAD_X = 8;
const SPINE_X = PAD_X + TIME_COL + 12 + 5;
const ROW_TOP = 8;
const LINE = 20;

function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

type PlanRowProps = {
  row: Extract<WidgetRow, { kind: "plan" }>;
  now: Date;
  /** Where the plan stands against the clock. */
  state: TimeState;
  /** The tile is wide enough for a fact on the right of each row. */
  wide: boolean;
  /** The spine starts and ends at the first and last dot. */
  first: boolean;
  last: boolean;
};

/** One plan down the spine (right-click or the menu key opens the plan's actions, as on a block in Day): its times, a dot (pulsing while it is on), its title, and what is left of it or how long until it. */
export function PlanRow({ row, now, state, wide, first, last }: PlanRowProps) {
  const { plan } = row;
  const actionsFor = usePlanActions();
  const context = useContextActions(() => actionsFor(plan));
  const current = state === "now";
  const declined = plan.rsvp === "no";
  const from = Date.parse(plan.start_at);
  const to = Date.parse(plan.end_at!);
  const over = state === "past";
  const detail = declined ? "Declined" : planStatus(plan, now, state);
  const fact = [formatSpan((to - from) / 60_000), plan.place === null ? null : `${plan.place.title}${plan.place.room === null ? "" : ` room ${plan.place.room}`}`].filter((part): part is string => part !== null).join(" · ");
  return (
    <div data-plan={plan.id} tabIndex={0} {...context} className={`relative flex flex-none items-start gap-3 rounded-[12px] px-2 ${current ? "bg-sage-active" : ""} ${over || declined ? "opacity-55" : ""}`} style={{ height: current ? ROW.current : ROW.plan, paddingTop: ROW_TOP }}>
      <span aria-hidden="true" className="absolute w-px bg-sage-line" style={{ left: SPINE_X, top: first ? ROW_TOP + LINE / 2 : 0, bottom: last ? undefined : 0, height: last ? ROW_TOP + LINE / 2 : undefined }} />
      <span className="flex flex-none flex-col items-end text-right" style={{ width: TIME_COL }}>
        <span className={`text-[13px] leading-5 tabular-nums ${current ? "font-semibold" : ""}`}>{formatClock(plan.start_at)}</span>
        <span className="text-[12px] leading-4 text-ink-muted tabular-nums">{formatClock(plan.end_at!)}</span>
      </span>
      <span className="relative flex size-2.5 flex-none items-center justify-center" style={{ marginTop: (LINE - 10) / 2 }}>
        <span className={`dot size-2.5 ${current ? "bg-sage-deep" : over ? "bg-sage-line" : declined ? "border-2 border-ink-ghost bg-bone" : "border-2 bg-bone"}`} style={!current && !over && !declined ? { borderColor: plan.hub === null ? "var(--sage-line)" : "var(--tide)" } : undefined} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 pr-1">
        <Truncate text={plan.title} className={`text-[14px] leading-5 ${current ? "font-semibold" : "font-medium"}`} />
        <span className={`truncate text-[13px] leading-4 ${current ? "text-sage-text" : "text-ink-muted"}`}>{detail}</span>
      </span>
      {wide ? <Truncate text={fact} className="max-w-[46%] flex-none pt-0.5 text-right text-[13px] leading-5 text-ink-muted" /> : null}
      {current ? (
        <span aria-hidden="true" className="absolute overflow-hidden rounded-full" style={{ left: PAD_X + TIME_COL + 12 + 10 + 12, right: PAD_X + 4, bottom: 9, height: 4, background: "color-mix(in srgb, var(--sage-deep) 16%, transparent)" }}>
          <span className="block h-full rounded-full bg-sage-deep transition-[width] duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, ((now.getTime() - from) / (to - from)) * 100))}%` }} />
        </span>
      ) : null}
    </div>
  );
}

type BodyProps = {
  plans: ReturnType<typeof tilePlans>;
  taskLine: { done: number; total: number } | null;
  now: Date;
  geometry: TileGeometry;
};

/** Today's plans as the window the tile can hold, with the tasks footer. */
function Body({ plans, taskLine, now, geometry }: BodyProps) {
  const over = plans.length > 0 && plans.every((plan) => Date.parse(plan.end_at!) <= now.getTime());
  const footer = taskLine !== null && taskLine.total > 0;
  const { rows, earlier, later } = windowRows(plans, now, Math.max(ROW.plan, geometry.bh - (footer || over ? FOOTER : 0)));
  const planRows = rows.flatMap((row, index) => (row.kind === "plan" ? [index] : []));
  const nextId = nextPlanId(plans, now);
  const complete = taskLine !== null && taskLine.total > 0 && taskLine.done === taskLine.total;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ gap: ROW.gap }}>
        {plans.length === 0 ? <StateView dense={geometry.bh < 220} kind="empty" title="No plans today" detail="Plans appear here as agents schedule them." /> : null}
        {earlier > 0 ? (
          <span className="flex flex-none items-center" style={{ height: ROW.chip, paddingLeft: PAD_X + TIME_COL + 12 + 10 + 12 }}>
            <span className="text-[12px] text-ink-muted tabular-nums">{`↑ ${earlier} earlier`}</span>
          </span>
        ) : null}
        {rows.map((row, i) =>
          row.kind === "free" ? (
            <span key={`free-${i}`} className="relative flex flex-none items-center text-[12px] text-ink-ghost" style={{ height: ROW.free, paddingLeft: PAD_X + TIME_COL + 12 + 10 + 12 }}>
              <span aria-hidden="true" className="absolute w-px bg-sage-line" style={{ left: SPINE_X, top: 0, bottom: 0 }} />
              {`Free · ${formatSpan(row.minutes)}`}
            </span>
          ) : (
            <PlanRow key={row.plan.id} row={row} now={now} state={timeState(row.plan, now, nextId)} wide={geometry.iw >= 420} first={i === planRows[0]} last={i === planRows[planRows.length - 1]} />
          ),
        )}
        {later > 0 ? (
          <span className="flex flex-none items-center" style={{ height: ROW.chip, paddingLeft: PAD_X + TIME_COL + 12 + 10 + 12 }}>
            <span className="text-[12px] text-ink-muted tabular-nums">{`↓ ${later} later`}</span>
          </span>
        ) : null}
      </div>
      {footer || over ? (
        <div className="flex flex-none flex-col justify-end gap-1.5" style={{ height: FOOTER - 8 }}>
          <span className="truncate text-[13px] text-ink-muted tabular-nums">{[over ? dayRecap(plans) : "", !footer ? "" : complete ? "All tasks done" : `${taskLine!.done} of ${taskLine!.total} tasks`].filter((part) => part !== "").join(" · ")}</span>
          {footer ? (
            <span className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--sage-deep) 14%, transparent)" }}>
              <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(taskLine!.done / taskLine!.total) * 100}%`, background: complete ? "var(--sage-deep)" : "var(--sage)" }} />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Home's Planner widget: today's timed plans down a spine, with what is on now picked out. All of them when they fit;
 * otherwise a window that follows the day, centred on the plan on now, with "N earlier" and "N later" chips, never a
 * scrollbar. The gap to the next plan reads "Free · 40 min", and a footer counts today's tasks ticked. The tile opens the
 * Planner's Day view.
 */
export function PlannerWidget({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const now = useNow(TICK_MS);
  const today = startOfDay(now);
  const online = isMeshOnline(connection);
  const query = useQuery({
    queryKey: ["yaad", "planner", "plans", "tile", dateKey(today)],
    queryFn: async () => (await planner.plans({ from: today.toISOString(), to: addDays(today, 1).toISOString() })).items,
    enabled: online,
  });
  const tasks = useQuery({ queryKey: dayTasksKey(today), queryFn: async () => (await planner.tasks({ on: dateKey(today) })).items, enabled: online });
  const state = useModuleState(query, () => false);
  const plans = state.kind === "ready" ? tilePlans(state.data, today) : [];
  const taskLine = tasks.data === undefined ? null : progressOf(groupTasks(tasks.data, today));
  return (
    <Tile
      area="planner"
      title="Planner"
      to="/planner?view=day"
      order={order}
      summary={state.kind === "ready" ? `${plans.length} ${plans.length === 1 ? "plan" : "plans"} today` : undefined}
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Yaad", request: "POST /timeline", empty: ["No plans today", "Plans appear here as agents schedule them."] }, () => void query.refetch())}
      skeleton={(g) => (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {Array.from({ length: Math.max(2, Math.min(5, Math.floor(g.bh / ROW.plan))) }, (_, i) => (
            <div key={i} className="flex items-start gap-3 px-2" style={{ height: ROW.plan, paddingTop: ROW_TOP }}>
              <div className="flex flex-col items-end gap-1" style={{ width: TIME_COL }}>
                <Skeleton width={52} height={14} />
                <Skeleton width={44} height={12} />
              </div>
              <Skeleton width={10} height={10} radius={5} />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton width={`${70 - (i % 3) * 14}%`} height={16} />
                <Skeleton width="30%" height={12} />
              </div>
            </div>
          ))}
        </div>
      )}
    >
      {(g) => <Body plans={plans} taskLine={taskLine} now={now} geometry={g} />}
    </Tile>
  );
}
