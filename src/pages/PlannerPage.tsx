import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../shared/layout/shell/PageHeader";
import { addDays, dateKey, endOfMonth, isSameDay, parseDateKey, startOfDay, startOfMonth, weekDays } from "../features/planner/dates";
import { DayView } from "../features/planner/DayView";
import { MonthView } from "../features/planner/MonthView";
import { PlanDetailsContext } from "../features/planner/PlanButton";
import { dayBadge, dayTasksKey, monthBadge } from "../features/planner/tasks";
import { usePlanPopover } from "../features/planner/usePlanPopover";
import { WeekView } from "../features/planner/WeekView";
import { isMeshOnline, planner } from "../shared/api";
import { Button, IconButton } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { Page } from "../shared/layout/Page";
import { StaleBanner, StateView } from "../shared/states/ModuleState";
import { Truncate } from "../shared/ui/Truncate";
import { Segmented } from "../shared/ui/Segmented";
import { Skeleton } from "../shared/ui/Skeleton";
import { EASE, LEAVE_S, SLOW_S } from "../shared/motion";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { Plan, PlanViewName } from "../types/planner";

/** The main column is wider than this before the day view shows its side panel, in px. */
const WIDE_FROM = 860;

type View = "Day" | "Week" | "Month";

/** How far a page travels as it slides in or out, in px. */
const GLIDE_PX = 56;

/**
 * How the calendar changes pages: the new one slides in from the side time is coming from while the old one slides out
 * the way time went and fades (`direction` is 1 going later, -1 going earlier, 0 for a change of view, which only crossfades).
 */
const GLIDE = {
  enter: (direction: number) => ({ opacity: 0, x: direction * GLIDE_PX }),
  center: { opacity: 1, x: 0, transition: { duration: SLOW_S, ease: EASE } },
  exit: (direction: number) => ({ opacity: 0, x: -direction * GLIDE_PX, transition: { duration: LEAVE_S, ease: EASE } }),
} as const;
const OPTIONS = ["Day", "Week", "Month"] as const;

/** The visible month's Sunday-first grid, including adjacent dates that fill its weeks. */
function monthDays(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = addDays(first, -first.getDay());
  const last = endOfMonth(anchor);
  const end = addDays(startOfDay(last), 6 - last.getDay());
  const days: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1))
    days.push(cursor);
  return days;
}

/**
 * The Planner: Timeline plus Checklist. Day puts the plans on a time axis beside Now, Up next and the Checklist; Week is
 * seven days on one axis with task badges; Month is a tile per day. The URL keeps the view and date. Plans are read only
 * apart from Attended, tasks apart from ticking. Clock and device zone are read again when the app becomes visible after
 * sleep or travel, and times follow the device zone.
 */
