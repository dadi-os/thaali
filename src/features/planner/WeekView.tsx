import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import type { Plan } from "../../types/planner";
import { dateKey, isSameDay } from "./dates";
import { AllDayBand } from "./AllDayBand";
import { type DayBadge } from "./tasks";
import { columnsOf, TimeGrid } from "./TimeGrid";

type BadgeProps = {
  badge: DayBadge;
  onClick: () => void;
};

/** A day header's tiny task badge: the open count in clay when something closes that day or is past due, quiet otherwise. */
function Badge({ badge, onClick }: BadgeProps) {
  if (badge.open === 0 && !badge.allDone) {
    return null;
  }
  const clay = badge.urgent && badge.open > 0;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={badge.open === 0 ? "All tasks done" : `${badge.open} open ${badge.open === 1 ? "task" : "tasks"}`}
      className="ui-trans"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 20, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", background: clay ? "var(--late-fill)" : "var(--sage-fill)", color: clay ? "var(--late-ink)" : "var(--ink-muted)" }}
    >
      {badge.open === 0 ? <Icon name="check" size={11} /> : badge.open}
    </button>
  );
}

export type WeekViewProps = {
  /** The seven days shown, Monday first. */
  days: Date[];
  now: Date;
  zone: string;
  /** Plans for the week: timed ones for the axis, all-day and multi-day ones for the span row. */
  plans: Plan[];
  /** The task badge per local date key; a day whose tasks have not loaded has none. */
  badges: Record<string, DayBadge | undefined>;
  selected: string | null;
  onOpen: (plan: Plan, element: Element) => void;
  /** Open a day in the Day view. */
  onDay: (day: Date) => void;
};

/**
 * The Week view: the Day grid with seven columns under one scroll. Day headers carry the weekday, the date and a tiny
 * task badge and open that day; all-day and multi-day plans run along the top as bars.
 */
export function WeekView({ days, now, zone, plans, badges, selected, onOpen, onDay }: WeekViewProps) {
  const timed = plans.filter((plan) => !plan.all_day && plan.end_at !== null);
  const head = (
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--glass-solid)", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "grid", gridTemplateColumns: columnsOf(days.length) }}>
        <div />
        {days.map((day) => {
          const today = isSameDay(day, now);
          const badge = badges[dateKey(day)];
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              aria-label={`Show ${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}`}
              className="ui-hover-fill ui-trans"
              onClick={() => onDay(day)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onDay(day) : undefined)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px 8px", borderRadius: 10, cursor: "pointer", minWidth: 0 }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", color: today ? "var(--sage-deep)" : "var(--ink-muted)" }}>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center", height: 30 }}>
                <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: today ? "var(--bone)" : "var(--ink)", background: today ? "var(--sage-deep)" : "transparent", borderRadius: 999, minWidth: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{day.getDate()}</span>
                {badge === undefined ? null : (
                  <span style={{ position: "absolute", left: "100%", marginLeft: 5 }}>
                    <Badge badge={badge} onClick={() => onDay(day)} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <AllDayBand days={days} plans={plans} height={26} onOpen={onOpen} />
    </div>
  );
  return (
    <Card aria-label="Week" style={{ flex: 1, padding: "0 14px 14px", minHeight: 0, minWidth: 0 }}>
      <TimeGrid days={days} plans={timed} now={now} zone={zone} selected={selected} onOpen={onOpen} head={head} />
    </Card>
  );
}
