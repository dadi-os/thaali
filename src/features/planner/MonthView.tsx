import { Icon } from "../../shared/ui/Icon";
import { Truncate } from "../../shared/ui/Truncate";
import type { Plan } from "../../types/planner";
import { dateKey, isSameDay, isSameMonth } from "./dates";
import { PlanButton } from "./PlanButton";
import { barEdges, barLook, monthTile, planTone, runsAsBar } from "./plans";
import type { MonthBadge } from "./tasks";

/** Plans a tile lists before "+N more". */
const TILE_PLANS = 3;

type BadgeProps = {
  badge: MonthBadge;
};

/** A tile's task badge: how many tasks close that day, a clay dot when one is past due, a quiet check when all are done. */
function Badge({ badge }: BadgeProps) {
  if (badge.closing === 0) {
    return null;
  }
  const label = badge.allDone ? "All tasks done" : `${badge.closing} ${badge.closing === 1 ? "task closes" : "tasks close"}${badge.pastDue ? ", one past due" : ""}`;
  return (
    <span aria-label={label} title={label} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 16, fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink-muted)" }}>
      {badge.allDone ? (
        <span style={{ display: "flex", color: "var(--sage-deep)" }}>
          <Icon name="check" size={10} />
        </span>
      ) : (
        <>
          {badge.pastDue ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--late)" }} /> : null}
          {badge.closing}
        </>
      )}
    </span>
  );
}

export type MonthViewProps = {
  /** The grid's days in display order, whole weeks. */
  days: Date[];
  now: Date;
  /** Any day of the month shown; days outside it fade. */
  anchor: Date;
  /** The `month` view's plans for the grid's range. */
  plans: Plan[];
  /** The task badge per local date key; a day whose tasks have not loaded has none. */
  badges: Record<string, MonthBadge | undefined>;
  onOpen: (plan: Plan, element: Element) => void;
  /** Open a day in the Day view. */
  onDay: (day: Date) => void;
  /** "+N more" was pressed: open the day's card beside the chosen control. */
  onMore: (day: Date, element: Element) => void;
};

/** The Month grid: a tile per day with up to three plans, "+N more", and a task badge. A tile opens its day. */
export function MonthView({ days, now, anchor, plans, badges, onOpen, onDay, onMore }: MonthViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6, minWidth: 0, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {days.slice(0, 7).map((day) => (
          <span key={day.toISOString()} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", letterSpacing: 1 }}>
            {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gridTemplateRows: `repeat(${days.length / 7},minmax(0,1fr))`, gap: 6 }}>
        {days.map((day) => {
          const { shown, more } = monthTile(plans, day, TILE_PLANS);
          const today = isSameDay(day, now);
          const badge = badges[dateKey(day)];
          return (
            <div
              key={day.toISOString()}
              style={{ display: "flex", flexDirection: "column", gap: 3, padding: 7, borderRadius: 12, background: today ? "var(--bone-95)" : "var(--glass-veil)", border: `1px solid ${today ? "var(--sage-deep)" : "var(--glass-border)"}`, opacity: isSameMonth(day, anchor) ? 1 : 0.55, minWidth: 0, overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => onDay(day)} aria-label={`Show ${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}`} style={{ textAlign: "left", fontSize: 13, fontWeight: 600, color: today ? "var(--sage-deep)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                  {day.getDate()}
                </button>
                <span style={{ flex: 1 }} />
                {badge === undefined ? null : <Badge badge={badge} />}
              </div>
              {shown.map((plan) => {
                if (!runsAsBar(plan)) {
                  return (
                    <PlanButton key={plan.id} plan={plan} aria-haspopup="dialog" onClick={(e) => onOpen(plan, e.currentTarget)} style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, textAlign: "left" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: planTone(plan), flex: "none" }} />
                      <Truncate text={plan.title} style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink-muted)" }} />
                    </PlanButton>
                  );
                }
                const edge = barEdges(plan, day);
                return (
                  <PlanButton
                    key={plan.id}
                    plan={plan}
                    aria-haspopup="dialog"
                    onClick={(e) => onOpen(plan, e.currentTarget)}
                    title={plan.title}
                    style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, height: 18, padding: "0 6px", margin: `0 ${edge.after ? -8 : 0}px 0 ${edge.before ? -8 : 0}px`, textAlign: "left", fontSize: 12, fontWeight: 600, borderRadius: 6, borderTopLeftRadius: edge.before ? 0 : 6, borderBottomLeftRadius: edge.before ? 0 : 6, borderTopRightRadius: edge.after ? 0 : 6, borderBottomRightRadius: edge.after ? 0 : 6, ...barLook(plan) }}
                  >
                    <Truncate text={plan.title} style={{ flex: 1, minWidth: 0 }} />
                  </PlanButton>
                );
              })}
              {more > 0 ? (
                <button type="button" aria-haspopup="dialog" className="ui-hover-fill ui-trans" onClick={(e) => onMore(day, e.currentTarget)} style={{ fontSize: 12, color: "var(--ink-muted)", textAlign: "left", borderRadius: 6, padding: "0 4px", margin: "0 -4px" }}>
                  {`+${more} more`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
