import { useEffect, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, timeline } from "../../shared/api";
import { Skeleton } from "../../shared/components/Skeleton";
import { Truncate } from "../../shared/components/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { addDays, endOfDay, startOfWeek, toIsoBounds } from "./dates";
import { itemKey } from "./plans";
import { SessionMenu } from "./SessionMenu";

/** How often the tile moves its now line. */
const TICK_MS = 60_000;
/** The days of the week the tile heads its columns with, Monday first. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** Kinds of plan that are courses; the week draws them in tide. */
const COURSE = new Set(["class", "lab", "exam"]);
const HEADER = 40;
const FOOTER = 30;
const AXIS = 26;

/** The date a local day goes by in a session's `occurrence_date` (`2026-10-28`). */
function dateKey(day: Date): string {
  return day.toLocaleDateString("en-CA");
}

/** The hour of the day an instant is at in the device's zone, with minutes as a fraction. */
function hourOf(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === "hour")!.value) + Number(parts.find((p) => p.type === "minute")!.value) / 60;
}

/** The colour a session is drawn in: clay for a deadline with no time, tide for a course, sage for the rest; the second is its wash. */
function tone(item: TimelineItem): [ink: string, wash: string] {
  if (item.due_at !== null && item.start_at === null) {
    return ["var(--clay)", "rgba(184,154,99,.28)"];
  }
  return item.kind !== null && COURSE.has(item.kind) ? ["var(--tide)", "rgba(125,154,166,.30)"] : ["var(--sage)", "rgba(143,163,130,.30)"];
}

/** "12p", "4p", "8a": the hour marks down the week's left edge. */
function hourLabel(hour: number): string {
  return hour === 12 ? "12p" : hour > 12 ? `${hour - 12}p` : `${hour}a`;
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
  /** Key of the session the menu is open on, so its block says so. */
  opened: string | null;
  /** A session was clicked. */
  onOpen: (opened: Opened) => void;
};

