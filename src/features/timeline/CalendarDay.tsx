import type { CSSProperties } from "react";
import { Icon } from "../../shared/ui/Icon";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Truncate } from "../../shared/ui/Truncate";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { isSameDay, wallMinutes } from "./dates";
import { DayRail } from "./DayRail";
import { DuePanel } from "./DuePanel";
import { PlanButton } from "./PlanButton";
import { itemKey, planTone } from "./plans";
import { segmentsOn } from "./planner/blocks";

const PPM = 56 / 60;
const SHEET: CSSProperties = {
  background: "var(--bone-raised)",
  border: "1px solid var(--rule)",
  boxShadow: "0 1px 2px rgba(44,48,42,.06)",
};
const QUIET = new Set(["study", "focus", "meal", "shower"]);

export type CalendarDayProps = {
  /** Local calendar day being displayed. */
  day: Date;
  /** Real instant used for progress and the now line. */
  now: Date;
  /** This day's sessions and deadlines. */
  items: TimelineItem[];
  /** Occurrence key of the session whose details are open. */
  selected: string | null;
  /** Show the side column when the measured page can accommodate it. */
  wide: boolean;
  /** Open a session's details under the chosen control. */
  onOpen: (item: TimelineItem, element: Element) => void;
};

/** A day's wall-clock axis with overlap lanes, beside the rail of now, next and due cards, which scrolls on its own. */
export function CalendarDay({
  day,
  now,
  items,
  selected,
  wide,
  onOpen,
}: CalendarDayProps) {
  const timed = items.filter(
    (item) => !item.hide_from_planner && item.start_at !== null,
  );
  const segments = segmentsOn(timed, day);
  const dues = items.filter(
    (item) =>
      !item.hide_from_planner &&
      item.start_at === null &&
      item.due_at !== null &&
      isSameDay(new Date(item.due_at), day),
  );
  const nowMinute = isSameDay(day, now) ? wallMinutes(now) : null;
  const minutes = [
    ...segments.flatMap((s) => [s.startMin, s.endMin]),
    ...(nowMinute === null ? [] : [nowMinute]),
  ];
  const lo =
    minutes.length === 0
      ? 0
      : Math.max(0, Math.floor((Math.min(...minutes) - 60) / 60) * 60);
  const hi =
    minutes.length === 0
      ? 1440
      : Math.min(1440, Math.ceil((Math.max(...minutes) + 60) / 60) * 60);
  const hours = Array.from(
    { length: (hi - lo) / 60 + 1 },
    (_, i) => lo + i * 60,
  );
  const hourText = (min: number) =>
    `${Math.floor(min / 60) % 12 || 12} ${min >= 720 && min < 1440 ? "PM" : "AM"}`;
  const top = (minute: number) => (minute - lo) * PPM;
  const heights = segments.map((s) => Math.max(32, (s.endMin - s.startMin) * PPM - 3));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: wide ? "row" : "column",
        flex: 1,
        gap: wide ? 16 : 12,
        minWidth: 0,
        minHeight: 0,
        alignItems: "stretch",
      }}
    >
      {wide ? null : <DuePanel items={dues} now={now} selected={selected} onOpen={onOpen} docked={false} />}
      <Card
        style={{ flex: 1, padding: "4px 14px 14px", minHeight: 0, minWidth: 0 }}
      >
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          <div
            style={{
              position: "relative",
              height: (hi - lo) * PPM + 24,
              marginTop: 12,
            }}
          >
            {hours.map((m) => (
              <div
                key={m}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: top(m),
                  borderTop: "1px solid var(--rule)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    left: 0,
                    background: "transparent",
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    width: 56,
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
            <div
              style={{
                position: "absolute",
                left: 62,
                right: 0,
                top: 0,
                bottom: 0,
                zIndex: 2,
              }}
            >
              {segments.map(
                ({ block: item, startMin, lane, lanes }, index) => {
                  const height = heights[index]!;
                  const ended =
                    item.state === "cancelled" || item.outcome === "done";
                  return (
                    <PlanButton
                      key={itemKey(item)}
                      item={item}
                      className="ui-hover-card ui-trans"
                      aria-haspopup="menu"
                      aria-expanded={selected === itemKey(item)}
                      onClick={(e) => onOpen(item, e.currentTarget)}
                      title={`${item.title} · ${formatClock(item.start_at!)} – ${formatClock(item.end_at!)}`}
                      style={{
                        position: "absolute",
                        left: lanes === 1 ? 8 : `calc(100% * ${lane / lanes} + 8px)`,
                        right: lanes === 1 ? 8 : undefined,
                        width: lanes === 1 ? undefined : `calc(100% / ${lanes} - 16px)`,
                        top: top(startMin),
                        height,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        padding: "5px 14px",
                        borderRadius: 14,
                        ...SHEET,
                        zIndex: 2,
                        color: "var(--ink)",
                        ...(selected === itemKey(item)
                          ? { border: "1px solid var(--sage-deep)" }
                          : {}),
                        overflow: "hidden",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          minHeight: 20,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
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
                            fontSize: 14,
                            fontWeight:
                              item.kind !== null && QUIET.has(item.kind)
                                ? 500
                                : 600,
                            textDecoration: ended ? "line-through" : "none",
                            color: ended ? "var(--ink-muted)" : "var(--ink)",
                          }}
                        />
                        {item.outcome === "done" ? (
                          <span
                            style={{
                              display: "flex",
                              color: "var(--sage-deep)",
                            }}
                          >
                            <Icon name="check" size={14} />
                          </span>
                        ) : item.outcome === "missed" ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--error)",
                            }}
                          >
                            missed
                          </span>
                        ) : null}
                      </div>
                      {height >= 44 ? (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--ink-muted)",
                            whiteSpace: "nowrap",
                            paddingLeft: 17,
                          }}
                        >
                          {`${formatClock(item.start_at!)} – ${formatClock(item.end_at!)}`}
                        </span>
                      ) : null}
                    </PlanButton>
                  );
                },
              )}
            </div>
            {nowMinute !== null && nowMinute >= lo && nowMinute <= hi ? (
              <div
                style={{
                  position: "absolute",
                  left: 50,
                  right: 0,
                  top: top(nowMinute),
                  height: 2,
                  background: "var(--sage-deep)",
                  zIndex: 3,
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: -2,
                    top: -4,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--sage-deep)",
                  }}
                />
                <span style={{ position: "absolute", right: 8, top: -11 }}>
                  <Chip tone="solid">{formatClock(now.toISOString())}</Chip>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
      {wide ? <DayRail sessions={segments.map((segment) => segment.block)} dues={dues} now={now} selected={selected} onOpen={onOpen} /> : null}
    </div>
  );
}
