import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Truncate } from "../../shared/ui/Truncate";
import { openExternal } from "../../shared/desktop/open";
import { pushToast } from "../../contexts/toasts";
import { formatClock } from "../../shared/lib/ux/time";
import type { Plan } from "../../types/planner";
import { formatUntil } from "./dates";
import { formatSpan } from "./layout";
import { isCurrent } from "./plans";
import { Checklist } from "./Checklist";

/** The plan on now and the first one after it, from today's timed plans; declined plans are neither. */
export function nowAndNextPlans(plans: Plan[], now: Date): { current: Plan | null; next: Plan | null } {
  const kept = plans.filter((plan) => plan.rsvp !== "no" && plan.end_at !== null && !plan.all_day).sort((a, b) => a.start_at.localeCompare(b.start_at));
  return {
    current: kept.find((plan) => isCurrent(plan, now)) ?? null,
    next: kept.find((plan) => Date.parse(plan.start_at) > now.getTime()) ?? null,
  };
}

/** A slim rounded progress track. */
function Track({ fraction }: { fraction: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--sage-deep) 14%, transparent)" }}>
      <span className="block h-full rounded-full bg-sage-deep transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }} />
    </div>
  );
}

export type DayRailProps = {
  /** The local day shown. */
  day: Date;
  /** Today's timed plans, for Now and Next; empty for another day. */
  plans: Plan[];
  /** The ticking clock. */
  now: Date;
  /** Show Now and Next above the Checklist; false for a day that is not today. */
  live: boolean;
  /** Open the Checklist's Someday section on arrival. */
  somedayOpen: boolean;
  /** The side column when false is a stack under the timeline: the Checklist takes the room Now and Next leave. */
  docked: boolean;
  /** Opens a plan's details under the chosen control. */
  onOpen: (plan: Plan, element: Element) => void;
};

/**
 * The Day view's side rail: what is on now with its time left, what is next with where it is and Directions to its
 * address, and under them the Checklist, which scrolls on its own.
 */
export function DayRail({ day, plans, now, live, somedayOpen, docked, onOpen }: DayRailProps) {
  const { current, next } = nowAndNextPlans(plans, now);
  const address = next?.place?.address ?? null;
  return (
    <div className={`flex min-h-0 min-w-0 flex-col gap-3 ${docked ? "w-[320px] flex-none" : "flex-1"}`}>
      {live && current !== null ? (
        <Card aria-label="Now" style={{ padding: 16, gap: 8, flex: "none" }}>
          <span className="ui-label">Now</span>
          <button type="button" onClick={(event) => onOpen(current, event.currentTarget)} className="min-w-0 text-left text-[17px] font-semibold">
            <Truncate text={current.title} />
          </button>
          <span className="text-[13px] text-ink-muted">{`${formatClock(current.start_at)} – ${formatClock(current.end_at!)}`}</span>
          <Track fraction={(now.getTime() - Date.parse(current.start_at)) / (Date.parse(current.end_at!) - Date.parse(current.start_at))} />
          <span className="text-[13px] text-ink-muted">{formatSpan(Math.max(0, Math.round((Date.parse(current.end_at!) - now.getTime()) / 60_000)))} left</span>
        </Card>
      ) : null}
      {live && next !== null ? (
        <Card aria-label="Next" style={{ padding: 16, gap: 8, flex: "none" }}>
          <span className="ui-label">{`Up next · ${formatUntil(now, new Date(next.start_at))}`}</span>
          <button type="button" onClick={(event) => onOpen(next, event.currentTarget)} className="min-w-0 text-left text-[17px] font-semibold">
            <Truncate text={next.title} />
          </button>
          <span className="text-[13px] text-ink-muted">{`${formatClock(next.start_at)}${next.end_at === null ? "" : ` – ${formatClock(next.end_at)}`}`}</span>
          {next.place === null ? null : (
            <div className="flex min-w-0 items-center gap-2">
              <Truncate text={`${next.place.title}${next.place.room === null ? "" : ` · room ${next.place.room}`}`} className="min-w-0 flex-1 text-[13px] text-ink-muted" />
              {address === null ? null : (
                <Button
                  tone="sage"
                  size="sm"
                  pill
                  icon="link"
                  onClick={() =>
                    openExternal(`https://maps.apple.com/?daddr=${encodeURIComponent(address)}`).catch((error: unknown) =>
                      pushToast({ key: "planner:directions", tone: "error", title: "Couldn’t open Maps", body: error instanceof Error ? error.message : String(error) }),
                    )
                  }
                >
                  Directions
                </Button>
              )}
            </div>
          )}
        </Card>
      ) : null}
      <Checklist day={day} now={now} somedayOpen={somedayOpen} />
    </div>
  );
}
