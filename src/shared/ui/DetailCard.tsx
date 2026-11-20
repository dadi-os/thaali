import type { ReactNode } from "react";
import { FadeScroll } from "./FadeScroll";

/** One labelled fact: its label, its value, and optionally a hint after the value and a control beside it. */
export type FactItem = {
  label: string;
  value: ReactNode;
  /** Said after the value in a quieter ink: "1 h 20 min", "in 2 days". */
  hint?: string;
  /** A control at the row's end, such as Directions. */
  action?: ReactNode;
};

/** Props of {@link Facts}. */
export type FactsProps = {
  items: ReadonlyArray<FactItem | null>;
};

/** The label column's width, in px, so every popover's values start at the same edge. */
const LABEL_W = 92;

/** A block of label and value rows. Every row is a fact with a label; nothing is shown bare. A null entry is left out. */
export function Facts({ items }: FactsProps) {
  const rows = items.filter((item): item is FactItem => item !== null);
  return (
    <dl className="m-0 flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 items-baseline gap-3">
          <dt className="flex-none text-[13px] text-ink-muted" style={{ width: LABEL_W }}>
            {row.label}
          </dt>
          <dd className="m-0 flex min-w-0 flex-1 items-baseline gap-2 text-[14px] text-ink">
            <span className="min-w-0 break-words tabular-nums">{row.value}</span>
            {row.hint === undefined ? null : <span className="flex-none text-[13px] text-ink-muted">{row.hint}</span>}
            {row.action === undefined ? null : <span className="ml-auto flex flex-none items-center self-center">{row.action}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Props of {@link InsetSection}. */
export type InsetSectionProps = {
  /** The section's caps label. */
  title: string;
  children: ReactNode;
};

/** A smaller rounded card inside a detail card, under a caps label: Notes, About. */
export function InsetSection({ title, children }: InsetSectionProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-[14px] bg-sage-fill px-3.5 py-3">
      <span className="ui-label">{title}</span>
      {children}
    </section>
  );
}

/** How a situation reads: `live` is on now or done (deep sage), `late` is past due (rose-clay), `calm` is anything else. */
export type StatusTone = "live" | "late" | "calm";

const DOT: Record<StatusTone, string> = { live: "var(--sage-deep)", late: "var(--late)", calm: "var(--sage-line)" };
const INK: Record<StatusTone, string> = { live: "var(--sage-text)", late: "var(--late-ink)", calm: "var(--ink-muted)" };

/** Props of {@link DetailCard}. */
export type DetailCardProps = {
  /** What the item is called; it wraps to two lines. */
  title: string;
  /** The one line that states the situation, a dot and a phrase: "Now · 12 min left", "Past due by 5 days". */
  status: { label: string; tone: StatusTone; icon?: ReactNode } | null;
  /** The title is muted: the item is declined, done or missed. */
  muted?: boolean;
  /** The title is struck through. */
  struck?: boolean;
  /** The facts block. */
  facts: ReadonlyArray<FactItem | null>;
  /** The actions row, primary action first. */
  actions: ReactNode;
  /** Inset sections under the actions; omit when there are none. */
  sections?: ReactNode;
  /** The tallest the sections grow to before they scroll, in px. */
  sectionsMax?: number;
};

/**
 * The one anatomy of a detail popover: a header (the situation as a chip, then the title), a facts block of labelled rows,
 * an actions row with the primary action first, and inset sections for notes. Plans, tasks and agents share it, so rows
 * sit at the same offsets from one popover to the next.
 */
export function DetailCard({ title, status, muted = false, struck = false, facts, actions, sections, sectionsMax = 200 }: DetailCardProps) {
  return (
    <div data-selectable className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-2.5 px-5 pt-5 pb-3.5">
        {status === null ? null : (
          <div className="flex min-h-6 items-center gap-2" style={{ color: INK[status.tone] }}>
            {status.icon === undefined ? <span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: DOT[status.tone] }} /> : <span className="flex flex-none">{status.icon}</span>}
            <span className="text-[14px] font-semibold tabular-nums">{status.label}</span>
          </div>
        )}
        <h3 title={title} className={`m-0 line-clamp-2 text-[20px] leading-7 font-semibold tracking-[-0.015em] break-words ${muted ? "text-ink-muted" : "text-ink"} ${struck ? "line-through decoration-ink-ghost decoration-2" : ""}`}>
          {title}
        </h3>
      </div>
      <div className="flex-none px-5 pb-4">
        <Facts items={facts} />
      </div>
      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-rule px-5 py-3">{actions}</div>
      {sections === undefined ? null : (
        <FadeScroll maxHeight={sectionsMax} className="flex-1">
          <div className="flex flex-col gap-2.5 px-4 pt-1 pb-4">{sections}</div>
        </FadeScroll>
      )}
    </div>
  );
}
