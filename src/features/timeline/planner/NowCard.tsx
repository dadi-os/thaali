import { motion } from "motion/react";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import type { PlannerBlock } from "../../../types/planner";
import { startOfDay } from "../dates";
import { formatMinuteOfDay, formatSpan, gapsBetween, nowAndNext, type Segment } from "./blocks";
import { PlannerGlyph } from "./glyphs";

export type NowCardProps = {
  /** Today's segments. */
  segments: Segment[];
  now: Date;
  /** Marking a block done or open is in flight. */
  busy: boolean;
  onToggleDone: (block: PlannerBlock) => void;
};

/**
 * What to be doing right now: the block in progress with its time left and note, or the
 * stretch between blocks with the countdown to the next; always the next block and the
 * unclaimed time before it, so switching tasks takes one glance.
 */
export function NowCard({ segments, now, busy, onToggleDone }: NowCardProps) {
  const nowMin = (now.getTime() - startOfDay(now).getTime()) / 60_000;
  const { current, next } = nowAndNext(segments, nowMin);
  const gap = current !== null && next !== null ? gapsBetween(segments).find((g) => g.startMin === current.endMin) : undefined;
  const left = current !== null ? current.endMin - nowMin : next !== null ? next.startMin - nowMin : 0;
  const shown = current ?? next;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      aria-live="polite"
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-[18px] gap-y-3 rounded-[14px] border border-sage-line bg-[var(--glass-sheet)] px-5 py-[18px] shadow-[var(--shadow-deep)] max-sm:grid-cols-[auto_minmax(0,1fr)]"
    >
      <span className="flex size-[52px] items-center justify-center rounded-full border border-sage-line bg-bone text-sage-deep">
        <PlannerGlyph icon={shown?.block.icon ?? "moon"} size={24} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">
          {current !== null ? (
            <>
              <span className="relative size-[7px] rounded-full bg-[var(--clay)]">
                <span className="animate-pulse-out absolute inset-0 rounded-full bg-[var(--clay)]" />
              </span>
              Now · {formatMinuteOfDay(current.startMin)} to {formatMinuteOfDay(current.endMin)}
            </>
          ) : next !== null ? (
            "Between blocks"
          ) : (
            "Done for today"
          )}
        </p>
        <h2 className="mt-1 text-[22px] font-medium tracking-tight text-ink">
          {current !== null ? current.block.title : next !== null ? "Time to move" : "Day complete"}
        </h2>
        <p className="mt-0.5 max-w-[62ch] text-[13px] text-ink-muted">
          {current !== null
            ? (current.block.note ?? "No note.")
            : next !== null
              ? "Nothing is claimed right now. This is travel or a short reset."
              : "Everything on today's plan is behind you."}
        </p>
      </div>
      <div className="flex min-w-[150px] flex-col items-end gap-2 max-sm:col-span-2 max-sm:items-stretch">
        {shown !== null ? (
          <>
            <span className="font-numeric text-[26px] font-medium tracking-tight text-ink">{formatSpan(left)}</span>
            <span className="text-[11px] tracking-[0.06em] text-ink-ghost uppercase">{current !== null ? "left" : "until next"}</span>
          </>
        ) : null}
        {current !== null ? (
          <>
            <span className="h-1 w-full overflow-hidden rounded-full bg-rule">
              <span
                className="block h-full rounded-full bg-sage transition-[width] duration-slow ease-dadi"
                style={{ width: `${((nowMin - current.startMin) / (current.endMin - current.startMin)) * 100}%` }}
              />
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleDone(current.block)}
              className="rounded-[7px] border border-sage-line bg-bone-raised px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-sage-deep uppercase shadow-[var(--shadow)] transition-[background-color,border-color] duration-fast ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-progress"
            >
              {current.block.done_at !== null ? "Undo done" : "Mark done"}
            </button>
          </>
        ) : null}
      </div>
      {next !== null ? (
        <p className="col-span-full flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-dashed border-sage-line pt-3 text-[12.5px] text-ink-muted">
          <span>Next</span>
          <b className="font-medium text-ink">{next.block.title}</b>
          <span className="font-numeric">{formatMinuteOfDay(next.startMin)}</span>
          <span className="rounded-full bg-sage-fill px-2.5 py-0.5 text-[11px] text-sage-deep">in {formatSpan(next.startMin - nowMin)}</span>
          {gap !== undefined ? (
            <span className="rounded-full bg-sage-fill px-2.5 py-0.5 text-[11px] text-sage-deep">
              {gap.endMin - gap.startMin} min gap after {current!.block.title}
            </span>
          ) : null}
        </p>
      ) : null}
    </motion.section>
  );
}
