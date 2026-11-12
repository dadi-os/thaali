import { useEffect, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, timeline } from "../../shared/api";
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
import { useSessionPopover } from "./useSessionPopover";

/** How often the tile moves on to what is next. */
const TICK_MS = 60_000;
/** Kinds of plan that are courses; the day draws them in tide. */
const COURSE = new Set(["class", "lab", "exam"]);
/** The least height a session's row takes, and the most it stretches to when the tile has room to spare. */
const MIN_ROW = 64;
const MAX_ROW = 84;
/** Gap between the live session's progress track and the bottom edge of its row, and the track's height. */
const BAR_GAP = 9;
const BAR_H = 4;
/** Padding above a row's first line, the height of that line, and where the spine's dot sits so it is centred on it. */
const ROW_TOP = 8;
const LINE = 20;
const PAD_X = 8;
/** Width of the time column, and the left edge of the spine's dots from the row's start. */
const TIME_COL = 68;
const SPINE_X = PAD_X + TIME_COL + 12 + 5;

/** "50 min" or "1 h 20 min". */
function lasting(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes));
  return whole < 60 ? `${whole} min` : whole % 60 === 0 ? `${whole / 60} h` : `${Math.floor(whole / 60)} h ${whole % 60} min`;
}

/** The colour a session is drawn in: tide for a course, sage for the rest. */
function tone(item: TimelineItem): string {
  return item.kind !== null && COURSE.has(item.kind) ? "var(--tide)" : "var(--sage)";
}

/** When a session starts and when it ends: the key it is ordered by and the moment it is over. */
function span(item: TimelineItem): { from: number; to: number } {
  const from = Date.parse(item.start_at!);
  return { from, to: item.end_at === null ? from : Date.parse(item.end_at) };
}

