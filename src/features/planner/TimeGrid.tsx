import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import { useSize } from "../../shared/hooks/useSize";
import { formatClock } from "../../shared/lib/ux/time";
import type { Plan } from "../../types/planner";
import { isSameDay, wallMinutes } from "./dates";
import { formatSpan, gapsBetween, type Segment, segmentsOn } from "./layout";
import { PlanButton } from "./PlanButton";
import { meetingLink } from "./meeting";
import { planLook } from "./planLook";
import { keptBy, planTone } from "./plans";
import { nextPlanId, planStatus, timeState, type TimeState } from "./timeState";
import { plannedClock } from "./zones";

/** An hour is 56 px at the least (Week asks for 64); a window taller than the whole day stretches the day to fill it. */

/** Width of the hour-label column. */
export const AXIS_W = 64;
/** Space above midnight, so the first label is not cut off. */
const TOP_PAD = 12;
/** Minutes in a day. */
const DAY = 1440;
/** The least free stretch, in minutes, the grid names. */
const FREE_MIN = 30;
/** Where an empty day opens, in minutes: seven in the morning. */
const MORNING = 420;
/** The shortest a plan block is drawn, in px, so a short plan stays legible. */
const MIN_BLOCK = 28;

const SHEET: CSSProperties = {
  background: "var(--slab)",
  border: "1px solid var(--slab-border)",
  boxShadow: "var(--slab-shadow)",
};

/** The grid template of the axis and `count` day columns, shared by the grid and any header above it. */
export function columnsOf(count: number): string {
  return `${AXIS_W}px repeat(${count}, minmax(0, 1fr))`;
}

const hourText = (min: number) => `${Math.floor(min / 60) % 12 || 12} ${min >= 720 && min < 1440 ? "PM" : "AM"}`;

type BlockProps = {
  segment: Segment;
  now: Date;
  /** Where the plan stands against the clock: past, now, next or later. */
  state: TimeState;
  zone: string;
  top: number;
  height: number;
  selected: boolean;
  compact: boolean;
  onOpen: (plan: Plan, element: Element) => void;
};

/**
 * One plan on the axis, as tall as its time (never under 28 px). A short block is one line, title and time, centred. A
 * taller one starts at the top with the title and time on the first line and one line under them: its status, then its
 * place or note; a tall block gives the note room for more lines, so the bottom is not left bare. In a narrow Week
 * column the title takes the room and wraps, with the time under it when it fits.
 */
