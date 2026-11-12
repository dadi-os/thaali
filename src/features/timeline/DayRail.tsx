import { Card } from "../../shared/ui/Card";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { DuePanel } from "./DuePanel";

/** Props of {@link DayRail}. */
export type DayRailProps = {
  /** The day's timed sessions. */
  sessions: TimelineItem[];
  /** The day's due-at plans. */
  dues: TimelineItem[];
  /** Real instant, for what is on now, what is next and how far the day has come. */
  now: Date;
  /** Occurrence key of the plan whose details are open. */
  selected: string | null;
  /** Opens a plan's details under the chosen control. */
  onOpen: (item: TimelineItem, element: Element) => void;
};

/** A session's length in minutes. */
function lengthOf(item: TimelineItem): number {
  return item.end_at === null ? 0 : (Date.parse(item.end_at) - Date.parse(item.start_at!)) / 60_000;
}

/** "1 h 20 min", "45 min" or "0 min". */
function span(min: number): string {
  const hours = Math.floor(min / 60);
  const rest = Math.round(min % 60);
  return `${hours > 0 ? `${hours} h ` : ""}${rest > 0 ? `${rest} min` : ""}`.trim() || "0 min";
}

/** A slim rounded progress track; `tone` is the fill's colour. */
function Track({ fraction, tone }: { fraction: number; tone: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--sage-deep) 14%, transparent)" }}>
      <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%`, background: tone }} />
    </div>
  );
}

/**
 * The Day view's side rail, a column of cards: what is on now, what is next, how the day is going and the Due card. The
 * rail scrolls as a whole when its cards are taller than the room; the Due card is as tall as its rows up to a cap.
 */
export function DayRail({ sessions, dues, now, selected, onOpen }: DayRailProps) {
  const live = sessions.filter((item) => item.state !== "cancelled");
  const current = live.find((item) => Date.parse(item.start_at!) <= now.getTime() && item.end_at !== null && Date.parse(item.end_at) > now.getTime());
  const next = live.filter((item) => Date.parse(item.start_at!) > now.getTime()).sort((a, b) => Date.parse(a.start_at!) - Date.parse(b.start_at!))[0];
  const total = live.reduce((sum, item) => sum + lengthOf(item), 0);
  const done = live.filter((item) => item.outcome === "done").reduce((sum, item) => sum + lengthOf(item), 0);
  return (
    <div className="scroll flex min-h-0 w-[300px] flex-none flex-col gap-3">
      <Card aria-label="Now" style={{ padding: 16, gap: 8, flex: "none" }}>
        <span className="ui-label">Now</span>
        {current === undefined ? (
          <span className="text-[14px] text-ink-muted">Nothing right now.</span>
        ) : (
          <>
            <button type="button" onClick={(event) => onOpen(current, event.currentTarget)} className="text-left text-[17px] font-semibold">
              {current.title}
            </button>
            <span className="text-[13px] text-ink-muted">{`${formatClock(current.start_at!)} – ${formatClock(current.end_at!)}`}</span>
            <Track fraction={(now.getTime() - Date.parse(current.start_at!)) / (Date.parse(current.end_at!) - Date.parse(current.start_at!))} tone="var(--sage-deep)" />
            <span className="text-[13px] text-ink-muted">{Math.round((Date.parse(current.end_at!) - now.getTime()) / 60_000)} min left</span>
          </>
        )}
      </Card>
      {next === undefined ? null : (
        <Card aria-label="Next" style={{ padding: 16, gap: 8, flex: "none" }}>
          <span className="ui-label">Next</span>
          <button type="button" onClick={(event) => onOpen(next, event.currentTarget)} className="text-left text-[17px] font-semibold">
            {next.title}
          </button>
          <span className="text-[13px] text-ink-muted">
            {formatClock(next.start_at!)} · in {span(Math.round((Date.parse(next.start_at!) - now.getTime()) / 60_000))}
          </span>
        </Card>
      )}
      <Card aria-label="The day" style={{ padding: 16, gap: 8, flex: "none" }}>
        <span className="ui-label">The day</span>
        <span className="text-[15px] font-semibold">
          {live.length} sessions · {span(Math.round(total))}
        </span>
        <Track fraction={total > 0 ? done / total : 0} tone="var(--sage)" />
        <span className="text-[13px] text-ink-muted">{span(Math.round(done))} done</span>
      </Card>
      <DuePanel items={dues} now={now} selected={selected} onOpen={onOpen} docked />
    </div>
  );
}
