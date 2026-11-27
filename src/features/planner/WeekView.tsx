import { useLayoutEffect, useRef } from "react";
import { StateView } from "../../shared/states/ModuleState";
import { useSize } from "../../shared/hooks/useSize";
import { formatClock } from "../../shared/lib/ux/time";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import { Truncate } from "../../shared/ui/Truncate";
import type { Plan } from "../../types/planner";
import { dateKey, isSameDay, wallMinutes } from "./dates";
import { segmentsOn } from "./layout";
import { PlanButton } from "./PlanButton";
import { bandPlans, barColumns, barEdges, barLook, gridPlans, spanLanes, spanRange } from "./plans";
import type { DayBadge } from "./tasks";
import { nextPlanId, timeState } from "./timeState";
import { WeekBlock } from "./WeekBlock";
import { type BubbleFit, barRows, bubbleFit, bubbleState, capLanes, narrowColumn, weekAnchor, weekColumns, weekHeadHeight, WEEK, WEEK_LEFT } from "./weekLayout";

/** Minutes in a day. */
const DAY = 1440;

const hourText = (minute: number) => `${Math.floor(minute / 60) % 12 || 12} ${minute >= 720 && minute < 1440 ? "PM" : "AM"}`;

type DayBubbleProps = {
  day: Date;
  /** The ticking clock: a day that is over is quiet. */
  now: Date;
  badge: DayBadge | undefined;
  /** How much of the bubble the column has room for. */
  fit: BubbleFit;
  onOpen: () => void;
};

/**
 * One day of the Week header as a small floating bubble on a single line: weekday, date and the day's open tasks as a dot with
 * a count. Today is the one filled bubble, a day that is over is quiet. It opens that day. The bubble has its own fill and
 * nothing behind it, so the hours scroll under it.
 */
