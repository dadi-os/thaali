import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { planner } from "../../shared/api";
import { openExternal } from "../../shared/desktop/open";
import { Button } from "../../shared/ui/Button";
import { Chip, type ChipTone } from "../../shared/ui/Chip";
import { FadeScroll } from "../../shared/ui/FadeScroll";
import { Icon, type IconName } from "../../shared/ui/Icon";
import { formatClock, formatDay } from "../../shared/lib/ux/time";
import { failureTarget, pushToast } from "../../contexts/toasts";
import type { Plan, Rsvp } from "../../types/planner";
import { relativeToSession } from "./dates";
import { formatSpan, hasEnded } from "./layout";
import { usePlanActions } from "./planActions";
import { attendedLabel } from "./plans";
import { plannedClock } from "./zones";

/** The tallest the notes region grows to before it scrolls, in px. */
const NOTES_MAX = 176;

/** How the RSVP reads, as a chip; it is Yaad's to change, never the app's. */
const RSVP: Record<"yes" | "no" | "none", { label: string; tone: ChipTone }> = {
  yes: { label: "Going", tone: "sage" },
  no: { label: "Declined", tone: "sage" },
  none: { label: "Not answered", tone: "late" },
};

function rsvpKey(rsvp: Rsvp): "yes" | "no" | "none" {
  return rsvp ?? "none";
}

type FactProps = {
  icon: IconName;
  /** Shown on hover when the words truncate. */
  title: string;
  /** A hint that stays visible when the words truncate, at the row's end. */
  hint?: string;
  children: string;
};

/** One line of facts: an icon, words that truncate to one line, and an optional hint at the end. */
function Fact({ icon, title, hint, children }: FactProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[14px] text-ink-muted">
      <span className="flex flex-none">
        <Icon name={icon} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate tabular-nums" title={title}>
        {children}
      </span>
      {hint === undefined ? null : <span className="flex-none text-[13px] text-ink-ghost">{hint}</span>}
    </div>
  );
}

/** Props of {@link PlanCard}. */
export type PlanCardProps = {
  plan: Plan;
  /** The instant "now" is read at, for the relative hint beside the time and for whether the plan has ended. */
  now?: Date;
};

/**
 * A plan's card: RSVP (read only) and course, a title that wraps to two lines, when and where (with the plan's own clock
 * when its zone differs from the device's), notes that scroll inside a bounded region, and a footer: Attended once the plan has
 * ended, Message agent when one keeps it, Directions, Show in Yaad.
 */
export function PlanCard({ plan, now = new Date() }: PlanCardProps) {
  const client = useQueryClient();
  const actionsFor = usePlanActions();
  const [attended, setAttendedState] = useState(plan.attended);
  const current: Plan = { ...plan, attended };
  const rsvp = RSVP[rsvpKey(plan.rsvp)];
  const where = plan.place ? [plan.place.title, plan.place.room ? `room ${plan.place.room}` : null, plan.place.address].filter(Boolean).join(" · ") : null;
  const address = plan.place?.address ?? null;
  const own = plannedClock(plan, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timed = !plan.all_day && plan.end_at !== null;
  const asks = plan.rsvp !== "no" && !plan.all_day && hasEnded(plan, now);
  const notes = [plan.body, ...plan.notes.map((note) => note.title)].filter((text): text is string => text !== null && text !== "");
  const status = attendedLabel(current);
  const answer = (value: boolean) => {
    const next = attended === value ? null : value;
    planner.setAttended({ plan_id: plan.id, attended: next }).then(
      () => {
        setAttendedState(next);
        void client.invalidateQueries({ queryKey: ["yaad", "planner", "plans"] });
      },
      (error: unknown) => pushToast({ key: "planner:attended", tone: "error", title: "Couldn’t save attendance", body: error instanceof Error ? error.message : String(error), target: failureTarget(error) }),
    );
  };
  const others = actionsFor(current).flatMap((entry) => (entry !== "separator" && (entry.id === "message" || entry.id === "show-in-yaad") ? [entry] : []));
  return (
    <div data-selectable className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Chip tone={rsvp.tone}>{rsvp.label}</Chip>
          {plan.hub === null ? null : <Chip tone="tide">{plan.hub.title}</Chip>}
          <span className="flex-1" />
          {status === null ? null : <Chip>{status}</Chip>}
        </div>
        <h3 title={plan.title} className={`m-0 line-clamp-2 text-[20px] leading-7 font-semibold tracking-[-0.015em] break-words ${plan.rsvp === "no" ? "text-ink-muted" : "text-ink"}`}>
          {plan.title}
        </h3>
        <div className="flex min-w-0 flex-col gap-2">
          {timed ? (
            <Fact icon="clock" title={`${formatDay(plan.start_at)}, ${formatClock(plan.start_at)} to ${formatClock(plan.end_at!)}`} hint={relativeToSession(now, new Date(plan.start_at), new Date(plan.end_at!))}>
              {`${formatClock(plan.start_at)} – ${formatClock(plan.end_at!)} · ${formatSpan((Date.parse(plan.end_at!) - Date.parse(plan.start_at)) / 60_000)}`}
            </Fact>
          ) : (
            <Fact icon="cal" title={formatDay(plan.start_at)}>{`${formatDay(plan.start_at)} · All day`}</Fact>
          )}
          {own === null ? null : (
            <Fact icon="clock" title={own}>
              {own}
            </Fact>
          )}
          {where === null ? null : (
            <Fact icon="pin" title={where}>
              {where}
            </Fact>
          )}
        </div>
      </div>
      {notes.length > 0 ? (
        <FadeScroll maxHeight={NOTES_MAX} className="flex-1">
          <div className="flex flex-col gap-2 px-5 pb-3">
            <div className="flex flex-col gap-2 rounded-[14px] bg-sage-fill px-3.5 py-3">
              {notes.map((text, index) => (
                <p key={index} className="m-0 text-[14px] leading-relaxed break-words whitespace-pre-line text-ink">
                  {text}
                </p>
              ))}
            </div>
          </div>
        </FadeScroll>
      ) : null}
      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-rule px-5 py-3">
        {asks ? (
          <>
            <Button tone="sage" size="sm" icon="check" selected={attended === true} onClick={() => answer(true)}>
              Attended
            </Button>
            <Button tone="quiet" size="sm" icon="close" selected={attended === false} onClick={() => answer(false)}>
              Didn’t attend
            </Button>
          </>
        ) : null}
        {address === null ? null : (
          <Button
            tone="quiet"
            size="sm"
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
        {others.map((action) => (
          <Button key={action.id} tone="quiet" size="sm" icon={action.icon} onClick={() => void action.run()}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
