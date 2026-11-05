import { useEffect, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, timeline } from "../../shared/api";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { endOfDay, startOfDay, toIsoBounds } from "./dates";
import { PlanButton } from "./PlanButton";
import { itemKey } from "./plans";
import { SessionMenu } from "./SessionMenu";

/** How often the tile moves on to what is next. */
const TICK_MS = 60_000;
/** Kinds of plan that are courses; the day draws them in tide. */
const COURSE = new Set(["class", "lab", "exam"]);
const ROW = 56;
/** Width of the time column, and the left edge of the spine's dots from the row's start. */
const TIME_COL = 68;
const SPINE_X = TIME_COL + 12 + 5;
const DOT_Y = 8;

/** "50 min" or "1 h 20 min". */
function lasting(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes));
  return whole < 60 ? `${whole} min` : whole % 60 === 0 ? `${whole / 60} h` : `${Math.floor(whole / 60)} h ${whole % 60} min`;
}

/** The colour a session is drawn in: clay for a deadline with no time, tide for a course, sage for the rest. */
function tone(item: TimelineItem): string {
  if (item.due_at !== null && item.start_at === null) {
    return "var(--clay)";
  }
  return item.kind !== null && COURSE.has(item.kind) ? "var(--tide)" : "var(--sage)";
}

/** When a session starts or is due, and when it ends: the key it is ordered by and the moment it is over. */
function span(item: TimelineItem): { from: number; to: number } {
  const from = Date.parse((item.start_at ?? item.due_at)!);
  return { from, to: item.end_at === null ? from : Date.parse(item.end_at) };
}

/** The current time, moved on every `ms`. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** A session and where it was drawn when it was clicked. */
type Opened = { item: TimelineItem; anchor: DOMRect };

/** Hands a clicked session and where it is drawn to `onOpen`, and keeps the click from following the tile's link. */
function open(event: MouseEvent<HTMLButtonElement>, item: TimelineItem, onOpen: (opened: Opened) => void): void {
  event.preventDefault();
  event.stopPropagation();
  onOpen({ item, anchor: event.currentTarget.getBoundingClientRect() });
}

type BodyProps = {
  items: TimelineItem[];
  now: number;
  geometry: TileGeometry;
  /** Key of the session the menu is open on, so its row says so. */
  opened: string | null;
  /** A session was clicked. */
  onOpen: (opened: Opened) => void;
};

