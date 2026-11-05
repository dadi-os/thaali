import type { CSSProperties } from "react";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { isSameDay, isSameMonth } from "./dates";
import { PlanButton } from "./PlanButton";
import { itemKey, plansOn, planTone } from "./plans";

const SHEET: CSSProperties = {
  background: "var(--bone-raised)",
  border: "1px solid var(--rule)",
  boxShadow: "0 1px 2px rgba(44,48,42,.06)",
};
const QUIET = new Set(["study", "focus", "meal", "shower"]);

export type CalendarViewsProps = {
  /** Calendar dates in the view's display order. */
  days: Date[];
  /** Device clock; identifies today. */
  now: Date;
  /** Sessions and deadlines returned for the visible range. */
  items: TimelineItem[];
  /** Open the chosen occurrence without navigating away from the view. */
  onOpen: (item: TimelineItem, element: Element) => void;
};

/** Seven independently scrolling day columns; all-day, spanning and due-only plans remain selectable. */
export function CalendarWeek({ days, now, items, onOpen }: CalendarViewsProps) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        gap: 8,
        minWidth: 0,
        alignItems: "stretch",
        minHeight: 0,
      }}
    >
      {days.map((day) => {
        const today = isSameDay(day, now);
        const own = plansOn(items, day);
        return (
          <div
            key={day.toISOString()}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 8,
              padding: 10,
              borderRadius: 16,
              background: today ? "rgba(250,250,247,.95)" : "var(--glass-veil)",
              border: `1px solid ${today ? "var(--sage-deep)" : "var(--glass-border)"}`,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 32,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: today ? "var(--sage-deep)" : "var(--ink-muted)",
                  fontWeight: 600,
                }}
              >
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "short",
                }).format(day)}
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  marginLeft: "auto",
                  fontVariantNumeric: "tabular-nums",
                  color: today ? "var(--sage-deep)" : "var(--ink)",
                }}
              >
                {day.getDate()}
              </span>
            </div>
            <div
              className="scroll"
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {own.map((item) => {
                const ended =
                  item.outcome === "done" || item.state === "cancelled";
                return (
                  <PlanButton
                    key={itemKey(item)}
                    item={item}
                    className="ui-hover-card ui-trans"
                    onClick={(e) => onOpen(item, e.currentTarget)}
                    title={item.title}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: "none",
                      gap: 2,
                      padding: "7px 9px",
                      borderRadius: 12,
                      ...SHEET,
                      textAlign: "left",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: planTone(item),
                          flex: "none",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color:
                            item.start_at === null && item.due_at !== null
                              ? "var(--due-ink)"
                              : "var(--ink-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.all_day
                          ? "All day"
                          : item.start_at !== null
                            ? formatClock(item.start_at)
                            : item.due_at !== null
                              ? `due ${formatClock(item.due_at)}`
                              : "Unscheduled"}
                      </span>
                    </div>
                    <Clamp
                      text={item.title}
                      lines={2}
                      style={{
                        fontSize: 13,
                        fontWeight:
                          item.kind !== null && QUIET.has(item.kind)
                            ? 500
                            : 600,
                        lineHeight: "16px",
                        textDecoration: ended ? "line-through" : "none",
                        color: ended ? "var(--ink-muted)" : "var(--ink)",
                      }}
                    />
                    {item.outcome === "missed" ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--error)",
                        }}
                      >
                        missed
                      </span>
                    ) : null}
                  </PlanButton>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type CalendarMonthProps = CalendarViewsProps & {
  anchor: Date;
  /** Open an overflowing date as a Day view, with every session accessible. */
  onDay: (day: Date) => void;
};

/** A month grid with three selectable sessions per date and a day link for overflow. */
export function CalendarMonth({
  days,
  now,
  items,
  anchor,
  onOpen,
  onDay,
}: CalendarMonthProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        gap: 6,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {days.slice(0, 7).map((day) => (
          <span
            key={day.toISOString()}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-muted)",
              letterSpacing: 1,
            }}
          >
            {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
              day,
            )}
          </span>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(7,minmax(0,1fr))",
          gridTemplateRows: `repeat(${days.length / 7},minmax(0,1fr))`,
          gap: 6,
        }}
      >
        {days.map((day) => {
          const own = plansOn(items, day);
          const today = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                padding: 7,
                borderRadius: 12,
                background: today
                  ? "rgba(250,250,247,.95)"
                  : "var(--glass-veil)",
                border: `1px solid ${today ? "var(--sage-deep)" : "var(--glass-border)"}`,
                opacity: isSameMonth(day, anchor) ? 1 : 0.55,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => onDay(day)}
                aria-label={`Show ${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}`}
                style={{
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 600,
                  color: today ? "var(--sage-deep)" : "var(--ink)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {day.getDate()}
              </button>
              {own.slice(0, 3).map((item) => (
                <PlanButton
                  key={itemKey(item)}
                  item={item}
                  onClick={(e) => onOpen(item, e.currentTarget)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    minWidth: 0,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: planTone(item),
                      flex: "none",
                    }}
                  />
                  <Truncate
                    text={item.title}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      color: "var(--ink-muted)",
                    }}
                  />
                </PlanButton>
              ))}
              {own.length > 3 ? (
                <button
                  type="button"
                  onClick={() => onDay(day)}
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    textAlign: "left",
                  }}
                >
                  {`+${own.length - 3} more`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
