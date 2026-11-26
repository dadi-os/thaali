import { useNavigate } from "react-router-dom";
import { openAgent } from "../../contexts/chat";
import { requestCompose } from "../../contexts/reply";
import { Button } from "../../shared/ui/Button";
import { DetailCard, InsetSection, type FactItem } from "../../shared/ui/DetailCard";
import { Icon } from "../../shared/ui/Icon";
import { formatClock, formatDay } from "../../shared/lib/ux/time";
import type { Task } from "../../types/planner";
import { agoPhrase, inPhrase } from "./phrases";
import { useOwnerAgent } from "./taskActions";
import { taskStatus } from "./timeState";
import { useLiveTask, useTaskTick } from "./useTaskTick";

/** Props of {@link TaskCard}. */
export type TaskCardProps = {
  task: Task;
  /** The instant "now" is read at, for the status and the hints. */
  now?: Date;
};

/** How a task's situation reads. */
const TONE = { done: "live", late: "late", soon: "calm", open: "calm", none: "calm" } as const;

/**
 * A task's popover, in the same anatomy as a plan's: its situation as a chip ("Past due by 5 days", "Closes today 11:59 PM
 * · in 3 h", "Done"), the facts (opens, closes, course, kept by, last confirmed), the actions (Mark done first, then
 * Message agent and Yaad), and its notes.
 */
export function TaskCard({ task: shown, now = new Date() }: TaskCardProps) {
  const task = useLiveTask(shown);
  const tick = useTaskTick();
  const navigate = useNavigate();
  const agent = useOwnerAgent(task.owner);
  const status = taskStatus(task, now);
  const opens = task.opens_on === null ? null : new Date(`${task.opens_on}T00:00:00`);
  const facts: Array<FactItem | null> = [
    opens === null ? null : { label: "Opens", value: formatDay(opens.toISOString()), hint: opens.getTime() > now.getTime() ? inPhrase(opens.getTime() - now.getTime()) : agoPhrase(now.getTime() - opens.getTime()) },
    task.closes_at === null ? null : { label: "Closes", value: `${formatDay(task.closes_at)} · ${formatClock(task.closes_at)}`, hint: task.done ? undefined : Date.parse(task.closes_at) > now.getTime() ? inPhrase(Date.parse(task.closes_at) - now.getTime()) : undefined },
    task.hub === null || task.hub.title === task.title ? null : { label: "Course", value: task.hub.title },
    { label: "Done", value: task.done ? "Yes" : "No" },
    { label: "Owner", value: agent === null ? (task.owner === "manual" || task.owner === "ingest" ? "Not kept by an agent" : task.owner) : agent.name },
    task.verified_at === null ? null : { label: "Last confirmed", value: agoPhrase(now.getTime() - Date.parse(task.verified_at)) },
  ];
  return (
    <DetailCard
      title={task.title}
      status={{ label: status.label, tone: TONE[status.tone], icon: task.done ? <Icon name="check" size={12} /> : undefined }}
      muted={task.done}
      struck={task.done}
      facts={facts}
      actions={
        <>
          <Button data-keep-open tone={task.done ? "quiet" : "sage"} size="rail" icon={task.done ? "retry" : "check"} onClick={() => tick(task, !task.done)}>
            {task.done ? "Take back done" : "Mark done"}
          </Button>
          {agent === null ? null : (
            <Button
              tone="quiet"
              size="rail"
              icon="send"
              onClick={() => {
                openAgent(agent.id);
                requestCompose(`I want to talk about "${task.title}"`);
              }}
            >
              Message agent
            </Button>
          )}
          <Button tone="quiet" size="rail" icon="graph" onClick={() => navigate(`/yaad?focus=${task.id}`)}>
            Yaad
          </Button>
        </>
      }
      sections={
        task.body === null || task.body === "" ? undefined : (
          <InsetSection title="Notes">
            <p className="m-0 text-[14px] leading-relaxed break-words whitespace-pre-line text-ink">{task.body}</p>
          </InsetSection>
        )
      }
    />
  );
}
