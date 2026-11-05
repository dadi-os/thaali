import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../shared/layout/shell/PageHeader";
import { CalendarDay } from "../features/timeline/CalendarDay";
import {
  CalendarMonth,
  CalendarWeek,
} from "../features/timeline/CalendarViews";
import {
  addDays,
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
  weekDays,
} from "../features/timeline/dates";
import { NodePopover } from "../features/timeline/NodePopover";
import { PlanDetailsContext } from "../features/timeline/PlanButton";
import { itemKey, plansOn } from "../features/timeline/plans";
import { SessionMenu } from "../features/timeline/SessionMenu";
import { NeedsATime } from "../features/timeline/Someday";
import { isSettled } from "../features/timeline/planner/blocks";
import { SessionCard } from "../features/timeline/planner/SessionCard";
import { clockChange, zoneOffset } from "../features/timeline/zones";
import { isMeshOnline, timeline } from "../shared/api";
import { Button, IconButton } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { Chip } from "../shared/ui/Chip";
import { Page } from "../shared/layout/Page";
import { StaleBanner, StateView } from "../shared/states/ModuleState";
import { Popover } from "../shared/overlay/Popover";
import { Truncate } from "../shared/ui/Truncate";
import { Segmented } from "../shared/ui/Segmented";
import { Skeleton } from "../shared/ui/Skeleton";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useRetained } from "../shared/hooks/useRetained";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { TimelineItem, TimelineViewName } from "../types/timeline";

/** The main column is wider than this before the day view shows its side panel, in px. */
const WIDE_FROM = 860;

type View = "Day" | "Week" | "Month";
type Opened = { item: TimelineItem; anchor: DOMRect };
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

/** The local date in a URL, without converting midnight to UTC. */
function dateKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/**
 * Timeline's Day, Week and Month views. The URL keeps the selected view and date, session menus
 * retain details and owner actions, and Needs a time remains available for unscheduled plans.
 * Clock and device zone are read again when the app becomes visible after sleep or travel.
 */