/** Today's sessions down a spine in time order: the one on now in a sage card with its progress, the next one counted down, what is over quiet, and what is left of the day first when the rows do not all fit. */
function Body({ items, now, geometry, opened, onOpen }: BodyProps) {
  const today = items
    .filter((item) => !item.hide_from_planner && item.state !== "cancelled" && (item.start_at !== null || item.due_at !== null))
    .sort((a, b) => span(a).from - span(b).from);
  const fits = Math.max(1, Math.floor(geometry.bh / ROW));
  const firstLeft = today.findIndex((item) => span(item).to > now || span(item).from >= now);
  const left = firstLeft === -1 ? today.length : firstLeft;
  const first = Math.max(0, Math.min(left, today.length - fits));
  const shown = today.slice(first, first + fits);
  const next = today.find((item) => span(item).from > now);
  if (today.length === 0) {
    return <span className="text-[14px] text-ink-muted">Nothing planned today</span>;
  }
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {shown.length > 1 ? <span aria-hidden="true" className="absolute w-px bg-sage-line" style={{ left: SPINE_X, top: DOT_Y + 5, height: (shown.length - 1) * ROW }} /> : null}
      {shown.map((item) => {
        const { from, to } = span(item);
        const timed = item.start_at !== null;
        const live = timed && from <= now && to > now;
        const over = to <= now && !live;
        const done = item.outcome === "done";
        const detail = live
          ? `${lasting((to - now) / 60_000)} left`
          : item === next
            ? `in ${lasting((from - now) / 60_000)}`
            : timed
              ? [lasting((to - from) / 60_000), item.place?.room ?? item.place?.title].filter(Boolean).join(" · ")
              : "Due";
        return (
          <PlanButton
            key={`${item.id}:${item.occurrence_date}`}
            item={item}
            data-session={itemKey(item)}
            aria-haspopup="menu"
            aria-expanded={opened === itemKey(item)}
            onClick={(event) => open(event, item, onOpen)}
            title={timed ? `${item.title} · ${formatClock(item.start_at!)} – ${formatClock(item.end_at ?? item.start_at!)}` : `${item.title} · due ${formatClock(item.due_at!)}`}
            className={`ui-trans ui-hover-fill relative flex flex-none items-start gap-3 rounded-[12px] text-left ${live ? "bg-sage-active" : ""} ${over || done ? "opacity-55" : ""}`}
            style={{ height: ROW, paddingTop: 2 }}
          >
            <span className="flex flex-none flex-col items-end text-right" style={{ width: TIME_COL }}>
              <span className={`text-[13px] tabular-nums ${live ? "font-semibold text-ink" : "text-ink"}`}>{formatClock(item.start_at ?? item.due_at!)}</span>
              {timed ? <span className="text-[12px] text-ink-muted tabular-nums">{formatClock(item.end_at ?? item.start_at!)}</span> : null}
            </span>
            <span className="relative flex size-2.5 flex-none items-center justify-center" style={{ marginTop: DOT_Y - 2 }}>
              {done ? (
                <Icon name="check" size={12} />
              ) : (
                <span className={`dot size-2.5 ${live ? "dot-pulse" : ""} ${live ? "bg-sage-deep" : over ? "bg-sage-line" : "border-2 border-sage-line bg-bone"}`} style={item.start_at === null ? { background: "var(--clay)", borderColor: "var(--clay)" } : tone(item) === "var(--tide)" && !live && !over ? { borderColor: "var(--tide)" } : undefined} />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2">
              <Truncate text={item.title} className={`text-[14px] ${live ? "font-semibold" : "font-medium"}`} />
              <span className={`truncate text-[12.5px] ${live || item === next ? "text-sage-text" : "text-ink-muted"} ${item.start_at === null ? "text-clay" : ""}`}>{detail}</span>
              {live ? (
                <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-sage-line/50">
                  <span className="block h-full rounded-full bg-sage-deep" style={{ width: `${Math.min(100, Math.max(0, ((now - from) / (to - from)) * 100))}%` }} />
                </span>
              ) : null}
            </span>
          </PlanButton>
        );
      })}
    </div>
  );
}

/** Home's Timeline tile: today's sessions in order with what is on now picked out; a session opens a menu to mark it done, message its keeper or show it in Yaad. */
export function DayTile({ order }: { order: number }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const { state: connection } = useConnection();
  const now = useNow(TICK_MS);
  const range = toIsoBounds(startOfDay(new Date(now)), endOfDay(new Date(now)));
  const query = useQuery({
    queryKey: ["yaad", "timeline", "tile", range.occurred_from, range.occurred_to],
    queryFn: async () => (await timeline.query({ from: range.occurred_from, to: range.occurred_to, view: "tile" })).items,
    enabled: isMeshOnline(connection),
  });
  const state = useModuleState(query, () => false);
  const count = state.kind === "ready" ? state.data.filter((item) => !item.hide_from_planner && item.state !== "cancelled").length : 0;
  return (
    <>
      <Tile
        area="timeline"
        title="Timeline"
        to="/timeline"
        order={order}
        summary={state.kind === "ready" ? `${count} ${count === 1 ? "session" : "sessions"} today` : undefined}
        loading={state.kind === "loading"}
        notice={tileNotice(state, { name: "Yaad", request: "POST /timeline", empty: ["Nothing planned today", "Sessions appear here once Yaad has some."] }, () => void query.refetch())}
        skeleton={(g) => (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {Array.from({ length: Math.max(2, Math.min(5, Math.floor(g.bh / ROW))) }, (_, i) => (
              <div key={i} className="flex items-start gap-3 pt-0.5" style={{ height: ROW }}>
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
        {(g) => <Body items={state.kind === "ready" ? state.data : []} now={now} geometry={g} opened={opened === null ? null : itemKey(opened.item)} onOpen={setOpened} />}
      </Tile>
      <SessionMenu item={opened === null ? null : opened.item} anchor={opened === null ? null : opened.anchor} onClose={() => setOpened(null)} />
    </>
  );
}