function DayBubble({ day, now, badge, fit, onOpen }: DayBubbleProps) {
  const state = bubbleState(day, now, badge);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: fit === "letter" ? "narrow" : "short" }).format(day);
  return (
    <div style={{ display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <Button
        tone={state.today ? "fill" : "quiet"}
        size="sm"
        pill
        onClick={onOpen}
        aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}${state.spoken}`}
        style={{ pointerEvents: "auto", ...(fit === "full" ? {} : { padding: `0 ${WEEK.padXShared}px` }), ...(state.today ? {} : { backgroundColor: "var(--glass-solid)", backgroundImage: "linear-gradient(var(--sage-fill), var(--sage-fill))", boxShadow: "var(--slab-shadow)" }), ...(state.over ? { color: "var(--ink-muted)" } : {}) }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>{weekday}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{day.getDate()}</span>
        {state.open > 0 ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
            <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: "50%", background: state.urgent ? "var(--late)" : "currentColor", opacity: state.urgent ? 1 : 0.6 }} />
            {fit === "full" ? state.open : null}
          </span>
        ) : state.done ? (
          <Icon name="check" size={12} />
        ) : null}
      </Button>
    </div>
  );
}

type BarsProps = {
  days: Date[];
  /** One row of bars per lane, as {@link spanLanes} stacks them. */
  lanes: Plan[][];
  /** Plans in the lanes folded into "+N more". */
  hidden: number;
  onOpen: (plan: Plan, element: Element) => void;
  /** "+N more" was pressed: open the card of the first day a folded bar touches, beside the control. */
  onMore: (day: Date, element: Element) => void;
};

/**
 * All-day and multi-day plans as slim bars under the day bubbles: one bar per plan running across every day it covers as a single
 * joined shape (squared where the plan goes on past the week), stacked when several overlap. A bar has its own fill, tide for a
 * course plan and sage otherwise, dashed and muted when declined, with nothing behind the row. A bar opens its plan; rows that did
 * not fit end in one more row with a quiet "+N more", right-aligned, that opens the card of the first day they touch.
 */
function Bars({ days, lanes, hidden, onOpen, onMore }: BarsProps) {
  const { shown } = barRows(lanes);
  const folded = lanes.slice(shown.length).flat();
  return (
    <div style={{ marginTop: WEEK.bubbleToBars }}>
      {shown.map((lane, row) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: weekColumns(days.length), height: WEEK.bar, marginTop: row === 0 ? 0 : WEEK.barGap, pointerEvents: "none" }}>
          {lane.map((plan) => {
            const columns = barColumns(plan, days)!;
            const first = barEdges(plan, days[columns.from]!);
            const last = barEdges(plan, days[columns.to]!);
            const look = barLook(plan);
            const range = spanRange(plan);
            return (
              <PlanButton
                key={plan.id}
                plan={plan}
                className="ui-hover-card ui-trans"
                aria-haspopup="dialog"
                onClick={(event) => onOpen(plan, event.currentTarget)}
                title={range === null ? plan.title : `${plan.title} · ${range}`}
                style={{
                  gridColumn: `${columns.from + 2} / ${columns.to + 3}`,
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  margin: `0 ${last.after ? 0 : WEEK.inset}px 0 ${first.before ? 0 : WEEK.inset}px`,
                  padding: `0 ${WEEK.padX}px`,
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 600,
                  pointerEvents: "auto",
                  borderRadius: 8,
                  borderTopLeftRadius: first.before ? 2 : 8,
                  borderBottomLeftRadius: first.before ? 2 : 8,
                  borderTopRightRadius: last.after ? 2 : 8,
                  borderBottomRightRadius: last.after ? 2 : 8,
                  backgroundColor: "var(--glass-solid)",
                  backgroundImage: `linear-gradient(${look.background}, ${look.background})`,
                  border: look.border,
                  color: look.color,
                }}
              >
                <Truncate text={plan.title} style={{ minWidth: 0, flex: 1 }} />
              </PlanButton>
            );
          })}
        </div>
      ))}
      {hidden === 0 ? null : (
        <div style={{ display: "grid", gridTemplateColumns: weekColumns(days.length), height: WEEK.bar, marginTop: WEEK.barGap, pointerEvents: "none" }}>
          <span style={{ gridColumn: `2 / ${days.length + 2}`, justifySelf: "end", alignSelf: "center", paddingRight: WEEK.inset, pointerEvents: "auto" }}>
            <Button tone="quiet" size="xs" aria-haspopup="dialog" title={folded.map((plan) => plan.title).join(", ")} onClick={(event) => onMore(days[barColumns(folded[0]!, days)!.from]!, event.currentTarget)}>
              {`+${hidden} more`}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

export type WeekViewProps = {
  /** The seven days shown, Monday first. */
  days: Date[];
  now: Date;
  zone: string;
  /** Plans for the week: timed ones for the hours, all-day and multi-day ones for the bars. */
  plans: Plan[];
  /** The task badge per local date key; a day whose tasks have not loaded has none. */
  badges: Record<string, DayBadge | undefined>;
  selected: string | null;
  onOpen: (plan: Plan, element: Element) => void;
  /** Open a day in the Day view. */
  onDay: (day: Date) => void;
  /** "+N" or "+N more" was pressed: open that day's card beside the control. */
  onMore: (day: Date, element: Element) => void;
};

/**
 * The Week view: seven columns of hours under one scroll, running the full height of the card with whisper-faint hour lines to
 * the right edge and no boxes between days; whitespace separates them, and today carries a barely-there rounded tint. Day bubbles
 * and the all-day bars float over the top, pinned while the hours scroll under them, with no band behind them. Plans are floating
 * slabs inset from their column; the now line crosses the week, strongest in today's column, with its time in the axis. The
 * week opens one hour before its earliest plan.
 */
export function WeekView({ days, now, zone, plans, badges, selected, onOpen, onDay, onMore }: WeekViewProps) {
  const [scroller, size] = useSize<HTMLDivElement>();
  const timed = gridPlans(plans);
  const lanes = spanLanes(bandPlans(plans), days);
  const { shown, hidden } = barRows(lanes);
  const origin = weekHeadHeight(shown.length, hidden > 0);
  const column = (size.width - WEEK_LEFT - WEEK.edge) / days.length;
  const ppm = Math.max(WEEK.hour / 60, (size.height - origin - WEEK.bottom) / DAY);
  const columns = days.map((day) => segmentsOn(timed, day));
  const capped = columns.map(capLanes);
  const todayIndex = days.findIndex((day) => isSameDay(day, now));
  const nowMinute = todayIndex < 0 ? null : wallMinutes(now);
  const anchor = weekAnchor(columns, nowMinute);
  const nextId = nextPlanId(timed, now);
  const none = columns.every((column) => column.length === 0);
  const placed = useRef<number | null>(null);
  const key = days[0]!.getTime();
  useLayoutEffect(() => {
    if (size.height === 0 || placed.current === key) return;
    placed.current = key;
    scroller.current!.scrollTop = anchor * ppm;
  }, [key, size.height, anchor, ppm, scroller]);
  const template = weekColumns(days.length);
  const fade = `linear-gradient(to bottom, transparent ${origin - WEEK.headToGrid * 2}px, #000 ${origin}px)`;
  const hours = Array.from({ length: DAY / 60 + 1 }, (_, i) => i * 60);
  const edge = WEEK.edge + WEEK.axis;
  return (
    <Card aria-label="Week" style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, padding: 0, minHeight: 0, minWidth: 0 }}>
      <div style={{ position: "absolute", top: WEEK.top, left: 0, right: 0, zIndex: 6, pointerEvents: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: template, height: WEEK.bubble }}>
          <div />
          {days.map((day) => (
            <DayBubble key={day.toISOString()} day={day} now={now} badge={badges[dateKey(day)]} fit={bubbleFit(column)} onOpen={() => onDay(day)} />
          ))}
        </div>
        <Bars days={days} lanes={lanes} hidden={hidden} onOpen={onOpen} onMore={onMore} />
      </div>
      <div ref={scroller} className="scroll" style={{ flex: 1, minHeight: 0, WebkitMaskImage: fade, maskImage: fade }}>
        {none ? (
          <div style={{ position: "sticky", top: 0, height: 0, zIndex: 1, pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: WEEK_LEFT, right: WEEK.edge, top: Math.max(origin + WEEK.bottom, size.height * 0.3), display: "flex", justifyContent: "center" }}>
              <div style={{ width: 380, background: "var(--glass-solid)", borderRadius: 18, padding: "16px 8px", display: "flex" }}>
                <StateView dense kind="empty" title="Nothing planned" detail="Plans appear here as agents schedule them." />
              </div>
            </div>
          </div>
        ) : null}
        <div style={{ position: "relative", height: origin + DAY * ppm + WEEK.bottom }}>
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: origin, height: DAY * ppm, pointerEvents: "none" }}>
            {hours.map((minute) => (
              <div key={minute} style={{ position: "absolute", left: edge, right: 0, top: minute * ppm, borderTop: "1px solid color-mix(in srgb, var(--rule) 70%, transparent)" }}>
                <span style={{ position: "absolute", top: -8, left: -WEEK.axis, width: WEEK.axis, visibility: nowMinute !== null && Math.abs(nowMinute - minute) * ppm < WEEK.nowClear ? "hidden" : "visible", textAlign: "right", fontSize: 12, lineHeight: "16px", color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{hourText(minute)}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: template }}>
            <div />
            {days.map((day, index) => (
              <div key={day.toISOString()} data-day={dateKey(day)} style={{ position: "relative" }}>
                {index === todayIndex ? <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: WEEK.tint, background: "var(--sage-fill)" }} /> : null}
                {capped[index]!.shown.map((segment) => (
                  <WeekBlock key={segment.block.id} segment={segment} state={timeState(segment.block, now, nextId)} zone={zone} top={origin + segment.startMin * ppm} height={(segment.endMin - segment.startMin) * ppm} narrow={narrowColumn(column)} selected={selected === segment.block.id} more={capped[index]!.more.get(segment.block.id) ?? []} onOpen={onOpen} onMore={(element) => onMore(day, element)} />
                ))}
              </div>
            ))}
            <div />
          </div>
          {nowMinute === null ? null : (
            <>
              <div aria-hidden="true" style={{ position: "absolute", left: edge, right: 0, top: origin + nowMinute * ppm - 1, height: 2, background: "var(--sage-deep)", opacity: 0.25, zIndex: 1, pointerEvents: "none" }} />
              <div aria-hidden="true" style={{ position: "absolute", left: `calc(${WEEK_LEFT}px + (100% - ${WEEK_LEFT + WEEK.edge}px) * ${todayIndex / days.length})`, width: `calc((100% - ${WEEK_LEFT + WEEK.edge}px) / ${days.length})`, top: origin + nowMinute * ppm - 1, height: 2, background: "var(--sage-deep)", zIndex: 1, pointerEvents: "none" }} />
              <span style={{ position: "absolute", left: WEEK.edge, minWidth: WEEK.axis, top: origin + nowMinute * ppm - 12, height: 24, padding: "0 8px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--bone)", background: "var(--sage-deep)", borderRadius: 6, zIndex: 4, pointerEvents: "none" }}>
                {formatClock(now.toISOString())}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
