import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";
import { PlanButton } from "./PlanButton";
import { StateView } from "../../shared/states/ModuleState";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import { formatClock } from "../../shared/lib/ux/time";
import type { Plan } from "../../types/planner";
import { isSameDay, wallMinutes } from "./dates";
import { axisRange, formatSpan, gapsBetween, hasEnded, type Segment, segmentsOn } from "./layout";
import { attendedLabel, isCurrent, planTone } from "./plans";
import { plannedClock } from "./zones";

/** Pixels per minute on the shared time axis. */
const PPM = 56 / 60;
/** Width of the hour-label column. */
export const AXIS_W = 64;
/** The least free stretch, in minutes, the grid names. */
const FREE_MIN = 30;

const SHEET: CSSProperties = {
  background: "var(--bone-raised)",
  border: "1px solid var(--rule)",
  boxShadow: "0 1px 2px rgba(44,48,42,.06)",
};

/** The grid template of the axis and `count` day columns, shared by the grid and any header above it. */
export function columnsOf(count: number): string {
  return `${AXIS_W}px repeat(${count}, minmax(0, 1fr))`;
}

const hourText = (min: number) => `${Math.floor(min / 60) % 12 || 12} ${min >= 720 && min < 1440 ? "PM" : "AM"}`;

type BlockProps = {
  segment: Segment;
  now: Date;
  zone: string;
  top: number;
  selected: boolean;
  compact: boolean;
  onOpen: (plan: Plan, element: Element) => void;
};

/** One plan on the axis: tall as its time, side by side with plans it overlaps, muted when declined. */
function Block({ segment, now, zone, top, selected, compact, onOpen }: BlockProps) {
  const { block: plan, startMin, endMin, lane, lanes } = segment;
  const height = Math.max(compact ? 24 : 32, (endMin - startMin) * PPM - 3);
  const there = plannedClock(plan, zone);
  const declined = plan.rsvp === "no";
  const current = isCurrent(plan, now);
  const ended = hasEnded(plan, now);
  const status = declined ? "Declined" : attendedLabel(plan);
  const range = `${formatClock(plan.start_at)} – ${formatClock(plan.end_at!)}`;
  const inset = compact ? 3 : 8;
  const narrow = compact && lanes > 1;
  const detail = !compact && height >= 50 ? (there ?? (plan.body ?? (plan.place === null ? null : `${plan.place.title}${plan.place.room === null ? "" : ` · room ${plan.place.room}`}`))) : null;
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
        justifyContent: compact || height < 50 ? "flex-start" : "center",
        gap: 2,
        padding: narrow ? "3px 6px" : compact ? "3px 8px" : "5px 14px",
        borderRadius: compact ? 10 : 14,
        ...SHEET,
        ...(declined ? { background: "var(--bone)", border: "1px dashed var(--ink-ghost)", boxShadow: "none" } : {}),
        ...(selected || current ? { border: "1px solid var(--sage-deep)" } : {}),
        zIndex: 2,
        color: declined ? "var(--ink-muted)" : "var(--ink)",
        overflow: "hidden",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: narrow ? "flex-start" : "center", gap: compact ? 6 : 9, minHeight: compact ? 16 : 20 }}>
        {narrow ? null : <span style={{ width: compact ? 6 : 8, height: compact ? 6 : 8, borderRadius: "50%", background: planTone(plan), flex: "none" }} />}
        {narrow ? (
          <Clamp text={plan.title} lines={Math.max(1, Math.floor((height - 8) / 15))} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, lineHeight: "15px" }} />
        ) : (
          <Truncate text={plan.title} style={{ flex: 1, minWidth: 0, fontSize: compact ? 13 : 14, fontWeight: 600 }} />
        )}
        {compact ? null : <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap", flex: "none", fontVariantNumeric: "tabular-nums" }}>{range}</span>}
        {plan.attended === true ? (
          <span aria-label="Attended" style={{ display: "flex", color: "var(--sage-deep)" }}>
            <Icon name="check" size={compact ? 12 : 14} />
          </span>
        ) : ended && !declined && plan.attended === null && !compact ? (
          <span aria-label="Not marked" style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px dashed var(--ink-faint)", flex: "none" }} />
        ) : null}
      </div>
      {narrow ? null : height >= (compact ? 40 : 46) && (compact || status !== null || detail !== null) ? (
        <span style={{ fontSize: compact ? 11 : 12, color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: compact ? 12 : 17 }}>
          {compact ? formatClock(plan.start_at) : [status, detail].filter((part) => part !== null).join(" · ")}
        </span>
      ) : null}
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
  /** A sticky header above the axis laid out on {@link columnsOf}; Week's day headers and span row. */
  head?: ReactNode;
};

/**
 * The Planner's time axis: hour rules, a now line, and one column per day under a single scroll, so Day and Week
 * move together. Plans sit by time in side-by-side lanes and free stretches of 30 minutes or more are named.
 */
