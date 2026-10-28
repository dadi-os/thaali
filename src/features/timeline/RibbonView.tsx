import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { isSameDay } from "./dates";
import type { TimelineItem } from "../../types/timeline";
import { itemKey, plansOn, runsAsBar, spanOf } from "./plans";

/** Height of one session row in a day column (time line plus title line plus gap). */
const ROW_PX = 33;
/** Height a day column spends on its weekday, date and all-day pill before its rows. */
const HEAD_PX = 84;

/** Kinds drawn in the course tone; deadlines take clay, everything else sage. */
const COURSE_KINDS = new Set(["class", "lab", "exam"]);

export type RibbonViewProps = {
  /** Mon–Sun of the shown week. */
  days: Date[];
  labels: string[];
  today: Date;
  /** Ticking clock: fades what already happened. */
  now: Date;
  /** The week's commitments: sessions and dues, routines left out. */
  plans: TimelineItem[];
  /** The week is still loading: each day shows skeleton rows instead of an empty column. */
  loading: boolean;
  /** A plan was clicked: open it beside `el` without leaving the tile. */
  onOpen: (item: TimelineItem, el: Element) => void;
  className?: string;
};

/** "8:00", "1:32": the hour and minutes without the period, as on the canvas. */
function shortTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Home Timeline tile, as on the canvas: seven day columns, today tinted with its date in a
 * sage disc, the day's all-day or multi-day plan (a confirmed one first) as a tide pill, then its sessions and dues as
 * a time line with a dot (clay for a due, tide for a class, sage otherwise) over the title,
 * as many as the tile's height holds and "+N more" for the rest. Past rows fade; a row opens
 * in place, and the rest of the tile opens the full timeline.
 */
export function RibbonView({ days, labels, today, now, plans, loading, onOpen, className = "" }: RibbonViewProps) {
  const grid = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = grid.current!;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);
  const fits = Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX));

  return (
    <div ref={grid} className={`grid h-full min-h-0 grid-cols-7 gap-1 px-2.5 pt-2 pb-3 ${className}`}>
      {days.map((day, i) => {
        const isToday = isSameDay(day, today);
        const dayPlans = plansOn(plans, day);
        const bars = dayPlans.filter(runsAsBar);
        const allDay = bars.find((p) => p.status === "confirmed") ?? bars[0];
        const rows = dayPlans.filter((p) => !runsAsBar(p));
        const shown = rows.length > fits ? rows.slice(0, fits - 1) : rows;
        const more = rows.length - shown.length;
        return (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 }}
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] ${isToday ? "bg-sage-fill" : ""}`}
          >
            <div className="flex shrink-0 flex-col items-center gap-[3px] pt-1.5 pb-2">
              <span className="text-[11px] font-medium text-ink-ghost">{labels[i]}</span>
              <span
                className={`flex size-[26px] items-center justify-center rounded-full text-[13px] font-semibold ${
                  isToday ? "bg-sage-deep text-bone" : "text-ink"
                }`}
              >
                {day.getDate()}
              </span>
            </div>
            {allDay ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(allDay, e.currentTarget);
                }}
                className="mx-1 mb-1.5 shrink-0 truncate rounded-[6px] bg-[color-mix(in_srgb,var(--tide)_14%,transparent)] px-1.5 py-[3px] text-left text-[10.5px] font-semibold text-[color-mix(in_srgb,var(--tide)_70%,var(--ink))]"
              >
                {allDay.title}
              </button>
            ) : null}
            {loading
              ? [0, 1, 2].slice(0, i > 4 ? 1 : 3).map((k) => (
                  <span key={k} className="flex flex-col gap-1.5 px-1.5 py-1.5">
                    <span className="skeleton h-2 w-3/5" />
                    <span className="skeleton h-2.5 w-11/12" />
                  </span>
                ))
              : shown.map((p, j) => {
                  const due = p.start_at === null;
                  const at = p.start_at ?? p.due_at!;
                  const past = spanOf(p)!.end.getTime() < now.getTime() || p.outcome === "done";
                  const tone = due ? "var(--clay)" : p.kind !== null && COURSE_KINDS.has(p.kind) ? "var(--tide)" : "var(--sage)";
                  return (
                    <motion.button
                      key={itemKey(p)}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: past ? 0.5 : 1, y: 0 }}
                      transition={{ duration: SLOW_S, ease: EASE, delay: 0.2 + i * 0.04 + j * 0.03 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(p, e.currentTarget);
                      }}
                      className="flex min-w-0 shrink-0 flex-col gap-px rounded-[7px] px-1.5 py-1 text-left transition-colors duration-fast ease-dadi hover:bg-sage-fill"
                    >
                      <span
                        className={`flex min-w-0 items-center gap-1 overflow-hidden text-[10px] font-semibold whitespace-nowrap tabular-nums ${
                          due ? "text-[color-mix(in_srgb,var(--clay)_75%,var(--ink))]" : "text-ink-ghost"
                        }`}
                      >
                        <span aria-hidden className="size-[5px] shrink-0 rounded-full" style={{ background: tone }} />
                        {due ? `due ${shortTime(at)}` : shortTime(at)}
                      </span>
                      <span className="truncate text-[11.5px] font-medium text-ink">{p.title}</span>
                    </motion.button>
                  );
                })}
            {more > 0 ? <span className="px-1.5 pt-0.5 text-[11px] font-medium text-ink-ghost">+{more} more</span> : null}
          </motion.div>
        );
      })}
    </div>
  );
}
