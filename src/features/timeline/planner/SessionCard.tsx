import type { TimelineItem } from "../../../types/timeline";
import { Chip } from "../../../shared/ui/Chip";
import { FadeScroll } from "../../../shared/ui/FadeScroll";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import { formatDay, formatClock } from "../../../shared/lib/ux/time";
import { formatSince, formatUntil, relativeToSession } from "../dates";
import { SessionActions } from "../SessionActions";
import { formatSpan } from "./blocks";
import { KIND_LABEL } from "./kinds";

/** The tallest the notes region grows to before it scrolls, in px. */
const NOTES_MAX = 176;

export type SessionCardProps = {
  /** A planner session. */
  block: TimelineItem;
  /** The instant "now" is read at, for the relative hint beside the time. */
  now?: Date;
};

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
    <div className="flex min-w-0 items-center gap-2 text-[13.5px] text-ink-muted">
      <span className="flex flex-none">
        <Icon name={icon} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate tabular-nums" title={title}>
        {children}
      </span>
      {hint === undefined ? null : <span className="flex-none text-[12.5px] text-ink-ghost">{hint}</span>}
    </div>
  );
}

/** The state of a session in a word: cancelled, completed or missed, or null while it stands. */
function statusOf(block: TimelineItem): string | null {
  return block.state === "cancelled" ? "Cancelled" : block.outcome === "done" ? "Completed" : block.outcome === "missed" ? "Missed" : null;
}

/** A session's card: kind and status, a title that wraps to two lines, when and where, notes that scroll inside a bounded region, and its actions in a footer row. */
export function SessionCard({ block, now = new Date() }: SessionCardProps) {
  const status = statusOf(block);
  const where = block.place ? [block.place.title, block.place.room ? `room ${block.place.room}` : null, block.place.address].filter(Boolean).join(" · ") : null;
  const timed = block.start_at !== null && block.end_at !== null;
  const struck = block.state === "cancelled" || block.outcome === "done";
  const notes = [block.body, ...block.notes.map((note) => note.title)].filter((text): text is string => text !== null && text !== "");
  return (
    <div data-selectable className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex-none rounded-full bg-sage-fill px-2.5 py-0.5 text-[12px] font-semibold text-sage-text">{block.kind ? KIND_LABEL[block.kind] : "Plan"}</span>
          {block.recurrence ? <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted">{block.recurrence}</span> : <span className="flex-1" />}
          {status === null ? null : <Chip>{status}</Chip>}
        </div>
        <h3 title={block.title} className={`m-0 line-clamp-2 text-[19px] leading-7 font-semibold tracking-[-0.015em] break-words text-ink ${struck ? "line-through decoration-sage-deep decoration-2" : ""}`}>
          {block.title}
        </h3>
        {timed || block.due_at !== null || where !== null ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            {timed ? (
              <Fact
                icon="clock"
                title={`${formatDay(block.start_at!)}, ${formatClock(block.start_at!)} to ${formatClock(block.end_at!)}`}
                hint={relativeToSession(now, new Date(block.start_at!), new Date(block.end_at!))}
              >
                {`${formatClock(block.start_at!)} – ${formatClock(block.end_at!)} · ${formatSpan((Date.parse(block.end_at!) - Date.parse(block.start_at!)) / 60_000)}`}
              </Fact>
            ) : null}
            {!timed && block.due_at !== null ? (
              <Fact
                icon="clock"
                title={`${formatDay(block.due_at)}, ${formatClock(block.due_at)}`}
                hint={Date.parse(block.due_at) > now.getTime() ? formatUntil(now, new Date(block.due_at)) : formatSince(now, new Date(block.due_at))}
              >
                {`Due ${formatClock(block.due_at)}`}
              </Fact>
            ) : null}
            {where !== null ? (
              <Fact icon="pin" title={where}>
                {where}
              </Fact>
            ) : null}
          </div>
        ) : null}
      </div>
      {notes.length > 0 || block.series ? (
        <FadeScroll maxHeight={NOTES_MAX} className="flex-1">
          <div className="flex flex-col gap-2 px-5 pb-3">
            {notes.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-[14px] bg-sage-fill px-3.5 py-3">
                {notes.map((text, index) => (
                  <p key={index} className="m-0 text-[13.5px] leading-relaxed break-words whitespace-pre-line text-ink">
                    {text}
                  </p>
                ))}
              </div>
            ) : null}
            {block.series ? (
              <span className="text-[12.5px] text-ink-muted">
                Completed {block.series.completed} of {block.series.total}
              </span>
            ) : null}
          </div>
        </FadeScroll>
      ) : null}
      <div className="flex flex-none items-center gap-2 border-t border-rule px-5 py-3">
        <SessionActions item={block} only={["mark-done", "show-in-yaad", "message"]} />
      </div>
    </div>
  );
}
