import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import type { Plan } from "../../types/planner";
import { dateKey, isSameDay, startOfDay } from "./dates";
import { allDayMarks, gridPlans, type AllDayMark } from "./plans";
import { type DayBadge } from "./tasks";
import { columnsOf, TimeGrid } from "./TimeGrid";

/** Height of the Week header line, in px. */
const HEAD_H = 36;

type DayHeadProps = {
  day: Date;
  /** The ticking clock: a day that is over is quiet. */
  now: Date;
  today: boolean;
  badge: DayBadge | undefined;
  /** All-day and multi-day plans on this day, drawn as a hairline along the foot of the header. */
  mark: AllDayMark | null;
  onOpen: () => void;
};

/** What a day header says about the day's tasks and all-day plans, for assistive technology. */
function describe(badge: DayBadge | undefined, mark: AllDayMark | null): string {
  const tasks = badge === undefined ? "" : badge.open === 0 ? (badge.allDone ? ", all tasks done" : "") : `, ${badge.open} open ${badge.open === 1 ? "task" : "tasks"}${badge.urgent ? ", some due" : ""}`;
  return `${tasks}${mark === null ? "" : `, all day: ${mark.titles.join(", ")}`}`;
}

/**
 * One day of the Week header as a single compact line: "FRI 20" with the day's open tasks as a tiny dot and count, as a small
 * button that opens the day. Today is the filled one, a day that is over is quiet. An all-day or multi-day plan shows as a
 * hairline along the foot of the cell, running on across the days a plan spans, with its title on hover; the Day view lists it.
 */
function DayHead({ day, now, today, badge, mark, onOpen }: DayHeadProps) {
  const urgent = badge !== undefined && badge.urgent && badge.open > 0;
  const over = !today && day.getTime() < startOfDay(now).getTime();
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: HEAD_H }} title={mark === null ? undefined : `All day: ${mark.titles.join(", ")}`}>
      <Button tone={today ? "fill" : "quiet"} size="sm" pill onClick={onOpen} aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}${describe(badge, mark)}`} style={over ? { color: "var(--ink-muted)" } : undefined}>
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
      {mark === null ? null : (
        <span aria-hidden="true" style={{ position: "absolute", bottom: 0, left: mark.fromPrev ? 0 : 10, right: mark.toNext ? 0 : 10, height: 3, borderRadius: 2, background: "var(--sage-line)" }} />
      )}
    </div>
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
 * The Week view: the Day grid with seven columns under one scroll, headed by one compact line per day. The grid runs to the
 * card's edges and the header stays in view while the hours scroll; there is no all-day row, so the hours take the room.
 */
export function WeekView({ days, now, zone, plans, badges, selected, onOpen, onDay }: WeekViewProps) {
  const timed = gridPlans(plans);
  const marks = allDayMarks(plans, days);
  const head = (
    <div style={{ background: "var(--glass-solid)", borderBottom: "1px solid var(--rule)", flex: "none", display: "grid", gridTemplateColumns: columnsOf(days.length) }}>
      <div />
      {days.map((day, index) => (
        <DayHead key={day.toISOString()} day={day} now={now} today={isSameDay(day, now)} badge={badges[dateKey(day)]} mark={marks[index]!} onOpen={() => onDay(day)} />
      ))}
    </div>
  );
  return (
    <Card aria-label="Week" style={{ flex: 1, padding: 0, minHeight: 0, minWidth: 0 }}>
      <TimeGrid days={days} plans={timed} now={now} zone={zone} selected={selected} onOpen={onOpen} head={head} jump={false} hourPx={64} />
    </Card>
  );
}