/** Whether the tile draws `item`: a timed session that is not hidden or cancelled; plans that are only due belong to the Day view's Due panel. */
export function isSession(item: TimelineItem): boolean {
  return item.start_at !== null && !item.hide_from_planner && item.state !== "cancelled";
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

/** Hands a clicked session and where it is drawn to `onOpen`, and keeps the click from following the tile's link. */
function open(event: MouseEvent<HTMLButtonElement>, item: TimelineItem, onOpen: (item: TimelineItem, anchor: DOMRect) => void): void {
  event.preventDefault();
  event.stopPropagation();
  onOpen(item, event.currentTarget.getBoundingClientRect());
}

type BodyProps = {
  items: TimelineItem[];
  now: number;
  geometry: TileGeometry;
  /** Key of the session whose details are open, so its row says so. */
  opened: string | null;
  /** A session was clicked. */
  onOpen: (item: TimelineItem, anchor: DOMRect) => void;
};

/** Today's sessions down a spine in time order: the one on now in a sage card with its progress, the next one counted down, what is over quiet, and what is left of the day first when the rows do not all fit. */
function Body({ items, now, geometry, opened, onOpen }: BodyProps) {
  const today = items
    .filter(isSession)
    .sort((a, b) => span(a).from - span(b).from);
  const fits = Math.max(1, Math.floor(geometry.bh / MIN_ROW));
  const firstLeft = today.findIndex((item) => span(item).to > now || span(item).from >= now);
  const left = firstLeft === -1 ? today.length : firstLeft;
  const first = Math.max(0, Math.min(left, today.length - fits));
  const shown = today.slice(first, first + fits);
  const next = today.find((item) => span(item).from > now);
  const row = Math.min(MAX_ROW, Math.floor(geometry.bh / Math.max(1, shown.length)));
  if (today.length === 0) {
    return <span className="text-[14px] text-ink-muted">Nothing planned today</span>;
  }
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {shown.length > 1 ? <span aria-hidden="true" className="absolute w-px bg-sage-line" style={{ left: SPINE_X, top: ROW_TOP + LINE / 2, height: (shown.length - 1) * row }} /> : null}
      {shown.map((item) => {
        const { from, to } = span(item);
        const live = from <= now && to > now;
        const over = to <= now && !live;
        const done = item.outcome === "done";
        const detail = live
          ? `${lasting((to - now) / 60_000)} left`
          : item === next
            ? `in ${lasting((from - now) / 60_000)}`
            : [lasting((to - from) / 60_000), item.place?.room ?? item.place?.title].filter(Boolean).join(" · ");
        return (
          <PlanButton
            key={`${item.id}:${item.occurrence_date}`}
            item={item}
            data-session={itemKey(item)}
            aria-haspopup="menu"
            aria-expanded={opened === itemKey(item)}
            onClick={(event) => open(event, item, onOpen)}
            title={`${item.title} · ${formatClock(item.start_at!)} – ${formatClock(item.end_at ?? item.start_at!)}`}
            className={`ui-trans ui-hover-fill relative flex flex-none items-start gap-3 rounded-[12px] px-2 text-left ${live ? "bg-sage-active" : ""} ${over ? "opacity-55" : ""}`}
            style={{ height: row, paddingTop: ROW_TOP }}
          >
            <span className="flex flex-none flex-col items-end text-right" style={{ width: TIME_COL }}>
              <span className={`text-[13px] leading-5 tabular-nums ${live ? "font-semibold text-ink" : "text-ink"}`}>{formatClock(item.start_at!)}</span>
              <span className="text-[12px] leading-4 text-ink-muted tabular-nums">{formatClock(item.end_at ?? item.start_at!)}</span>
            </span>
            <span className="relative flex size-2.5 flex-none items-center justify-center" style={{ marginTop: (LINE - 10) / 2 }}>
              <span className={`dot size-2.5 ${live ? "dot-pulse" : ""} ${live ? "bg-sage-deep" : done ? "bg-sage" : over ? "bg-sage-line" : "border-2 border-sage-line bg-bone"}`} style={tone(item) === "var(--tide)" && !live && !over && !done ? { borderColor: "var(--tide)" } : undefined} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 pr-1">
              <Truncate text={item.title} className={`text-[14px] leading-5 ${live ? "font-semibold" : "font-medium"} ${done ? "text-ink-muted line-through decoration-sage-deep decoration-2" : ""}`} />
              <span className={`truncate text-[12.5px] leading-4 ${live || item === next ? "text-sage-text" : "text-ink-muted"}`}>{detail}</span>
            </span>
            {live ? (
              <span aria-hidden="true" className="absolute overflow-hidden rounded-full" style={{ left: PAD_X + TIME_COL + 12 + 10 + 12, right: PAD_X + 4, bottom: BAR_GAP, height: BAR_H, background: "color-mix(in srgb, var(--sage-deep) 16%, transparent)" }}>
                <span className="block h-full rounded-full bg-sage-deep transition-[width] duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, ((now - from) / (to - from)) * 100))}%` }} />
              </span>
            ) : null}
          </PlanButton>
        );
      })}
    </div>
  );
}

/** Home's Timeline tile: today's sessions in order with what is on now picked out; a session opens its details, and right-clicking it offers to mark it done, message its keeper or show it in Yaad. */
export function DayTile({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const now = useNow(TICK_MS);
  const popover = useSessionPopover();
  const range = toIsoBounds(startOfDay(new Date(now)), endOfDay(new Date(now)));
  const query = useQuery({
    queryKey: ["yaad", "timeline", "tile", range.occurred_from, range.occurred_to],
    queryFn: async () => {
      const { items } = await timeline.query({ from: range.occurred_from, to: range.occurred_to, view: "planner" });
      return items;
    },
    enabled: isMeshOnline(connection),
  });
  const state = useModuleState(query, () => false);
  const count = state.kind === "ready" ? state.data.filter(isSession).length : 0;
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
            {Array.from({ length: Math.max(2, Math.min(5, Math.floor(g.bh / MIN_ROW))) }, (_, i) => (
              <div key={i} className="flex items-start gap-3 px-2" style={{ height: MIN_ROW, paddingTop: ROW_TOP }}>
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
        {(g) => <Body items={state.kind === "ready" ? state.data : []} now={now} geometry={g} opened={popover.openKey} onOpen={popover.show} />}
      </Tile>
      {popover.popovers}
    </>
  );
}