/** The week as seven columns of sessions against an hour axis, today shaded with a line at the time, and what is on now or next under it. */
function Body({ items, now, geometry, opened, onOpen }: BodyProps) {
  const week = items.filter((item) => !item.hide_from_planner && item.state !== "cancelled");
  const monday = startOfWeek(new Date(now));
  const days = WEEKDAYS.map((dow, i) => {
    const day = addDays(monday, i);
    return { dow, key: dateKey(day), n: day.toLocaleDateString("en-US", { day: "numeric" }) };
  });
  const today = dateKey(new Date(now));
  const timed = week.filter((item) => item.start_at !== null);
  const first = Math.min(...timed.map((item) => hourOf(item.start_at!)));
  const last = Math.max(...timed.map((item) => hourOf(item.end_at ?? item.start_at!)));
  const lo = Math.max(5, Math.min(Math.floor(first), 8));
  const hi = Math.min(24, Math.max(Math.ceil(last), lo + 8));
  const areaHeight = Math.max(60, geometry.bh - HEADER - FOOTER - 16);
  const px = areaHeight / (hi - lo);
  const nowHour = hourOf(new Date(now).toISOString());
  const live = timed.find((item) => Date.parse(item.start_at!) <= now && Date.parse(item.end_at!) > now);
  const next = timed.filter((item) => Date.parse(item.start_at!) > now).sort((a, b) => Date.parse(a.start_at!) - Date.parse(b.start_at!))[0];
  const marks: number[] = [];
  for (let hour = Math.ceil(lo / 4) * 4; hour <= hi; hour += 4) {
    marks.push(hour);
  }
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "stretch", height: HEADER, flex: "none" }}>
        <div style={{ width: AXIS, flex: "none" }} />
        {days.map((day) => {
          const isToday = day.key === today;
          return (
            <div key={day.key} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 10, background: isToday ? "var(--sage-deep)" : "transparent", color: isToday ? "var(--bone)" : "var(--ink)" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: isToday ? "#e8ece2" : "var(--ink-muted)" }}>{day.dow}</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{day.n}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "stretch", height: areaHeight, flex: "none", position: "relative" }}>
        <div style={{ width: AXIS, flex: "none", position: "relative" }}>
          {marks
            .filter((hour) => (hour - lo) * px + 8 <= areaHeight)
            .map((hour) => (
              <span key={hour} style={{ position: "absolute", top: (hour - lo) * px - 7, left: 0, fontSize: 10.5, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
                {hourLabel(hour)}
              </span>
            ))}
        </div>
        <div style={{ position: "absolute", left: AXIS, right: 0, top: 0, bottom: 0 }}>
          {marks.map((hour) => (
            <div key={hour} style={{ position: "absolute", left: 0, right: 0, top: (hour - lo) * px, borderTop: "1px solid var(--rule)" }} />
          ))}
        </div>
        {days.map((day) => {
          const isToday = day.key === today;
          const own = week.filter((item) => item.occurrence_date === day.key);
          return (
            <div key={day.key} style={{ position: "relative", flex: 1, minWidth: 0, borderLeft: "1px solid var(--rule)", background: isToday ? "rgba(143,163,130,.07)" : "transparent" }}>
              {own
                .filter((item) => item.start_at !== null)
                .map((item) => {
                  const [ink, wash] = tone(item);
                  return (
                    <button
                      key={`${item.id}:${item.occurrence_date}`}
                      type="button"
                      data-session={itemKey(item)}
                      aria-haspopup="menu"
                      aria-expanded={opened === itemKey(item)}
                      onClick={(event) => open(event, item, onOpen)}
                      title={`${item.title} · ${formatClock(item.start_at!)} – ${formatClock(item.end_at!)}`}
                      style={{ position: "absolute", left: 3, right: 3, top: (hourOf(item.start_at!) - lo) * px, height: Math.max(7, (hourOf(item.end_at!) - hourOf(item.start_at!)) * px - 2), borderRadius: 5, background: wash, borderLeft: `3px solid ${ink}`, opacity: item.outcome === "done" ? 0.55 : 1, boxSizing: "border-box" }}
                    />
                  );
                })}
              {own
                .filter((item) => item.start_at === null && item.due_at !== null)
                .map((item) => (
                  <button
                    key={`${item.id}:${item.occurrence_date}`}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={opened === itemKey(item)}
                    onClick={(event) => open(event, item, onOpen)}
                    title={`${item.title} · due ${formatClock(item.due_at!)}`}
                    style={{ position: "absolute", left: 3, right: 3, top: Math.min(areaHeight - 8, Math.max(0, (hourOf(item.due_at!) - lo) * px)), height: 6, borderRadius: 3, background: "var(--clay)" }}
                  />
                ))}
              {isToday ? <div style={{ position: "absolute", left: 0, right: 0, top: (nowHour - lo) * px, height: 2, background: "var(--sage-deep)", zIndex: 2 }} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: FOOTER, flex: "none", fontSize: 13, borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
        {live !== undefined ? (
          <>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--bone)", padding: "2px 8px", borderRadius: 999, background: "var(--sage-deep)", flex: "none" }}>Now</span>
            <Truncate text={live.title} style={{ flex: 1, minWidth: 0, fontWeight: 500 }} />
          </>
        ) : next !== undefined ? (
          <>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sage-text)", padding: "2px 8px", borderRadius: 999, background: "var(--sage-fill)", flex: "none" }}>Next</span>
            <Truncate text={next.title} style={{ flex: 1, minWidth: 0, fontWeight: 500 }} />
            <span style={{ color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{formatClock(next.start_at!)}</span>
          </>
        ) : (
          <span style={{ color: "var(--ink-muted)" }}>Nothing left this week</span>
        )}
      </div>
    </div>
  );
}

/** Home's Timeline tile: this week's sessions, how many are today, and what is on now or next; a session opens a menu to mark it done, message its keeper or show it in Yaad. */
export function WeekTile({ order }: { order: number }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const { state: connection } = useConnection();
  const now = useNow(TICK_MS);
  const start = startOfWeek(new Date(now));
  const range = toIsoBounds(start, endOfDay(addDays(start, 6)));
  const query = useQuery({
    queryKey: ["yaad", "timeline", "tile", range.occurred_from, range.occurred_to],
    queryFn: async () => (await timeline.query({ from: range.occurred_from, to: range.occurred_to, view: "tile" })).items,
    enabled: isMeshOnline(connection),
  });
  const state = useModuleState(query, (items) => items.length === 0);
  const today = state.kind === "ready" ? state.data.filter((item) => !item.hide_from_planner && item.occurrence_date === dateKey(new Date(now))).length : 0;
  return (
    <>
      <Tile
        area="timeline"
        title="Timeline"
        to="/timeline?view=week"
        order={order}
        summary={state.kind === "ready" ? `${today} ${today === 1 ? "session" : "sessions"} today` : undefined}
        loading={state.kind === "loading"}
        notice={tileNotice(state, { name: "Yaad", request: "POST /timeline", empty: ["Nothing planned today", "Sessions appear here once Yaad has some."] }, () => void query.refetch())}
        skeleton={() => (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36, flex: "none" }}>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <Skeleton width={22} height={10} />
                  <Skeleton width={18} height={14} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 4, minHeight: 0 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
                  {[1 + (i % 2), 2 + (i % 3), 1 + ((i + 1) % 2)].map((grow, j) => (
                    <span key={j} className="sk" style={{ display: "block", flex: grow, minHeight: 0, borderRadius: 5 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      >
        {(g) => <Body items={state.kind === "ready" ? state.data : []} now={now} geometry={g} opened={opened === null ? null : itemKey(opened.item)} onOpen={setOpened} />}
      </Tile>
    {opened === null ? null : <SessionMenu item={opened.item} anchor={opened.anchor} onClose={() => setOpened(null)} />}
    </>
  );
}