export function TimeGrid({ days, plans, now, zone, selected, onOpen, head }: TimeGridProps) {
  const columns = days.map((day) => segmentsOn(plans, day));
  const todayIndex = days.findIndex((day) => isSameDay(day, now));
  const nowMinute = todayIndex < 0 ? null : wallMinutes(now);
  const planMinutes = columns.flat().flatMap((s) => [s.startMin, s.endMin]);
  const nearPlans = nowMinute !== null && (planMinutes.length === 0 || (nowMinute <= Math.max(...planMinutes) + 120 && nowMinute >= Math.min(...planMinutes) - 120));
  const minutes = [...planMinutes, ...(nearPlans ? [nowMinute!] : [])];
  const range = axisRange(columns);
  const lo = minutes.length === 0 || columns.flat().length === 0 ? range.from * 60 : Math.max(0, Math.floor((Math.min(...minutes) - 60) / 60) * 60);
  const hi = minutes.length === 0 || columns.flat().length === 0 ? range.to * 60 : Math.min(1440, Math.ceil((Math.max(...minutes) + 60) / 60) * 60);
  const hours = Array.from({ length: (hi - lo) / 60 + 1 }, (_, i) => lo + i * 60);
  const top = (minute: number) => (minute - lo) * PPM;
  const compact = days.length > 1;
  const none = columns.every((column) => column.length === 0);
  const template = columnsOf(days.length);
  const scroller = useRef<HTMLDivElement>(null);
  const flat = columns.flat();
  const upcoming = nowMinute === null ? null : (flat.find((x) => x.endMin > nowMinute)?.startMin ?? null);
  const lastStart = flat.length === 0 ? null : Math.max(...flat.map((x) => x.startMin));
  const earliest = flat.length === 0 ? null : Math.min(...flat.map((x) => x.startMin));
  const focus = days.length === 1 && nowMinute !== null ? (upcoming !== null ? Math.min(upcoming, nowMinute) : (lastStart ?? nowMinute)) : earliest;
  const first = days[0]!.getTime();
  useLayoutEffect(() => {
    if (focus === null) return;
    let anchor = Math.max(lo, Math.floor((focus - 45) / 60) * 60);
    for (const x of flat) if (x.startMin < anchor && x.endMin > anchor) anchor = x.startMin;
    scroller.current!.scrollTop = Math.max(0, (anchor - lo) * PPM);
  }, [first, days.length]);
  return (
    <div ref={scroller} className="scroll" style={{ flex: 1, minHeight: 0 }}>
      {head}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: template, height: (hi - lo) * PPM + 24, marginTop: 12 }}>
        {hours.map((m) => (
          <div key={m} style={{ position: "absolute", left: 0, right: 0, top: top(m), borderTop: "1px solid var(--rule)", zIndex: 0 }}>
            <span
              style={{
                position: "absolute",
                top: -8,
                left: 0,
                fontSize: 12,
                color: "var(--ink-muted)",
                width: AXIS_W,
                textAlign: "right",
                paddingRight: 10,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {hourText(m)}
            </span>
          </div>
        ))}
        <div />
        {days.map((day, index) => {
          const segments = columns[index]!;
          const isToday = index === todayIndex;
          return (
            <div key={day.toISOString()} data-day={day.toISOString().slice(0, 10)} style={{ position: "relative", borderLeft: compact ? "1px solid var(--rule)" : "none", background: compact && isToday ? "var(--sage-fill)" : "transparent" }}>
              {gapsBetween(segments, FREE_MIN).map((gap) =>
                (gap.endMin - gap.startMin) * PPM < 26 ? null : (
                  <div
                    key={gap.startMin}
                    aria-label={`Free ${formatSpan(gap.endMin - gap.startMin)}`}
                    style={{ position: "absolute", left: 0, right: 0, top: top(gap.startMin), height: (gap.endMin - gap.startMin) * PPM, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}
                  >
                    <span style={{ fontSize: compact ? 11 : 12, color: "var(--ink-faint)", background: "var(--glass-solid)", padding: "1px 8px", borderRadius: 999 }}>{`Free · ${formatSpan(gap.endMin - gap.startMin)}`}</span>
                  </div>
                ),
              )}
              {segments.map((segment) => (
                <Block key={segment.block.id} segment={segment} now={now} zone={zone} top={top(segment.startMin)} selected={selected === segment.block.id} compact={compact} onOpen={onOpen} />
              ))}
            </div>
          );
        })}
        {nearPlans && nowMinute! >= lo && nowMinute! <= hi ? (
          <>
            <div style={{ position: "absolute", left: AXIS_W - 4, right: 0, top: top(nowMinute!) - 1, height: 2, background: "var(--sage-deep)", opacity: compact ? 0.3 : 1, zIndex: 3, pointerEvents: "none" }} />
            <span style={{ position: "absolute", left: 2, width: AXIS_W - 10, top: top(nowMinute!) - 10, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--bone)", background: "var(--sage-deep)", borderRadius: 999, zIndex: 4, pointerEvents: "none" }}>{formatClock(now.toISOString())}</span>
          </>
        ) : null}
        {compact && todayIndex >= 0 && nearPlans && nowMinute! >= lo && nowMinute! <= hi ? (
          <div style={{ position: "absolute", left: `calc(${AXIS_W}px + (100% - ${AXIS_W}px) * ${todayIndex / days.length})`, width: `calc((100% - ${AXIS_W}px) / ${days.length})`, top: top(nowMinute!) - 1, height: 2, background: "var(--sage-deep)", zIndex: 3, pointerEvents: "none" }} />
        ) : null}
        {none ? (
          <div style={{ position: "absolute", left: AXIS_W, right: 0, top: 0, bottom: 0, display: "flex", zIndex: 1, pointerEvents: "none" }}>
            <StateView dense kind="empty" title="Nothing planned" detail="Plans appear here as agents schedule them." />
          </div>
        ) : null}
      </div>
    </div>
  );
}
