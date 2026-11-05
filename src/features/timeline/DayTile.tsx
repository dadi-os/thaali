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
import { SessionMenu } from "./SessionMenu";

/** How often the tile moves on to what is next. */
const TICK_MS = 60_000;
/** Kinds of plan that are courses; the day draws them in tide. */
const COURSE = new Set(["class", "lab", "exam"]);
const ROW = 40;

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

/** Today's sessions as rows in time order: the one on now washed in sage, what is over quiet, and what is left of the day first when the rows do not all fit. */
function Body({ items, now, geometry, opened, onOpen }: BodyProps) {
  const today = items
    .filter((item) => !item.hide_from_planner && item.state !== "cancelled" && (item.start_at !== null || item.due_at !== null))
    .sort((a, b) => span(a).from - span(b).from);
  const fits = Math.max(1, Math.floor(geometry.bh / ROW));
  const firstLeft = today.findIndex((item) => span(item).to > now || span(item).from >= now);
  const left = firstLeft === -1 ? today.length : firstLeft;
  const first = Math.max(0, Math.min(left, today.length - fits));
  const shown = today.slice(first, first + fits);
  if (today.length === 0) {
    return <span className="text-[14px] text-ink-muted">Nothing planned today</span>;
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {shown.map((item) => {
        const { from, to } = span(item);
        const live = item.start_at !== null && from <= now && to > now;
        const over = to <= now && !live;
        return (
          <PlanButton
            key={`${item.id}:${item.occurrence_date}`}
            item={item}
            data-session={itemKey(item)}
            aria-haspopup="menu"
            aria-expanded={opened === itemKey(item)}
            onClick={(event) => open(event, item, onOpen)}
            title={item.start_at !== null ? `${item.title} · ${formatClock(item.start_at)} – ${formatClock(item.end_at ?? item.start_at)}` : `${item.title} · due ${formatClock(item.due_at!)}`}
            className={`ui-trans ui-hover-fill flex flex-none items-center gap-3 rounded-[10px] px-2 text-left ${live ? "bg-sage-active" : ""} ${over || item.outcome === "done" ? "opacity-50" : ""}`}
            style={{ height: ROW - 4, marginBottom: 4 }}
          >
            <span className="w-[4.5rem] flex-none text-[13px] text-ink-muted tabular-nums">{formatClock(item.start_at ?? item.due_at!)}</span>
            <span className="h-5 w-[3px] flex-none rounded-full" style={{ background: tone(item) }} />
            <Truncate text={item.title} className={`min-w-0 flex-1 text-[14px] ${live ? "font-semibold" : "font-medium"}`} />
            {live ? <span className="flex-none text-[12px] font-semibold text-sage-text">Now</span> : null}
            {item.start_at === null ? <span className="flex-none text-[12px] text-clay">Due</span> : null}
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
            {Array.from({ length: Math.max(2, Math.min(6, Math.floor(g.bh / ROW))) }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-2" style={{ height: ROW }}>
                <Skeleton width={56} height={14} />
                <Skeleton width={3} height={20} radius={2} />
                <Skeleton width={`${70 - (i % 3) * 14}%`} height={16} />
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
