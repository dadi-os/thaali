import type { CSSProperties } from "react";
import { Icon } from "../../shared/ui/Icon";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Truncate } from "../../shared/ui/Truncate";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { addDays, isSameDay, startOfDay, wallMinutes } from "./dates";
import { PlanButton } from "./PlanButton";
import { itemKey, planTone } from "./plans";
import { segmentsOn } from "./planner/blocks";
import { NeedsTimeCard } from "./NeedsTimeCard";
import { clockChange, plannedClock } from "./zones";

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
  /** Device IANA zone; session zones remain unchanged. */
  zone: string;
  /** This day's sessions and deadlines. */
  items: TimelineItem[];
  /** Occurrence key of the session whose details are open. */
  selected: string | null;
  /** Show the side column when the measured page can accommodate it. */
  wide: boolean;
  /** Open a session's details under the chosen control. */
  onOpen: (item: TimelineItem, element: Element) => void;
  /** Open the Needs a time sheet. */
  onNeedsTime: () => void;
};

/** A day's wall-clock axis, with overlap lanes, clock-change bands, deadlines and an instant-based now/next summary. */
export function CalendarDay({
  day,
  now,
  zone,
  items,
  selected,
  wide,
  onOpen,
  onNeedsTime,
}: CalendarDayProps) {
  const start = startOfDay(day);
  const change = clockChange(start, addDays(start, 1), zone);
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
    ...dues.map((i) => wallMinutes(new Date(i.due_at!))),
    ...(nowMinute === null ? [] : [nowMinute]),
  ];
  const lo =
    change !== null || minutes.length === 0
      ? 0
      : Math.max(0, Math.floor((Math.min(...minutes) - 60) / 60) * 60);
  const hi =
    change !== null || minutes.length === 0
      ? 1440
      : Math.min(1440, Math.ceil((Math.max(...minutes) + 60) / 60) * 60);
  const hours = Array.from(
    { length: (hi - lo) / 60 + 1 },
    (_, i) => lo + i * 60,
  );
  const hourText = (min: number) =>
    `${Math.floor(min / 60) % 12 || 12} ${min >= 720 && min < 1440 ? "PM" : "AM"}`;
  const top = (minute: number) => (minute - lo) * PPM;
  const current = timed.find(
    (i) =>
      i.state !== "cancelled" &&
      Date.parse(i.start_at!) <= now.getTime() &&
      i.end_at !== null &&
      Date.parse(i.end_at) > now.getTime(),
  );
  const next = [...timed]
    .filter(
      (i) => i.state !== "cancelled" && Date.parse(i.start_at!) > now.getTime(),
    )
    .sort((a, b) => Date.parse(a.start_at!) - Date.parse(b.start_at!))[0];
  const duration = (i: TimelineItem) =>
    i.end_at === null
      ? 0
      : (Date.parse(i.end_at) - Date.parse(i.start_at!)) / 60_000;
  const own = segments.map((s) => s.block);
  const total = own.reduce((sum, i) => sum + duration(i), 0);
  const done = own
    .filter((i) => i.outcome === "done")
    .reduce((sum, i) => sum + duration(i), 0);
  const span = (min: number) =>
    `${Math.floor(min / 60) ? `${Math.floor(min / 60)} h ` : ""}${Math.round(min % 60) ? `${Math.round(min % 60)} min` : ""}`.trim() ||
    "0 min";
  const label: CSSProperties = {
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: "0.005em",
    color: "var(--ink-muted)",
    lineHeight: "16px",
  };
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        gap: 16,
        minWidth: 0,
        minHeight: 0,
        alignItems: "stretch",
      }}
    >
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
                    color:
                      change !== null && change.minute === m
                        ? change.kind === "spring"
                          ? "var(--due-ink)"
                          : "#2b4450"
                        : "var(--ink-muted)",
                    fontWeight: change?.minute === m ? 600 : 400,
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
            {change !== null && change.minute >= lo && change.minute < hi ? (
              <div
                style={{
                  position: "absolute",
                  left: 62,
                  right: 8,
                  top: top(change.minute),
                  height: change.duration * PPM,
                  borderRadius: 10,
                  background:
                    change.kind === "spring"
                      ? "repeating-linear-gradient(135deg, rgba(184,154,99,.16) 0 8px, rgba(184,154,99,.04) 8px 16px)"
                      : "rgba(125,154,166,.10)",
                  border: `1px dashed ${change.kind === "spring" ? "var(--due-line)" : "rgba(125,154,166,.5)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    change.kind === "spring" ? "var(--due-ink)" : "#2b4450",
                }}
              >
                {change.kind === "spring"
                  ? `${hourText(change.minute)} is skipped: ${change.from} becomes ${change.to}`
                  : `${hourText(change.minute)} happens twice: ${change.from}, then ${change.to}`}
              </div>
            ) : null}
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
                ({ block: item, startMin, endMin, lane, lanes }) => {
                  const height = Math.max(32, (endMin - startMin) * PPM - 3);
                  const there = plannedClock(item, zone);
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
                      title={`${item.title} · ${formatClock(item.start_at!)} – ${formatClock(item.end_at!)}${there === null ? "" : ` (${there})`}`}
                      style={{
                        position: "absolute",
                        left:
                          lanes === 1
                            ? 8
                            : `calc(${(lane / lanes) * 100}% + 8px)`,
                        right: lanes === 1 ? 8 : undefined,
                        width:
                          lanes === 1
                            ? undefined
                            : `calc(${100 / lanes}% - 16px)`,
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
                      {height >= 62 && there !== null ? (
                        <Truncate
                          text={there}
                          style={{
                            fontSize: 12,
                            color: "var(--ink-muted)",
                            paddingLeft: 17,
                            fontFamily: "var(--font-mono)",
                          }}
                        />
                      ) : null}
                    </PlanButton>
                  );
                },
              )}
              {dues.map((item) => (
                <button
                  key={itemKey(item)}
                  type="button"
                  className="ui-trans ui-hover-fill"
                  onClick={(e) => onOpen(item, e.currentTarget)}
                  style={{
                    position: "absolute",
                    left: 8,
                    right: 8,
                    top: top(wallMinutes(new Date(item.due_at!))),
                    borderTop: "2px solid var(--clay)",
                    fontSize: 12,
                    color: "var(--due-ink)",
                    textAlign: "right",
                    zIndex: 3,
                  }}
                >
                  <Truncate
                    text={`Due ${formatClock(item.due_at!)} · ${item.title}`}
                  />
                </button>
              ))}
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
      {wide ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 300,
            flex: "none",
            gap: 12,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <Card style={{ padding: 16, minWidth: 0, flex: "none", gap: 10 }}>
            <span style={label}>Now</span>
            {current === undefined ? (
              <span style={{ fontSize: 14, color: "var(--ink-muted)" }}>
                Nothing right now.
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => onOpen(current, e.currentTarget)}
                  style={{ textAlign: "left", fontSize: 17, fontWeight: 600 }}
                >
                  {current.title}
                </button>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  {`${formatClock(current.start_at!)} – ${formatClock(current.end_at!)}`}
                </span>
                <div
                  style={{
                    height: 6,
                    borderRadius: 4,
                    background: "var(--rule)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${((now.getTime() - Date.parse(current.start_at!)) / (Date.parse(current.end_at!) - Date.parse(current.start_at!))) * 100}%`,
                      background: "var(--sage-deep)",
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  {Math.round(
                    (Date.parse(current.end_at!) - now.getTime()) / 60_000,
                  )}{" "}
                  min left
                </span>
              </>
            )}
          </Card>
          {next === undefined ? null : (
            <Card style={{ padding: 16, minWidth: 0, flex: "none", gap: 8 }}>
              <span style={label}>Next</span>
              <button
                type="button"
                onClick={(e) => onOpen(next, e.currentTarget)}
                style={{ textAlign: "left", fontSize: 17, fontWeight: 600 }}
              >
                {next.title}
              </button>
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                {formatClock(next.start_at!)} · in{" "}
                {span(
                  Math.round(
                    (Date.parse(next.start_at!) - now.getTime()) / 60_000,
                  ),
                )}
              </span>
            </Card>
          )}
          <Card style={{ padding: 16, minWidth: 0, flex: "none", gap: 10 }}>
            <span style={label}>The day</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {own.filter((i) => i.state !== "cancelled").length} sessions ·{" "}
              {span(Math.round(total))}
            </span>
            <div
              style={{
                height: 6,
                borderRadius: 4,
                background: "var(--rule)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${total ? (done / total) * 100 : 0}%`,
                  background: "var(--sage)",
                }}
              />
            </div>
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              {span(Math.round(done))} done
            </span>
          </Card>
          <NeedsTimeCard onOpen={onNeedsTime} />
        </div>
      ) : null}
    </div>
  );
}
