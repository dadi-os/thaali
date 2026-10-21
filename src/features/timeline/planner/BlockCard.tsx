import type { PlannerBlock } from "../../../types/planner";
import { formatTime } from "../dates";
import { formatSpan } from "./blocks";
import { KIND_LABEL } from "./kinds";

export type BlockCardProps = {
  block: PlannerBlock;
  /** Marking the block done or open is in flight. */
  busy: boolean;
  /** The block is done by mark or by time. */
  settled: boolean;
  onToggleDone: () => void;
};

/** A planner block's card: kind, title, time and length, its note, and done. */
export function BlockCard({ block, busy, settled, onToggleDone }: BlockCardProps) {
  const minutes = (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) / 60_000;
  return (
    <div className="px-4 py-4">
      <p className="text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">
        {KIND_LABEL[block.kind]} · {block.fixed ? "fixed" : "can shrink"}
      </p>
      <h3 className="mt-1.5 text-[17px] font-medium text-ink">{block.title}</h3>
      <p className="font-numeric mt-0.5 text-[12px] text-ink-muted">
        {formatTime(block.start_at)} to {formatTime(block.end_at)} · {formatSpan(minutes)}
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{block.note ?? "No note."}</p>
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="rounded-full bg-sage-fill px-2.5 py-0.5 text-[11px] text-sage-deep">{settled ? "Done" : "Upcoming"}</span>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleDone}
          className="rounded-[7px] border border-sage-line bg-bone-raised px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-sage-deep uppercase shadow-[var(--shadow)] transition-[background-color,border-color] duration-fast ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-progress"
        >
          {block.done_at !== null ? "Undo done" : "Mark done"}
        </button>
      </div>
    </div>
  );
}
