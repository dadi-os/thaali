import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import type { Plan } from "../../types/planner";
import { dateKey, isSameDay, startOfDay } from "./dates";
import { Truncate } from "../../shared/ui/Truncate";
import { PlanButton } from "./PlanButton";
import { bandPlans, barColumns, barEdges, barLook, gridPlans, spanLanes, spanRange } from "./plans";
import { type DayBadge } from "./tasks";
import { columnsOf, TimeGrid } from "./TimeGrid";

/** Height of the Week header line, in px, and of an all-day bar, the gap between bar rows, and the rows shown before "+N". */
const HEAD_H = 36;
const BAR_H = 22;
const BAR_GAP = 4;
const BAR_ROWS = 2;

type DayHeadProps = {
  day: Date;
  /** The ticking clock: a day that is over is quiet. */
  now: Date;
  today: boolean;
  badge: DayBadge | undefined;
  onOpen: () => void;
};

/** What a day bubble says about the day's tasks, for assistive technology. */
function describe(badge: DayBadge | undefined): string {
  if (badge === undefined) return "";
  if (badge.open === 0) return badge.allDone ? ", all tasks done" : "";
  return `, ${badge.open} open ${badge.open === 1 ? "task" : "tasks"}${badge.urgent ? ", some due" : ""}`;
}

/**
 * One day of the Week header as a small bubble on a 36 px line: "FRI 20" with the day's open tasks as a tiny dot and count. Today
 * is the filled one, a day that is over is quiet. Tapping it opens the day. The bubble has its own solid fill and nothing behind it,
 * so the hours scroll under it.
 */
function DayHead({ day, now, today, badge, onOpen }: DayHeadProps) {
  const urgent = badge !== undefined && badge.urgent && badge.open > 0;
  const over = !today && day.getTime() < startOfDay(now).getTime();
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: HEAD_H, pointerEvents: "none" }}>
      <Button
        tone={today ? "fill" : "quiet"}
        size="sm"
        pill
        onClick={onOpen}
        aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}${describe(badge)}`}
        style={{ pointerEvents: "auto", ...(today ? {} : { backgroundColor: "var(--glass-solid)", backgroundImage: "linear-gradient(var(--sage-fill), var(--sage-fill))" }), ...(over ? { color: "var(--ink-muted)" } : {}) }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>{weekday}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{day.getDate()}</span>
        {badge === undefined ? null : badge.open > 0 ? (
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: urgent ? "var(--late)" : "currentColor", opacity: urgent ? 1 : 0.6 }} />
            {badge.open}
          </span>
        ) : badge.allDone ? (
          <Icon name="check" size={11} />
        ) : null}
      </Button>
    </div>
  );
}

type BarsProps = {
  days: Date[];
  /** One row of bars per lane, as {@link spanLanes} stacks them. */
  lanes: Plan[][];
  /** Lanes past this many fold into "+N". */
  hidden: number;
  onOpen: (plan: Plan, element: Element) => void;
  onDay: (day: Date) => void;
};

/**
 * All-day and multi-day plans as slim bars under the day bubbles: one bar per plan, running across every day it covers as a
 * single joined shape (its end is squared where the plan goes on past the week), stacked when several overlap. A bar has its
 * own solid fill, tide for a course plan and sage otherwise, dashed and muted when declined, with nothing behind the row.
 * Clicking one opens that plan's card; "+N" stands for rows that did not fit and opens the first day it touches.
 */
function Bars({ days, lanes, hidden, onOpen, onDay }: BarsProps) {
  const template = columnsOf(days.length);
  const rows = lanes.slice(0, BAR_ROWS);
  const folded = lanes.slice(BAR_ROWS).flat();
  return (
    <>
      {rows.map((lane, row) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: template, height: BAR_H, marginTop: row === 0 ? 0 : BAR_GAP, pointerEvents: "none" }}>
          {row === rows.length - 1 && hidden > 0 ? (
            <span style={{ gridColumn: 1, justifySelf: "end", alignSelf: "center", paddingRight: 10, pointerEvents: "auto" }}>
              <Button tone="quiet" size="xs" title={folded.map((plan) => plan.title).join(", ")} onClick={() => onDay(days[barColumns(folded[0]!, days)!.from]!)}>
                {`+${hidden}`}
              </Button>
            </span>
          ) : null}
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
                  margin: "0 4px",
                  padding: "0 10px",
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
    </>
  );
}

export type WeekViewProps = {
  /** The seven days shown, Monday first. */
  days: Date[];
  now: Date;
  zone: string;
  /** Plans for the week: timed ones for the axis, all-day and multi-day ones for the header hairlines. */
  plans: Plan[];
  /** The task badge per local date key; a day whose tasks have not loaded has none. */
  badges: Record<string, DayBadge | undefined>;
  selected: string | null;
  onOpen: (plan: Plan, element: Element) => void;
  /** Open a day in the Day view. */
  onDay: (day: Date) => void;
};

/**
 * The Week view: the Day grid with seven columns under one scroll, running the full height of the card with its hour lines and
 * column rules to every edge. A header floats over the top of it, pinned while the hours scroll under it, with no band or
 * background: a small bubble per day and, right under them, a slim bar for each all-day or multi-day plan that joins its days.
 */
export function WeekView({ days, now, zone, plans, badges, selected, onOpen, onDay }: WeekViewProps) {
  const timed = gridPlans(plans);
  const lanes = spanLanes(bandPlans(plans), days);
  const shown = Math.min(BAR_ROWS, lanes.length);
  const hidden = lanes.slice(BAR_ROWS).reduce((count, lane) => count + lane.length, 0);
  const headHeight = HEAD_H + (shown === 0 ? 0 : shown * BAR_H + (shown - 1) * BAR_GAP + 6);
  const head = (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: columnsOf(days.length), pointerEvents: "none" }}>
        <div />
        {days.map((day) => (
          <DayHead key={day.toISOString()} day={day} now={now} today={isSameDay(day, now)} badge={badges[dateKey(day)]} onOpen={() => onDay(day)} />
        ))}
      </div>
      <Bars days={days} lanes={lanes} hidden={hidden} onOpen={onOpen} onDay={onDay} />
    </div>
  );
  return (
    <Card aria-label="Week" style={{ flex: 1, padding: 0, minHeight: 0, minWidth: 0 }}>
      <TimeGrid days={days} plans={timed} now={now} zone={zone} selected={selected} onOpen={onOpen} head={head} headHeight={headHeight} jump={false} hourPx={64} />
    </Card>
  );
}