export function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const [clock, setClock] = useState(() => ({ now: new Date(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  const { state: connection } = useConnection();
  const { now, zone } = clock;
  const popover = usePlanPopover();
  const requested = params.get("view");
  const view: View = requested === "week" ? "Week" : requested === "month" ? "Month" : "Day";
  const somedayOpen = params.get("someday") === "1";
  const date = params.get("date");
  const anchor = date === null ? startOfDay(now) : parseDateKey(date);
  const days = view === "Week" ? weekDays(anchor) : view === "Month" ? monthDays(anchor) : [anchor];
  const from = days[0]!.toISOString();
  const to = addDays(days[days.length - 1]!, 1).toISOString();
  const views: PlanViewName[] = view === "Month" ? ["month"] : ["planner", "month"];
  const online = isMeshOnline(connection);

  useEffect(() => {
    const refresh = () => setClock({ now: new Date(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const query = useQuery({
    queryKey: ["yaad", "planner", "plans", view, from, to, zone],
    queryFn: async () => {
      const results = await Promise.all(views.map((name) => planner.plans({ from, to, view: name })));
      return [...new Map(results.flatMap(({ items }) => items).map((plan) => [plan.id, plan])).values()];
    },
    enabled: online,
  });
  const state = useModuleState(query, () => false);
  const plans = state.kind === "ready" ? state.data : [];
  const taskDays = view === "Day" ? [] : days;
  const dayLists = useQueries({
    queries: taskDays.map((day) => ({ queryKey: dayTasksKey(day), queryFn: async () => (await planner.tasks({ on: dateKey(day) })).items, enabled: online })),
  });
  const badges = <Badge,>(make: (tasks: NonNullable<(typeof dayLists)[number]["data"]>, day: Date) => Badge) =>
    Object.fromEntries(taskDays.map((day, i) => [dateKey(day), dayLists[i]!.data === undefined ? undefined : make(dayLists[i]!.data!, day)])) as Record<string, Badge | undefined>;
  const navigate = (nextView: View, day: Date, someday = false) => {
    setParams(() => {
      const next = new URLSearchParams({ view: nextView.toLowerCase(), date: dateKey(day) });
      if (someday) next.set("someday", "1");
      return next;
    });
  };
  const move = (step: number) => navigate(view, view === "Day" ? addDays(anchor, step) : view === "Week" ? addDays(anchor, step * 7) : new Date(anchor.getFullYear(), anchor.getMonth() + step, 1));
  const open = (plan: Plan, element: Element) => popover.show(plan, element.getBoundingClientRect());
  const fmt = (options: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat(undefined, options).format(d);
  const title = view === "Day" ? fmt({ weekday: "long", month: "long", day: "numeric" }, anchor) : view === "Week" ? `${fmt({ month: "short", day: "numeric" }, days[0]!)} – ${fmt({ month: "short", day: "numeric" }, days[6]!)}` : fmt({ month: "long", year: "numeric" }, anchor);
  const own = view === "Day" ? plans.filter((plan) => isSameDay(new Date(plan.start_at), anchor)) : plans;
  const when = view === "Day" ? (isSameDay(anchor, now) ? "today" : "that day") : view === "Week" ? "this week" : "this month";
  const shownAt = useRef({ view, time: anchor.getTime() });
  const direction = shownAt.current.view !== view ? 0 : Math.sign(anchor.getTime() - shownAt.current.time);
  useEffect(() => {
    shownAt.current = { view, time: anchor.getTime() };
  });
  const failed = state.kind !== "ready" && state.kind !== "loading";
  const notice =
    state.kind === "loading" || state.kind === "ready" ? null : (
      <StateView
        kind={state.kind}
        title={state.kind === "module-offline" ? "Yaad isn’t answering" : state.kind === "offline" ? "dadi is unreachable" : "Couldn’t load the planner"}
        detail={state.kind === "offline" ? "Waiting for the mesh to reconnect" : state.kind === "module-offline" ? "The planner comes from Yaad. Your other modules still work." : state.kind === "error" ? failureProps(state.error).detail : ""}
        {...(state.kind === "module-offline" || state.kind === "error" ? failureProps(state.error) : {})}
        onRetry={state.kind === "offline" || state.kind === "empty" ? undefined : () => void query.refetch()}
      />
    );
  const renderBody = (wide: boolean): ReactNode => {
    if (state.kind === "loading")
      return (
        <div style={{ display: "flex", flex: 1, gap: 16, minWidth: 0, minHeight: 0, alignItems: "stretch" }}>
          <Card style={{ flex: 1, padding: 18, gap: 0 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", height: 56, borderTop: "1px solid var(--rule)", gap: 12 }}>
                <Skeleton width={40} height={10} />
                {i % 3 === 1 ? <Skeleton width="60%" height={38} radius={12} /> : null}
              </div>
            ))}
          </Card>
          {wide && view === "Day" ? (
            <div style={{ display: "flex", flexDirection: "column", width: 320, gap: 12 }}>
              <Skeleton width="100%" height={120} radius={18} />
              <Skeleton width="100%" height={240} radius={18} />
            </div>
          ) : null}
        </div>
      );
    if (view === "Day")
      return <DayView day={anchor} now={now} zone={zone} plans={plans} selected={popover.openKey} wide={wide} somedayOpen={somedayOpen} unavailable={failed ? notice : null} onOpen={open} />;
    if (failed) return <Card style={{ flex: 1, minHeight: 0 }}>{notice}</Card>;
    if (view === "Week") return <WeekView days={days} now={now} zone={zone} plans={plans} badges={badges((tasks, day) => dayBadge(tasks, day, now))} selected={popover.openKey} onOpen={open} onDay={(day) => navigate("Day", day)} />;
    return <MonthView days={days} now={now} anchor={anchor} plans={plans} badges={badges((tasks, day) => monthBadge(tasks, day))} onOpen={open} onDay={(day) => navigate("Day", day)} />;
  };
  return (
    <PlanDetailsContext.Provider value={popover.show}>
      <Page name="planner">
        {(room) => (
          <>
            <PageHeader
              title="Planner"
              meta={state.kind === "ready" ? `${own.length} ${own.length === 1 ? "plan" : "plans"} ${when}` : undefined}
              trailing={
                <Button tone="quiet" size="sm" onClick={() => navigate("Day", anchor, true)}>
                  Someday
                </Button>
              }
            />
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none", flexWrap: "nowrap" }}>
              <Truncate text={title} style={{ flex: "0 1 auto", minWidth: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }} />
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconButton icon="back" label="Previous" onClick={() => move(-1)} />
                <Button pill onClick={() => navigate(view, startOfDay(now))} style={{ fontWeight: 600 }}>
                  Today
                </Button>
                <IconButton icon="chevron" label="Next" onClick={() => move(1)} />
              </div>
              <Segmented options={OPTIONS} value={view} onChange={(next) => navigate(next, anchor)} />
            </div>
            {state.kind === "ready" && state.stale !== null ? <StaleBanner text={`Showing what Yaad reported ${formatRelative(new Date(state.stale.since).toISOString(), now.getTime())}`} onRetry={() => void query.refetch()} /> : null}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                <motion.div key={`${view}:${dateKey(anchor)}`} custom={direction} variants={GLIDE} initial="enter" animate="center" exit="exit" className="flex min-h-0 flex-1 flex-col">
                  {renderBody(room.width > WIDE_FROM)}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </Page>
      {popover.popovers}
    </PlanDetailsContext.Provider>
  );
}
