import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import type { Plan } from "../../types/planner";
import { dateKey, isSameDay, startOfDay } from "./dates";
import { AllDayBand } from "./AllDayBand";
import { bandPlans, gridPlans } from "./plans";
import { type DayBadge } from "./tasks";
import { columnsOf, TimeGrid } from "./TimeGrid";

type BubbleProps = {
  day: Date;
  /** The ticking clock: only a day that is over or today is tinted for what is due. */
  now: Date;
  today: boolean;
  badge: DayBadge | undefined;
  onOpen: () => void;
};

/** What a bubble says about the day's tasks, for assistive technology. */
function describe(badge: DayBadge | undefined): string {
  if (badge === undefined) return "";
  if (badge.open === 0) return badge.allDone ? ", all tasks done" : "";
  return `, ${badge.open} open ${badge.open === 1 ? "task" : "tasks"}${badge.urgent ? ", some due" : ""}`;
}

/**
 * One day of the Week header as a bubble: a rounded, softly tinted pill with the weekday in small caps over the date, and the
 * day's tasks as a tiny dot and count along its foot (a check when all are done; the dot is rose-clay when something closes that
 * day or is past due). A day that is over is dimmed, today is the one strong filled bubble, lifted a little. Tapping it opens the day.
 */
function Bubble({ day, now, today, badge, onOpen }: BubbleProps) {
  const urgent = badge !== undefined && badge.urgent && badge.open > 0;
  const over = !today && day.getTime() < startOfDay(now).getTime();
  const ink = today ? "var(--today-ink)" : over ? "var(--ink-muted)" : "var(--ink)";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}${describe(badge)}`}
      className={`ui-trans active:scale-[0.97] ${today ? "ui-hover-today" : "ui-hover-fill"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: 0,
        margin: "8px 4px 10px",
        padding: "9px 4px 8px",
        borderRadius: 22,
        background: today ? "var(--today)" : "var(--sage-fill)",
        color: ink,
        opacity: over ? 0.72 : 1,
        boxShadow: today ? "0 6px 16px rgba(92, 107, 82, 0.28)" : "none",
        transform: today ? "translateY(-2px)" : undefined,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", opacity: today ? 0.85 : 1 }}>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}</span>
      <span style={{ fontSize: 20, lineHeight: "26px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{day.getDate()}</span>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, height: 16, fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {badge === undefined ? null : badge.open > 0 ? (
          <>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: urgent ? "var(--late)" : "currentColor", opacity: urgent ? 1 : 0.6 }} />
            {badge.open}
          </>
        ) : badge.allDone ? (
          <Icon name="check" size={12} />
        ) : null}
      </span>
    </button>
  );
}

export type WeekViewProps = {
  /** The seven days shown, Monday first. */
  days: Date[];
  now: Date;
  zone: string;
  /** Plans for the week: timed ones for the axis, all-day and multi-day ones for the band. */
  plans: Plan[];
  /** The task badge per local date key; a day whose tasks have not loaded has none. */
  badges: Record<string, DayBadge | undefined>;
  selected: string | null;
  onOpen: (plan: Plan, element: Element) => void;
  /** Open a day in the Day view. */
  onDay: (day: Date) => void;
};

/**
 * The Week view: the Day grid with seven columns under one scroll, headed by a bubble per day and, under them, the all-day
 * band. The header stays in view while the hours scroll.
 */
export function WeekView({ days, now, zone, plans, badges, selected, onOpen, onDay }: WeekViewProps) {
  const timed = gridPlans(plans);
  const head = (
    <div style={{ background: "var(--glass-solid)", borderBottom: "1px solid var(--rule)", flex: "none" }}>
      <div style={{ display: "grid", gridTemplateColumns: columnsOf(days.length) }}>
        <div />
        {days.map((day) => (
          <Bubble key={day.toISOString()} day={day} now={now} today={isSameDay(day, now)} badge={badges[dateKey(day)]} onOpen={() => onDay(day)} />
        ))}
      </div>
      <AllDayBand days={days} plans={bandPlans(plans)} height={26} onOpen={onOpen} />
    </div>
  );
  return (
    <Card aria-label="Week" style={{ flex: 1, padding: "0 14px 14px", minHeight: 0, minWidth: 0 }}>
      <TimeGrid days={days} plans={timed} now={now} zone={zone} selected={selected} onOpen={onOpen} head={head} />
    </Card>
  );
}
