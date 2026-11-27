import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BREATH_S, SPRING } from "../../shared/motion";
import { Clamp, Truncate } from "../../shared/ui/Truncate";

export type SomedayCardProps = {
  /** The accessible name and the words on the card. */
  title: string;
  /** Quiet lines under the title: who keeps it, when it was last checked. */
  meta: string[];
  /** The ring that ticks the task, or the mark of a plan. */
  lead: ReactNode;
  /** Controls at the card's far corner (message the keeper). */
  trail?: ReactNode;
  /** The request waiting on the task's agent, which replaces the quiet lines until the task gains a close date. */
  asked?: string[] | null;
  /** Ticked and fading out: the title is struck and the card quiet. */
  done?: boolean;
  /** Lifted out of the board because it is being dragged. */
  lifted?: boolean;
  /** Waiting for a day from the strip. */
  armed?: boolean;
  /** Opens the card's details. */
  onOpen: (element: Element) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Swallows the click that ends a drag. */
  wasDragged?: () => boolean;
  /** A context menu's `data-context`. */
  rest?: { "data-context"?: string };
};

/**
 * One floating glass card of the Someday board: a lead (ring or mark), the title in up to three lines, its quiet line. It lifts on
 * hover, sinks on press, takes the app's chosen wash while armed, springs out when ticked, and is a single tab stop the arrow keys travel between.
 */
export function SomedayCard({ title, meta, lead, trail, asked = null, done = false, lifted = false, armed = false, onOpen, onKeyDown, onPointerDown, wasDragged, rest }: SomedayCardProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: lifted ? 0.4 : done ? 0.55 : asked !== null ? (reduce ? 0.8 : [0.65, 0.9, 0.65]) : 1, scale: lifted ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { type: "spring", stiffness: 520, damping: 42 } }}
      transition={asked !== null && !reduce ? { ...SPRING, opacity: { duration: BREATH_S, repeat: Infinity, ease: "easeInOut" } } : SPRING}
      role="group"
      aria-label={title}
      tabIndex={0}
      data-card=""
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (wasDragged?.() === true || (event.target as Element).closest("button") !== null) return;
        onOpen(event.currentTarget);
      }}
      className={`ui-trans group/card flex min-h-[124px] cursor-pointer touch-none flex-col gap-1 rounded-[18px] border p-4 outline-none select-none hover:-translate-y-0.5 hover:border-sage-line focus-visible:outline-2 focus-visible:outline-sage-line active:scale-[0.985] ${armed ? "hl-on" : ""}`}
      style={{ background: armed ? undefined : "var(--glass-veil)", borderColor: armed ? "var(--sage-deep)" : "var(--glass-border)", boxShadow: "var(--shadow-card)" }}
      {...rest}
    >
      <div className="-mt-2 -ml-2 flex items-center justify-between">
        {lead}
        {trail}
      </div>
      <Clamp text={title} lines={3} style={{ fontSize: 15, lineHeight: "20px", fontWeight: 500, textDecoration: done ? "line-through" : undefined, color: done ? "var(--ink-muted)" : "var(--ink)" }} />
      <div className="mt-auto flex flex-col pt-2">
        {asked === null ? (
          meta.map((line) => <Truncate key={line} text={line} className="text-[12px] leading-4 text-ink-muted" />)
        ) : (
          asked.map((line) => <Truncate key={line} text={line} className="text-[12px] leading-4 font-medium text-sage-text" />)
        )}
      </div>
    </motion.div>
  );
}