function Block({ segment, now, state, zone, top, height, selected, compact, onOpen }: BlockProps) {
  const { block: plan, lane, lanes } = segment;
  const there = plannedClock(plan, zone);
  const declined = plan.rsvp === "no";
  const current = state === "now";
  const ended = state === "past";
  const look = planLook(plan, state);
  const missed = look.struck;
  const range = `${formatClock(plan.start_at)} – ${formatClock(plan.end_at!)}`;
  const inset = compact ? 3 : 8;
  const narrow = compact && lanes > 1;
  const short = height < 58;
  const pad = compact ? 6 : 14;
  const status = look.caption;
  const note = plan.place === null ? null : `${plan.place.title}${plan.place.room === null ? "" : ` · room ${plan.place.room}`}`;
  const phase = state === "later" || declined ? null : planStatus(plan, now, state);
  const line = [phase, status].filter((part): part is string => part !== null).join(" · ");
  const keeper = keptBy(plan.owner);
  const facts = compact ? [] : [line, there, note, `${formatSpan(segment.endMin - segment.startMin)} long`, keeper === null ? "" : `Kept by ${keeper}`].filter((fact): fact is string => fact !== null && fact !== "");
  const fit = Math.max(0, Math.floor((height - 16 - 20 - 2) / 18));
  const quiet = (declined || missed || ended) && plan.attended !== true;
  const titleStyle: CSSProperties = { fontSize: compact ? 13 : 14, fontWeight: current ? 700 : 600, lineHeight: compact ? "16px" : "20px", textDecoration: missed ? "line-through" : "none", color: look.kind === "attended" ? "var(--ink)" : quiet ? "var(--ink-muted)" : "var(--ink)" };
  const mark =
    plan.attended === true && !compact ? (
      <span aria-label="Attended" style={{ display: "flex", color: "var(--sage-deep)", flex: "none" }}>
        <Icon name="check" size={compact ? 12 : 14} />
      </span>
    ) : ended && !declined && plan.attended === null && !compact ? (
      <span aria-label="Not marked" style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px dashed var(--ink-faint)", flex: "none" }} />
    ) : null;
  return (
    <PlanButton
      plan={plan}
      className="ui-hover-card ui-trans"
      aria-haspopup="dialog"
      aria-expanded={selected}
      onClick={(e) => onOpen(plan, e.currentTarget)}
      title={`${plan.title} · ${range}${there === null ? "" : ` (${there})`}`}
      style={{
        position: "absolute",
        left: lanes === 1 ? inset : `calc(${(lane / lanes) * 100}% + ${inset}px)`,
        right: lanes === 1 ? inset : undefined,
        width: lanes === 1 ? undefined : `calc(${100 / lanes}% - ${inset * 2}px)`,
        top,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: short ? "center" : "flex-start",
        gap: 2,
        padding: narrow ? "3px 5px" : short ? `0 ${pad}px` : compact ? `5px ${pad}px` : `8px ${pad}px`,
        borderRadius: compact ? 10 : 14,
        ...SHEET,
        ...(look.kind === "now" || look.kind === "upcoming" ? {} : { background: look.fill, border: `1px ${look.dashed ? "dashed" : "solid"} ${look.border}`, boxShadow: "none" }),
        ...(current ? { border: "1px solid var(--slab-now-border)", backgroundColor: "var(--slab)", backgroundImage: "linear-gradient(var(--sage-active), var(--sage-active))" } : {}),
        ...(selected ? { border: "1px solid var(--slab-now-border)" } : {}),
        zIndex: 2,
        overflow: "hidden",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: narrow ? "flex-start" : "center", gap: compact ? 6 : 9, minWidth: 0 }}>
        {narrow ? null : <span style={{ width: compact ? 6 : 8, height: compact ? 6 : 8, borderRadius: "50%", background: current ? "var(--sage-deep)" : ended ? "var(--ink-ghost)" : planTone(plan), flex: "none" }} />}
        {narrow ? <Clamp text={plan.title} lines={Math.max(1, Math.floor((height - 6) / 14))} style={{ flex: 1, minWidth: 0, ...titleStyle, fontSize: 12, lineHeight: "14px" }} /> : <Truncate text={plan.title} style={{ flex: 1, minWidth: 0, ...titleStyle }} />}
        {narrow || meetingLink(plan) === null ? null : <span role="img" aria-label="Video call" title="Video call" style={{ display: "flex", flex: "none", color: "var(--ink-muted)" }}><Icon name="video" size={12} /></span>}
        {compact ? null : <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap", flex: "none", fontVariantNumeric: "tabular-nums" }}>{range}</span>}
        {mark}
      </div>
      {narrow || short ? null : compact ? (
        height >= 50 ? <span style={{ fontSize: 12, lineHeight: "16px", color: state === "now" || state === "next" ? "var(--sage-text)" : "var(--ink-muted)", paddingLeft: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{state === "now" || state === "next" ? phase : [formatClock(plan.start_at), status].filter(Boolean).join(" · ")}</span> : null
      ) : (
        <>
          {facts.slice(0, fit).map((text, index) => (
            <Truncate key={text} text={text} style={{ fontSize: 13, lineHeight: "18px", color: index === 0 && line !== "" && (state === "now" || state === "next") ? "var(--sage-text)" : "var(--ink-muted)", paddingLeft: 17 }} />
          ))}
        </>
      )}
      {current ? (
        <span style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${Math.min(100, ((now.getTime() - Date.parse(plan.start_at)) / (Date.parse(plan.end_at!) - Date.parse(plan.start_at))) * 100)}%`, background: "var(--sage-deep)" }} />
      ) : null}
    </PlanButton>
  );
}

export type TimeGridProps = {
  /** The local days drawn as columns: one for Day, seven for Week. */
  days: Date[];
  /** Timed plans with a start and end; each is drawn on the days it touches. */
  plans: Plan[];
  /** The ticking clock: the now line, progress and what has ended. */
  now: Date;
  /** The device's IANA zone; plans in another zone show their own clock. */
  zone: string;
  /** Id of the plan whose detail is open. */
  selected: string | null;
  /** Open a plan's detail beside the chosen block. */
  onOpen: (plan: Plan, element: Element) => void;
  /** A header laid out on {@link columnsOf} that floats over the top of the grid, pinned while the hours scroll under it; Week's day bubbles and all-day bars. It has no background of its own. */
  head?: ReactNode;
  /** The header's height in px: the hours start below it, and the grid's rules run up behind it to the top edge. */
  headHeight?: number;
  /** Offer the "Now ↓/↑" jump when now is out of view; Day does, Week leaves it to the now line. */
  jump?: boolean;
  /** Pixels per hour at the least; 56 when absent. */
  hourPx?: number;
};

/**
 * Where the grid opens, in minutes: an hour line a little before what matters, never inside a plan. On today, near the plans,
 * that is the hour before what is on now or next; when now is far from the day's plans (two hours before the first or after
 * the last) the plans come first, and the Now marker is a jump away.
 */
function anchorOf(columns: Segment[][], single: boolean, nowMinute: number | null): number {
  const flat = columns.flat();
  const first = flat.length === 0 ? null : Math.min(...flat.map((s) => s.startMin));
  const lastEnd = flat.length === 0 ? null : Math.max(...flat.map((s) => s.endMin));
  let focus: number;
  if (single && nowMinute !== null && first !== null && lastEnd !== null && nowMinute >= first - 120 && nowMinute <= lastEnd + 120) {
    const upcoming = flat.find((s) => s.endMin > nowMinute)?.startMin ?? null;
    focus = upcoming !== null ? Math.min(upcoming, nowMinute) : Math.max(...flat.map((s) => s.startMin));
  } else if (single && nowMinute !== null && first === null) {
    focus = nowMinute;
  } else {
    focus = first ?? MORNING;
  }
  let anchor = Math.max(0, Math.floor((focus - 45) / 60) * 60);
  for (const s of flat) if (s.startMin < anchor && s.endMin > anchor) anchor = s.startMin;
  return anchor;
}

/**
 * The Planner's time axis: the whole day, 12 AM to 12 AM, drawn as its own layer of hour rules and labels that does not
 * depend on the plans, with the plans laid over it by time in side-by-side lanes. One scroll serves every column, so Day
 * and Week move together, and it opens at the hour before what is on now or next. In Day, free stretches of 30 minutes or more
 * are named (Week leaves them out as clutter), and the now line crosses today's column.
 */
export function TimeGrid({ days, plans, now, zone, selected, onOpen, head, headHeight = 0, jump = true, hourPx = 56 }: TimeGridProps) {
  const [scroller, size] = useSize<HTMLDivElement>();
  const columns = days.map((day) => segmentsOn(plans, day));
  const todayIndex = days.findIndex((day) => isSameDay(day, now));
  const nowMinute = todayIndex < 0 ? null : wallMinutes(now);
  const origin = TOP_PAD + headHeight;
  const ppm = Math.max(hourPx / 60, (size.height - origin - 12) / DAY);
  const top = (minute: number) => minute * ppm;
  const hours = Array.from({ length: DAY / 60 + 1 }, (_, i) => i * 60);
  const compact = days.length > 1;
  const nextId = nextPlanId(plans, now);
  const none = columns.every((column) => column.length === 0);
  const anchor = anchorOf(columns, days.length === 1, nowMinute);
  const [scrolled, setScrolled] = useState(0);
  const seen = { from: (scrolled - TOP_PAD) / ppm, to: (scrolled - TOP_PAD + size.height) / ppm };
  const away = nowMinute === null || size.height === 0 ? null : nowMinute < seen.from ? "up" : nowMinute > seen.to ? "down" : null;
  const placed = useRef<number | null>(null);
  const key = days[0]!.getTime() * 10 + days.length;
  useLayoutEffect(() => {
    if (size.height === 0 || placed.current === key) return;
    placed.current = key;
    scroller.current!.scrollTop = anchor * ppm + TOP_PAD - 10;
  }, [key, size.height, anchor, ppm, scroller]);
  const template = columnsOf(days.length);
  return (
    <>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {away === null || !jump ? null : (
        <div style={{ order: away === "up" ? -1 : 1, flex: "none", display: "flex", justifyContent: "flex-end", padding: "2px 6px" }}>
          <Button tone="quiet" size="sm" onClick={() => scroller.current!.scrollTo({ top: nowMinute! * ppm - size.height / 2 + TOP_PAD, behavior: "smooth" })}>
            {`Now ${away === "down" ? "↓" : "↑"} ${formatClock(now.toISOString())}`}
          </Button>
        </div>
      )}
      {head === undefined ? null : <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 6, pointerEvents: "none" }}>{head}</div>}
      <div ref={scroller} className="scroll" onScroll={(event) => setScrolled(event.currentTarget.scrollTop)} style={{ flex: 1, minHeight: 0 }}>
      {none ? (
        <div style={{ position: "sticky", top: 0, height: 0, zIndex: 1, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: AXIS_W, right: 0, top: Math.max(40, size.height * 0.3), display: "flex", justifyContent: "center" }}>
            <div style={{ width: 380, background: "var(--glass-solid)", borderRadius: 18, padding: "16px 8px", display: "flex" }}>
              <StateView dense kind="empty" title="Nothing planned" detail="Plans appear here as agents schedule them." />
            </div>
          </div>
        </div>
      ) : null}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: template, height: DAY * ppm + origin + 12 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: origin, height: DAY * ppm, zIndex: 0, pointerEvents: "none" }} aria-hidden="true">
          {hours.map((m) => (
            <div key={m} style={{ position: "absolute", left: 0, right: 0, top: top(m), borderTop: "1px solid var(--rule)" }}>
              <span style={{ position: "absolute", top: -9, left: 0, width: AXIS_W, visibility: nowMinute !== null && Math.abs(nowMinute - m) * ppm < 26 ? "hidden" : "visible", paddingRight: 10, textAlign: "right", fontSize: 12, lineHeight: "16px", color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{hourText(m)}</span>
            </div>
          ))}
        </div>
        <div />
        {days.map((day, index) => {
          const segments = columns[index]!;
          return (
            <div key={day.toISOString()} data-day={day.toISOString().slice(0, 10)} style={{ position: "relative", borderLeft: compact ? "1px solid var(--rule)" : "none", background: compact && index === todayIndex ? "var(--sage-fill)" : "transparent" }}>
              {gapsBetween(segments, FREE_MIN).map((gap) =>
                compact || (gap.endMin - gap.startMin) * ppm < 26 ? null : (
                  <div key={gap.startMin} aria-label={`Free ${formatSpan(gap.endMin - gap.startMin)}`} style={{ position: "absolute", left: 0, right: 0, top: origin + top(gap.startMin), height: (gap.endMin - gap.startMin) * ppm, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}>
                    <span style={{ fontSize: compact ? 11 : 12, color: "var(--ink-faint)", background: "var(--glass-solid)", padding: "1px 8px", borderRadius: 999 }}>{`Free · ${formatSpan(gap.endMin - gap.startMin)}`}</span>
                  </div>
                ),
              )}
              {segments.map((segment) => (
                <Block key={segment.block.id} segment={segment} now={now} state={timeState(segment.block, now, nextId)} zone={zone} top={origin + top(segment.startMin)} height={Math.max(MIN_BLOCK, (segment.endMin - segment.startMin) * ppm - 2)} selected={selected === segment.block.id} compact={compact} onOpen={onOpen} />
              ))}
            </div>
          );
        })}
        {nowMinute !== null ? (
          <>
            <div style={{ position: "absolute", left: AXIS_W, right: 0, top: origin + top(nowMinute) - 1, height: 2, background: "var(--sage-deep)", opacity: compact ? 0.3 : 1, zIndex: 1, pointerEvents: "none" }} />
            <span style={{ position: "absolute", left: 4, top: origin + top(nowMinute) - 12, height: 24, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--bone)", background: "var(--sage-deep)", borderRadius: 6, zIndex: 4, pointerEvents: "none" }}>
              <span style={{ position: "relative" }}>{formatClock(now.toISOString())}</span>
            </span>
            {compact && todayIndex >= 0 ? (
              <div style={{ position: "absolute", left: `calc(${AXIS_W}px + (100% - ${AXIS_W}px) * ${todayIndex / days.length})`, width: `calc((100% - ${AXIS_W}px) / ${days.length})`, top: origin + top(nowMinute) - 1, height: 2, background: "var(--sage-deep)", zIndex: 1, pointerEvents: "none" }} />
            ) : null}
          </>
        ) : null}
      </div>
      </div>
      </div>
    </>
  );
}
