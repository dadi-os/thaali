import { useState } from "react";
import { Truncate } from "../../shared/ui/Truncate";
import type { Plan } from "../../types/planner";
import { barColumns, barEdges, barLook, spanLanes, spanRange } from "./plans";
import { PlanButton } from "./PlanButton";
import { AXIS_W, columnsOf } from "./TimeGrid";

/** Rows the band shows before folding the rest behind "+N more". */
const ROWS = 2;

export type AllDayBandProps = {
  /** The days the band spans, aligned with the grid below: one for Day, seven for Week. */
  days: Date[];
  /** Plans for those days; only all-day and multi-day plans are drawn. */
  plans: Plan[];
  /** Bar height in px. */
  height: number;
  onOpen: (plan: Plan, element: Element) => void;
};

/**
 * The all-day band above the time axis: a row per bar, each tinted, titled in full and, for a plan that runs several
 * days, showing its span and open ends where it continues past the shown days. Past two rows the rest fold away.
 */
export function AllDayBand({ days, plans, height, onOpen }: AllDayBandProps) {
  const [all, setAll] = useState(false);
  const lanes = spanLanes(plans, days);
  if (lanes.length === 0) {
    return null;
  }
  const shown = all ? lanes : lanes.slice(0, ROWS);
  const hidden = lanes.length - shown.length;
  const template = columnsOf(days.length);
  return (
    <div aria-label="All-day plans" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0 8px", flex: "none" }}>
      {shown.map((lane, row) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: template, alignItems: "stretch" }}>
          <span style={{ width: AXIS_W, paddingRight: 10, textAlign: "right", alignSelf: "center", fontSize: 11, fontWeight: 600, letterSpacing: 0.6, whiteSpace: "nowrap", textTransform: "uppercase", color: "var(--ink-muted)" }}>{row === 0 ? "All day" : ""}</span>
          {lane.map((plan) => {
            const columns = barColumns(plan, days)!;
            const first = barEdges(plan, days[columns.from]!);
            const last = barEdges(plan, days[columns.to]!);
            const range = spanRange(plan);
            return (
              <PlanButton
                key={plan.id}
                plan={plan}
                className="ui-hover-card ui-trans"
                aria-haspopup="dialog"
                onClick={(e) => onOpen(plan, e.currentTarget)}
                title={range === null ? plan.title : `${plan.title} · ${range}`}
                style={{
                  gridColumn: `${columns.from + 2} / ${columns.to + 3}`,
                  gridRow: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                  height,
                  margin: "0 3px",
                  padding: "0 12px",
                  textAlign: "left",
                  borderRadius: 10,
                  borderTopLeftRadius: first.before ? 3 : 10,
                  borderBottomLeftRadius: first.before ? 3 : 10,
                  borderTopRightRadius: last.after ? 3 : 10,
                  borderBottomRightRadius: last.after ? 3 : 10,
                  fontSize: height > 28 ? 14 : 13,
                  fontWeight: 600,
                  ...barLook(plan),
                }}
              >
                {first.before ? <span aria-hidden>‹</span> : null}
                <Truncate text={plan.title} style={{ minWidth: 0, flex: range === null ? 1 : "0 1 auto" }} />
                {range === null ? null : <Truncate text={range} style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 400, opacity: 0.8 }} />}
                {last.after ? <span aria-hidden style={{ marginLeft: "auto" }}>›</span> : null}
              </PlanButton>
            );
          })}
        </div>
      ))}
      {lanes.length > ROWS ? (
        <button type="button" className="ui-hover-fill ui-trans" onClick={() => setAll(!all)} style={{ alignSelf: "flex-start", marginLeft: AXIS_W + 3, padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
          {all ? "Show fewer" : `+${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}
