import { motion } from "motion/react";
import { Truncate } from "../../shared/ui/Truncate";
import { SPRING } from "../../shared/motion";
import { dateKey, parseDateKey } from "./dates";
import { dayDropKey, tileLabel } from "./somedayBoard";

export type SomedayDockProps = {
  /** The days the strip offers, today first. */
  days: Date[];
  now: Date;
  /** The day (`YYYY-MM-DD`) a dragged card is over and can land on, or null. */
  hot: string | null;
  /** What the strip says above its tiles. */
  hint: string;
  /** A task is waiting for a day: the tiles show the digit that picks them. */
  picking: boolean;
  /** The first date the picker allows: today. */
  minDate: Date;
  /** Picks a day for the waiting task. */
  onPick: (day: Date) => void;
};

/**
 * The strip of days at the foot of the Someday modal: a drop target for each of the next seven days and, for the keyboard and
 * touch, the place a task armed with S or "Schedule" is given its day. A hot tile lifts and washes sage under a dragged card.
 */
export function SomedayDock({ days, now, hot, hint, picking, minDate, onPick }: SomedayDockProps) {
  return (
    <div className="flex flex-none flex-col gap-3 border-t border-rule px-5 pt-3 pb-5" style={{ background: "var(--glass-sheet)" }}>
      <span className="ui-label">{hint}</span>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {days.map((day, index) => {
          const { name, date } = tileLabel(day, now);
          const key = dayDropKey(day);
          const isHot = hot === key.slice("day:".length);
          return (
            <motion.button
              key={key}
              type="button"
              data-drop={key}
              aria-label={`${name}, ${date}`}
              onClick={() => onPick(day)}
              animate={{ scale: isHot ? 1.06 : 1, y: isHot ? -4 : 0 }}
              transition={SPRING}
              className="ui-hover-fill ui-trans relative flex h-16 min-w-0 flex-col items-start justify-center gap-0.5 rounded-[16px] border px-2.5 text-left"
              style={{ borderColor: isHot ? "var(--sage-deep)" : "var(--glass-border)", background: isHot ? "var(--sage-active)" : "var(--glass-veil)", boxShadow: isHot ? "var(--shadow-card)" : "none" }}
            >
              <Truncate text={name} className="w-full text-[14px] font-semibold text-ink" />
              <Truncate text={date} className="w-full text-[12px] text-ink-muted tabular-nums" />
              {picking ? <span className="absolute top-1.5 right-2 text-[11px] font-medium text-sage-text tabular-nums">{index + 1}</span> : null}
            </motion.button>
          );
        })}
      </div>
      {picking ? (
        <label className="flex items-center gap-3 text-[13px] text-ink-muted">
          Another date
          <input
            type="date"
            aria-label="Pick another date"
            min={dateKey(minDate)}
            className="h-9 rounded-[12px] border bg-bone px-3 text-[13px] text-ink"
            style={{ borderColor: "var(--glass-border)" }}
            onChange={(event) => (event.target.value === "" ? undefined : onPick(parseDateKey(event.target.value)))}
          />
        </label>
      ) : null}
    </div>
  );
}
