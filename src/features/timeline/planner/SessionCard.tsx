import type { TimelineItem } from "../../../types/timeline";
import { formatTime } from "../dates";
import { SessionActions } from "../SessionActions";
import { formatSpan } from "./blocks";
import { KIND_LABEL } from "./kinds";

export type SessionCardProps = {
  /** A planner session. */
  block: TimelineItem;
  /** The session is completed, cancelled, or over. */
  settled: boolean;
};

/** A planner session's card: kind, title, time and length, place, body and notes, and what Ankur can do with it. */
export function SessionCard({ block, settled }: SessionCardProps) {
  const status =
    block.state === "cancelled" ? "Cancelled" : block.outcome === "done" ? "Completed" : block.outcome === "missed" ? "Missed" : settled ? "Not marked" : "Upcoming";
  return (
    <div className="px-4 py-4">
      <p className="text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">
        {block.kind ? KIND_LABEL[block.kind] : "Plan"}
        {block.recurrence ? ` · ${block.recurrence}` : ""}
      </p>
      <h3 className={`mt-1.5 text-[17px] font-medium text-ink ${block.state === "cancelled" ? "line-through" : ""}`}>{block.title}</h3>
      {block.start_at !== null && block.end_at !== null ? (
        <p className="font-numeric mt-0.5 text-[12px] text-ink-muted">
          {formatTime(block.start_at)} to {formatTime(block.end_at)} ·{" "}
          {formatSpan((new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) / 60_000)}
        </p>
      ) : null}
      {block.place ? (
        <p className="mt-1 text-[12px] text-ink-muted">
          {block.place.title}
          {block.place.room ? ` · room ${block.place.room}` : ""}
          {block.place.address ? ` · ${block.place.address}` : ""}
        </p>
      ) : null}
      {block.body ? <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{block.body}</p> : null}
      {block.notes.map((note) => (
        <p key={note.id} className="mt-2 text-[12.5px] leading-relaxed text-ink">
          {note.title}
        </p>
      ))}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-sage-fill px-2.5 py-0.5 text-[11px] text-sage-deep">{status}</span>
        {block.series ? (
          <span className="text-[11px] text-ink-ghost">
            Completed {block.series.completed} of {block.series.total}
          </span>
        ) : null}
      </div>
      <div className="mt-3.5">
        <SessionActions item={block} />
      </div>
    </div>
  );
}
