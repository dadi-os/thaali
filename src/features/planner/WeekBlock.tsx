import type { CSSProperties } from "react";
import { Button } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import { formatClock } from "../../shared/lib/ux/time";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import type { Plan } from "../../types/planner";
import { formatRange, type Segment } from "./layout";
import { PlanButton } from "./PlanButton";
import { planTone } from "./plans";
import type { TimeState } from "./timeState";
import { blockFit, laneBox, WEEK } from "./weekLayout";
import { plannedClock } from "./zones";

export type WeekBlockProps = {
  segment: Segment;
  /** Where the plan stands against the clock: past, now, next or later. */
  state: TimeState;
  zone: string;
  /** Distance from the top of the hours, in px. */
  top: number;
  /** Height of the plan's time, in px; the block draws a gap shorter than this. */
  height: number;
  /** The column is too narrow for the dot and the time. */
  narrow: boolean;
  /** The plan's detail is open. */
  selected: boolean;
  /** Plans that overlap this one but did not fit a lane, named in the tooltip and counted in "+N"; empty when none. */
  more: Plan[];
  onOpen: (plan: Plan, element: Element) => void;
  /** "+N" was pressed: open the day's card beside the control. */
  onMore: (element: Element) => void;
};

/**
 * One plan in a Week column: a floating rounded slab inset from the column edges, as tall as its time less a gap. It shows a
 * tone dot, the title (wrapped at whole words, never inside one) and, when it has the height and the column to itself, its time
 * under it. Two overlapping plans share the column in equal lanes; any further plans of the overlap fold into a quiet "+N" at this block's corner that opens the day's card. A declined plan is dashed and muted, one that ended or was
 * missed is quiet, the current one carries the sage tint and border, and an attended one swaps its dot for a check.
 */
export function WeekBlock({ segment, state, zone, top, height, narrow, selected, more, onOpen, onMore }: WeekBlockProps) {
  const { block: plan, lane, lanes } = segment;
  const declined = plan.rsvp === "no";
  const current = state === "now";
  const ended = state === "past";
  const missed = plan.attended === false;
  const quiet = declined || missed || ended;
  const box = Math.max(WEEK.minBlock, height - WEEK.blockGap);
  const reserve = more.length > 0 && box >= 52 ? WEEK.more : 0;
  const fit = blockFit(box - reserve, lanes, narrow);
  const range = formatRange(segment.startMin, segment.endMin);
  const there = plannedClock(plan, zone);
  const dot = lanes === 1 && !narrow;
  const title: CSSProperties = { fontSize: lanes > 1 ? 12 : 13, lineHeight: "16px", fontWeight: current ? 700 : 600, textDecoration: missed ? "line-through" : "none", color: quiet ? "var(--ink-muted)" : "var(--ink)", overflowWrap: "normal" };
  const look: CSSProperties = declined
    ? { backgroundImage: "linear-gradient(var(--slab-declined), var(--slab-declined))", border: "1px dashed var(--slab-declined-border)", boxShadow: "none" }
    : ended
      ? { backgroundImage: "linear-gradient(var(--slab-past), var(--slab-past))", border: "1px solid var(--slab-border)", boxShadow: "none" }
      : { backgroundImage: "linear-gradient(var(--slab), var(--slab))", border: "1px solid var(--slab-border)", boxShadow: "var(--slab-shadow)" };
  const check = plan.attended === true && !fit.short && lanes === 1 && !narrow;
  const hidden = more.map((plan) => plan.title).join(", ");
  const also = more.length === 0 ? "" : ` · Also at this time: ${hidden}`;
  const fold = { position: "absolute" as const, ...laneBox(lane, lanes), top: top + WEEK.blockGap / 2, height: box };
  return (
    <>
    <PlanButton
      plan={plan}
      className="ui-hover-card ui-trans"
      aria-haspopup="dialog"
      aria-expanded={selected}
      onClick={(event) => onOpen(plan, event.currentTarget)}
      title={`${plan.title} · ${formatClock(plan.start_at)} – ${formatClock(plan.end_at!)}${there === null ? "" : ` (${there})`}${also}`}
      aria-label={more.length === 0 ? undefined : `${plan.title}, ${range}. Also at this time: ${hidden}`}
      style={{
        position: "absolute",
        ...laneBox(lane, lanes),
        top: top + WEEK.blockGap / 2,
        height: box,
        display: "flex",
        flexDirection: "column",
        justifyContent: fit.short ? "center" : "flex-start",
        gap: WEEK.lineGap,
        padding: `${fit.padY}px ${more.length > 0 && reserve === 0 ? WEEK.padXMore : fit.padX}px ${fit.padY + reserve}px ${fit.padX}px`,
        borderRadius: "var(--radius-row)",
        overflow: "hidden",
        textAlign: "left",
        zIndex: 2 + lane,
        backgroundColor: "var(--bone)",
        ...look,
        ...(current ? { backgroundColor: "var(--slab)", backgroundImage: "linear-gradient(var(--sage-active), var(--sage-active))", borderColor: "var(--slab-now-border)" } : {}),
        ...(selected ? { borderColor: "var(--slab-now-border)" } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: WEEK.dotGap, minWidth: 0 }}>
        {check ? (
          <span aria-label="Attended" style={{ display: "flex", flex: "none", marginTop: 2, color: "var(--sage-deep)" }}>
            <Icon name="check" size={12} />
          </span>
        ) : dot ? (
          <span aria-hidden="true" style={{ width: 6, height: 6, marginTop: 5, marginLeft: 3, marginRight: 3, borderRadius: "50%", flex: "none", background: current ? "var(--sage-deep)" : ended ? "var(--ink-ghost)" : planTone(plan) }} />
        ) : null}
        {fit.titleLines === 1 ? <Truncate text={plan.title} style={{ flex: 1, ...title }} /> : <Clamp text={plan.title} lines={fit.titleLines} style={{ flex: 1, ...title }} />}
      </div>
      {fit.time ? <Truncate text={range} style={{ fontSize: 12, lineHeight: "16px", color: current ? "var(--sage-text)" : "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }} /> : null}
    </PlanButton>
    {more.length === 0 ? null : (
      <div style={{ ...fold, zIndex: 3, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: WEEK.laneGap, pointerEvents: "none" }}>
        <Button tone="quiet" size="xs" aria-haspopup="dialog" aria-label={`${more.length} more at this time: ${hidden}`} title={hidden} onClick={(event) => onMore(event.currentTarget)} style={{ pointerEvents: "auto" }}>
          {`+${more.length}`}
        </Button>
      </div>
    )}
    </>
  );
}
