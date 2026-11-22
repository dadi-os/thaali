import { Button } from "../../shared/ui/Button";
import { Segmented, type SegmentedOption } from "../../shared/ui/Segmented";
import { openAgent } from "../../contexts/chat";
import { requestCompose } from "../../contexts/reply";
import { DetailCard, InsetSection, type FactItem } from "../../shared/ui/DetailCard";
import { Icon } from "../../shared/ui/Icon";
import { formatClock, formatDay } from "../../shared/lib/ux/time";
import type { Plan } from "../../types/planner";
import { answerAfter, hasStarted, useLivePlan, useSetAttended } from "./attended";
import { formatRange, formatSpan } from "./layout";
import { usePlanActions } from "./planActions";
import { canTell, rsvpChoice, rsvpMessage, type RsvpAnswer } from "./rsvp";
import { useOwnerAgent } from "./taskActions";
import { nextPlanId, planStatus, timeState } from "./timeState";
import { plannedClock } from "./zones";
import { WhereCopy } from "./WhereCopy";

/** The two answers to "Were you there?"; neither is chosen until Ankur says. */
const ANSWERS: ReadonlyArray<SegmentedOption<string>> = [
  { value: "yes", label: "Attended" },
  { value: "no", label: "Didn’t attend" },
];

/** The two answers to "Going?"; the one Yaad holds is selected, neither while it holds none. */
const GOING: ReadonlyArray<SegmentedOption<string>> = [
  { value: "yes", label: "Going" },
  { value: "no", label: "Not going" },
];

/** Props of {@link PlanCard}. */
export type PlanCardProps = {
  plan: Plan;
  /** The instant "now" is read at, for the status and for whether the plan has begun. */
  now?: Date;
};

/** The chip that states a plan's situation: attended or not once answered, else where it stands in time. */
function statusOf(plan: Plan, now: Date) {
  const state = timeState(plan, now, nextPlanId([plan], now));
  if (plan.rsvp === "no") return { label: "Declined", tone: "calm" as const };
  if (plan.attended === true) return { label: "Attended", tone: "live" as const, icon: <Icon name="check" size={14} /> };
  if (plan.attended === false) return { label: "Didn’t attend", tone: "calm" as const };
  return { label: planStatus(plan, now, state), tone: state === "now" ? ("live" as const) : ("calm" as const) };
}

/**
 * A plan's popover, in the shared detail anatomy: its situation as a dot and a phrase ("Now · 12 min left", "Starts in 25 min",
 * "Ended 2 h ago", "Attended"), the facts (when, where as a click that copies the address, course, kept by, going, attended), the actions
 * (one rail: Going / Not going while it can still be answered, Attended and Didn't attend once the plan has begun, Message agent and Yaad), and its notes.
 */
export function PlanCard({ plan: shown, now = new Date() }: PlanCardProps) {
  const plan = useLivePlan(shown);
  const setAttended = useSetAttended();
  const actionsFor = usePlanActions();
  const agent = useOwnerAgent(plan.owner);
  const declined = plan.rsvp === "no";
  const address = plan.place?.address ?? null;
  const own = plannedClock(plan, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timed = !plan.all_day && plan.end_at !== null;
  const asks = !declined && !plan.all_day && hasStarted(plan, now);
  const notes = [plan.body, ...plan.notes.map((note) => note.title)].filter((text): text is string => text !== null && text !== "");
  const others = actionsFor(plan).flatMap((entry) => (entry !== "separator" && (entry.id === "message" || entry.id === "show-in-yaad") ? [entry] : []));
  const minutesOf = (iso: string) => new Date(iso).getHours() * 60 + new Date(iso).getMinutes();
  const facts: Array<FactItem | null> = [
    { label: "Date", value: formatDay(plan.start_at) },
    { label: "Time", value: timed ? formatRange(minutesOf(plan.start_at), minutesOf(plan.end_at!)) : plan.all_day ? "All day" : formatClock(plan.start_at) },
    timed ? { label: "Length", value: formatSpan((Date.parse(plan.end_at!) - Date.parse(plan.start_at)) / 60_000) } : null,
    own === null ? null : { label: "Local time", value: own },
    plan.place === null ? null : { label: "Where", value: <WhereCopy label={`${plan.place.title}${plan.place.room === null ? "" : ` · room ${plan.place.room}`}`} address={address} /> },
    plan.hub === null || plan.hub.title === plan.title ? null : { label: "Course", value: plan.hub.title },
    agent === null ? null : { label: "Kept by", value: agent.name },
    plan.rsvp === null ? null : { label: "Going", value: plan.rsvp === "yes" ? "Yes" : "No, declined" },
    plan.attended === null ? null : { label: "Attended", value: plan.attended ? "Yes, you were there" : "No, you were not" },
  ];
  return (
    <DetailCard
      title={plan.title}
      status={statusOf(plan, now)}
      muted={declined || plan.attended === false}
      struck={plan.attended === false}
      facts={facts}
      actions={
        <>
          {agent !== null && canTell(plan, true, now) ? (
            <Segmented
              size="md"
              label="Going?"
              options={GOING.map((option) => ({ ...option, title: `${option.label}: tell ${agent.name}` }))}
              value={rsvpChoice(plan)}
              onChange={(next) => {
                openAgent(agent.id);
                requestCompose(rsvpMessage(plan, next as RsvpAnswer));
              }}
            />
          ) : null}
          {asks ? (
            <span data-keep-open className="inline-flex">
              <Segmented size="md" label="Were you there?" options={ANSWERS} value={plan.attended === true ? "yes" : plan.attended === false ? "no" : ""} onChange={(next) => setAttended(plan, answerAfter(plan.attended, next === "yes"))} />
            </span>
          ) : null}
          {others.map((action) => (
            <Button key={action.id} tone="quiet" size="rail" icon={action.icon} onClick={() => void action.run()}>
              {action.id === "show-in-yaad" ? "Yaad" : action.label}
            </Button>
          ))}
        </>
      }
      sections={
        notes.length === 0 ? undefined : (
          <InsetSection title="Notes">
            {notes.map((text, index) => (
              <p key={index} className="m-0 text-[14px] leading-relaxed break-words whitespace-pre-line text-ink">
                {text}
              </p>
            ))}
          </InsetSection>
        )
      }
    />
  );
}
