import type { TimelineItem } from "../../../types/timeline";
import { Chip } from "../../../shared/ui/Chip";
import { Icon } from "../../../shared/ui/Icon";
import { formatTime } from "../dates";
import { SessionActions } from "../SessionActions";
import { formatSpan } from "./blocks";
import { KIND_LABEL } from "./kinds";

export type SessionCardProps = {
  /** A planner session. */
  block: TimelineItem;
};

/** A session's card: its kind, title, when and where, what was noted, how it stands and what Ankur can do with it. */
export function SessionCard({ block }: SessionCardProps) {
  const status = block.state === "cancelled" ? "Cancelled" : block.outcome === "done" ? "Completed" : block.outcome === "missed" ? "Missed" : null;
  const where = block.place ? [block.place.title, block.place.room ? `room ${block.place.room}` : null, block.place.address].filter(Boolean).join(" · ") : null;
  return (
    <div data-selectable className="flex flex-col gap-3.5 px-5 pt-5 pb-5">
      <div className="flex items-center gap-2">
        <span className="flex-none rounded-full bg-sage-fill px-2.5 py-0.5 text-[12px] font-semibold text-sage-text">{block.kind ? KIND_LABEL[block.kind] : "Plan"}</span>
        {block.recurrence ? <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted">{block.recurrence}</span> : <span className="flex-1" />}
        <SessionActions item={block} only={["mark-done"]} />
      </div>
      <h3 className={`m-0 text-[19px] leading-7 font-semibold tracking-[-0.015em] text-ink ${block.state === "cancelled" || block.outcome === "done" ? "line-through decoration-sage-deep decoration-2" : ""}`}>{block.title}</h3>
      {block.start_at !== null && block.end_at !== null || where !== null ? (
        <div className="flex flex-col gap-1.5 text-[13.5px] text-ink-muted">
          {block.start_at !== null && block.end_at !== null ? (
            <span className="flex items-center gap-2 tabular-nums">
              <Icon name="clock" size={14} />
              {`${formatTime(block.start_at)} to ${formatTime(block.end_at)} · ${formatSpan((new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) / 60_000)}`}
            </span>
          ) : null}
          {where !== null ? <span className="pl-[22px]">{where}</span> : null}
        </div>
      ) : null}
      {block.body ? <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{block.body}</p> : null}
      {block.notes.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-[14px] bg-sage-fill px-3.5 py-3">
          {block.notes.map((note) => (
            <p key={note.id} className="m-0 text-[13.5px] leading-relaxed text-ink">
              {note.title}
            </p>
          ))}
        </div>
      ) : null}
      {status !== null || block.series ? (
        <div className="flex items-center gap-2">
          {status === null ? null : <Chip>{status}</Chip>}
          {block.series ? (
            <span className="text-[12.5px] text-ink-muted">
              Completed {block.series.completed} of {block.series.total}
            </span>
          ) : null}
        </div>
      ) : null}
      <SessionActions item={block} only={["show-in-yaad", "message"]} />
    </div>
  );
}