export function TimelinePage() {
  const [params, setParams] = useSearchParams();
  const [clock, setClock] = useState(() => ({
    now: new Date(),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  const [opened, setOpened] = useState<Opened | null>(null);
  const [details, setDetails] = useState<Opened | null>(null);
  const [node, setNode] = useState<{
    id: string;
    anchor: DOMRect;
    session?: TimelineItem;
  } | null>(null);
  const { state: connection } = useConnection();
  const { now, zone } = clock;
  const requested = params.get("view");
  const view: View =
    requested === "week" ? "Week" : requested === "month" ? "Month" : "Day";
  const someday = requested === "someday";
  const date = params.get("date");
  const anchor = date === null ? startOfDay(now) : new Date(`${date}T00:00:00`);
  if (!Number.isFinite(anchor.getTime()))
    throw new Error(`Invalid Timeline date: ${date}`);
  const days =
    view === "Week"
      ? weekDays(anchor)
      : view === "Month"
        ? monthDays(anchor)
        : [anchor];
  const from = days[0]!.toISOString();
  const to = addDays(
    days[days.length - 1]!,
    view === "Day" ? 2 : 1,
  ).toISOString();
  const views: TimelineViewName[] =
    view === "Day"
      ? ["planner", "due"]
      : view === "Week"
        ? ["planner", "tile"]
        : ["month"];

  useEffect(() => {
    const refresh = () =>
      setClock({
        now: new Date(),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
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
    queryKey: ["yaad", "timeline", "page", view, from, to, zone],
    queryFn: async () => {
      const results = await Promise.all(
        views.map((name) => timeline.query({ from, to, view: name })),
      );
      return [
        ...new Map(
          results
            .flatMap(({ items }) => items)
            .map((item) => [itemKey(item), item]),
        ).values(),
      ];
    },
    enabled: isMeshOnline(connection) && !someday,
  });
  const onDay = (item: TimelineItem) => plansOn([item], anchor).length > 0;
  const state = useModuleState(
    query,
    (items) =>
      items.filter(
        (item) => !item.hide_from_planner && (view !== "Day" || onDay(item)),
      ).length === 0,
  );
  const items =
    state.kind === "ready"
      ? state.data.filter((item) => !item.hide_from_planner)
      : [];
  const own = view === "Day" ? items.filter(onDay) : items;
  const navigate = (nextView: View, day: Date, needsTime = false) => {
    setOpened(null);
    setDetails(null);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", needsTime ? "someday" : nextView.toLowerCase());
      next.set("date", dateKey(day));
      return next;
    });
  };
  const move = (step: number) =>
    navigate(
      view,
      view === "Day"
        ? addDays(anchor, step)
        : view === "Week"
          ? addDays(anchor, step * 7)
          : new Date(anchor.getFullYear(), anchor.getMonth() + step, 1),
    );
  const open = (item: TimelineItem, element: Element) =>
    setOpened({ item, anchor: element.getBoundingClientRect() });
  const changeDay =
    days.find((day) => clockChange(day, addDays(day, 1), zone) !== null) ??
    anchor;
  const change = clockChange(changeDay, addDays(changeDay, 1), zone);
  const noon = new Date(changeDay);
  noon.setHours(12);
  const other = own.find(
    (item) =>
      item.time_zone !== null &&
      zoneOffset(noon, item.time_zone) !== zoneOffset(noon, zone),
  );
  const difference = other?.time_zone
    ? (zoneOffset(noon, zone) - zoneOffset(noon, other.time_zone)) / 60
    : 0;
  const title = someday
    ? "Needs a time"
    : view === "Day"
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(anchor)
      : view === "Week"
        ? `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(days[0]!)} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(days[6]!)}`
        : new Intl.DateTimeFormat(undefined, {
            month: "long",
            year: "numeric",
          }).format(anchor);
  const when =
    view === "Day"
      ? isSameDay(anchor, now)
        ? "today"
        : "that day"
      : view === "Week"
        ? "this week"
        : "this month";
  const renderBody = (wide: boolean): ReactNode => {
    let body: ReactNode;
    if (someday)
      body = (
        <NeedsATime
          onOpen={(item, element) =>
            setNode({
              id: item.id,
              session: item,
              anchor: element.getBoundingClientRect(),
            })
          }
        />
      );
    else if (state.kind === "loading")
      body = (
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 16,
            minWidth: 0,
            minHeight: 0,
            alignItems: "stretch",
          }}
        >
          <Card style={{ flex: 1, padding: 18, gap: 0 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 56,
                  borderTop: "1px solid var(--rule)",
                  gap: 12,
                }}
              >
                <Skeleton width={40} height={10} />
                {i % 3 === 1 ? (
                  <Skeleton width="60%" height={38} radius={11} />
                ) : null}
              </div>
            ))}
          </Card>
          {wide ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 300,
                gap: 12,
              }}
            >
              <Skeleton width="100%" height={120} radius={18} />
              <Skeleton width="100%" height={100} radius={18} />
              <Skeleton width="100%" height={110} radius={18} />
            </div>
          ) : null}
        </div>
      );
    else if (state.kind === "ready")
      body =
        view === "Day" ? (
          <CalendarDay
            day={anchor}
            now={now}
            zone={zone}
            items={items}
            selected={opened === null ? null : itemKey(opened.item)}
            wide={wide}
            onOpen={open}
          />
        ) : view === "Week" ? (
          <CalendarWeek days={days} now={now} items={items} onOpen={open} />
        ) : (
          <CalendarMonth
            days={days}
            now={now}
            items={items}
            anchor={anchor}
            onOpen={open}
            onDay={(day) => navigate("Day", day)}
          />
        );
    else
      body = (
        <Card style={{ flex: 1 }}>
          <StateView
            kind={state.kind}
            title={
              state.kind === "empty"
                ? "Nothing planned"
                : state.kind === "module-offline"
                  ? "Yaad isn’t answering"
                  : state.kind === "offline"
                    ? "dadi is unreachable"
                    : "Couldn’t load the timeline"
            }
            detail={
              state.kind === "empty"
                ? "Sessions appear here as agents schedule them."
                : state.kind === "offline"
                  ? "Waiting for the mesh to reconnect"
                  : state.kind === "module-offline"
                    ? "The timeline comes from Yaad. Your other modules still work."
                    : failureProps(state.error).detail
            }
            {...(state.kind === "module-offline" || state.kind === "error"
              ? failureProps(state.error)
              : {})}
            onRetry={
              state.kind === "empty" || state.kind === "offline"
                ? undefined
                : () => void query.refetch()
            }
          />
        </Card>
      );
    return body;
  };
  const shownDetails = useRetained(details);
  const shownNode = useRetained(node);
  return (
    <PlanDetailsContext.Provider value={(item, rect) => setDetails({ item, anchor: rect })}>
      <Page name="timeline">
        {(room) => (
          <>
            <PageHeader
              title="Timeline"
              meta={!someday && state.kind === "ready" ? `${own.length} ${own.length === 1 ? "session" : "sessions"} ${when}` : undefined}
              trailing={
                <Button tone="quiet" size="sm" onClick={() => navigate(view, anchor, !someday)}>
                  {someday ? "Back to calendar" : "Needs a time"}
                </Button>
              }
            />
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none", flexWrap: "nowrap" }}>
              <Truncate text={title} style={{ flex: "0 1 auto", minWidth: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }} />
              {someday || (change === null && !other?.time_zone) ? null : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                  {change === null ? null : (
                    <Chip size="md" tone="due">
                      {`${change.from} → ${change.to}`}
                    </Chip>
                  )}
                  {other?.time_zone ? (
                    <Chip size="md" tone="tide">
                      {Math.abs(difference)} h {difference < 0 ? "behind" : "ahead of"} {other.time_zone.split("/").pop()!.replace(/_/g, " ")}
                    </Chip>
                  ) : null}
                </div>
              )}
              <div style={{ flex: 1 }} />
              {someday ? null : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <IconButton icon="back" label="Previous" onClick={() => move(-1)} />
                    <Button pill onClick={() => navigate(view, startOfDay(now))} style={{ fontWeight: 600 }}>
                      Today
                    </Button>
                    <IconButton icon="chevron" label="Next" onClick={() => move(1)} />
                  </div>
                  <Segmented options={OPTIONS} value={view} onChange={(next) => navigate(next, anchor)} />
                </>
              )}
            </div>
            {!someday && state.kind === "ready" && state.stale !== null ? (
              <StaleBanner text={`Showing what Yaad reported ${formatRelative(new Date(state.stale.since).toISOString(), now.getTime())}`} onRetry={() => void query.refetch()} />
            ) : null}
            {renderBody(room.width > WIDE_FROM)}
          </>
        )}
      </Page>
      <SessionMenu
        item={opened === null ? null : opened.item}
        anchor={opened === null ? null : opened.anchor}
        onClose={() => setOpened(null)}
        onDetails={opened === null ? undefined : () => setDetails(opened)}
      />
      {shownDetails === null ? null : (
        <Popover
          open={details !== null}
          anchor={{ x: shownDetails.anchor.left, y: shownDetails.anchor.bottom, radius: 0 }}
          aria-label={`${shownDetails.item.title} details`}
          widthPx={300}
          onClose={() => setDetails(null)}
        >
          <SessionCard block={shownDetails.item} settled={isSettled(shownDetails.item, now)} />
          <Button
            tone="quiet"
            onClick={() => {
              setNode({ id: shownDetails.item.id, session: shownDetails.item, anchor: shownDetails.anchor });
              setDetails(null);
            }}
          >
            Connections
          </Button>
        </Popover>
      )}
      {shownNode === null ? null : (
        <NodePopover
          open={node !== null}
          nodeId={shownNode.id}
          session={shownNode.session}
          anchor={{ x: shownNode.anchor.left, y: shownNode.anchor.bottom, radius: 0 }}
          onClose={() => setNode(null)}
          onSelect={(id) => setNode({ id, anchor: shownNode.anchor })}
        />
      )}
    </PlanDetailsContext.Provider>
  );
}
