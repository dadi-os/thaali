import type { TimelineItem } from "../../types/timeline";


/** Clay dot with a slow outward pulse: something happening right now. */
export function LiveDot() {
  return (
    <span aria-hidden className="relative inline-flex size-1.5 shrink-0 self-center">
      <span className="animate-pulse-out absolute inset-0 rounded-full bg-[var(--clay)]" />
      <span className="relative size-1.5 rounded-full bg-[var(--clay)]" />
    </span>
  );
}

/** Ring that breathes out from a round badge (today's date). Parent must be `relative`. */
export function BreathRing() {
  return (
    <span
      aria-hidden
      className="animate-pulse-out pointer-events-none absolute inset-0 rounded-full ring-1 ring-sage [--pulse-from:0.7] [--pulse-scale:1.35]"
    />
  );
}

export type SessionMarkProps = {
  /** The session to mark. */
  item: TimelineItem;
  /** Ticking clock: a session past its end without a mark reads as ended. */
  now: Date;
  /** Diameter utility, `size-4` on a block. */
  className?: string;
};

/**
 * Khisso's Completed circle, so both apps mark a session alike: a clay disc with a check once
 * it is Completed, a dashed ring once it has ended without a mark (or was missed), a hollow
 * ring while it is still ahead, and nothing for a cancelled session.
 */
export function SessionMark({ item, now, className = "size-4" }: SessionMarkProps) {
  if (item.state === "cancelled") {
    return null;
  }
  if (item.outcome === "done") {
    return (
      <span aria-label="Completed" className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--clay)] ${className}`}>
        <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="var(--bone)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  const ended = item.outcome === "missed" || (item.end_at !== null && new Date(item.end_at).getTime() <= now.getTime());
  return (
    <span
      aria-label={ended ? "Ended, not marked" : "Upcoming"}
      className={`shrink-0 rounded-full border-[1.5px] ${ended ? "border-dashed border-ink-ghost" : "border-ink-faint"} ${className}`}
    />
  );
}
