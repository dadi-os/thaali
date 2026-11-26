import type { ReactNode } from "react";
import { IconButton } from "../../ui/Button";
import { FadeScroll } from "../../ui/FadeScroll";
import { SectionHeader } from "./Sheet";

/** Props of {@link PopoverHeader}. */
export type PopoverHeaderProps = {
  /** The identity: the title already drawn (a plan's title, a task's, an agent's name). It wraps at any character and never truncates. */
  title: ReactNode;
  /** The one situation line: what is true of this thing now ("Now · 12 min left", "Working · 4 min", "Past due"), drawn with {@link Situation}. Plain type, never a pill. */
  situation?: ReactNode;
  /** The popover's primary action, on the top row between the name and the close control: a small `Button` ("Open thread", "Reply"). */
  action?: ReactNode;
  /** Closes the popover; no control is drawn without it. */
  onClose?: () => void;
};

/**
 * The head of every popover: identity over exactly one situation line, the primary action (a small Button) and the close control at the right. 20 px sides, 20 px
 * above, 12 px below; the title is 19 px semibold on 28 px lines, the situation sits 6 px under it.
 */
export function PopoverHeader({ title, situation, action, onClose }: PopoverHeaderProps) {
  return (
    <header className="flex flex-none items-start gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <div className="min-w-0 text-[19px] leading-7 font-semibold tracking-[-0.015em]">{title}</div>
        {situation}
      </div>
      {action === undefined ? null : <div className="flex flex-none pt-0.5">{action}</div>}
      {onClose ? <IconButton icon="close" label="Close" onClick={onClose} /> : null}
    </header>
  );
}

/** Props of {@link PopoverBody}. */
export type PopoverBodyProps = {
  children: ReactNode;
};

/**
 * Everything under the header, in the one order every popover keeps: the facts block, the actions row, then inset sections.
 * It scrolls inside the popover's fixed height and fades at an edge that has more beyond it; its sides are 20 px and sections are 12 px apart.
 */
export function PopoverBody({ children }: PopoverBodyProps) {
  return (
    <FadeScroll className="flex-1">
      <div className="flex flex-col gap-3 px-5 pt-1 pb-5">{children}</div>
    </FadeScroll>
  );
}

/** Props of {@link PopoverFacts}. */
export type PopoverFactsProps = {
  /** {@link KeyValue} rows: each a label and a value that is a fact. */
  children: ReactNode;
};

/** The facts block: label/value rows one under another with no card, so the popover reads as a short form. */
export function PopoverFacts({ children }: PopoverFactsProps) {
  return <div className="flex flex-col">{children}</div>;
}

/** Props of {@link PopoverActions}. */
export type PopoverActionsProps = {
  /** Buttons, the primary (a `fill` Button) first, the rest `quiet`. */
  children: ReactNode;
  /** A line that opens under the buttons, such as a confirmation, drawn by the caller. */
  below?: ReactNode;
};

/** The actions row: the primary action first, secondary ones after it, wrapping as a row; a confirmation may open under it. */
export function PopoverActions({ children, below }: PopoverActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {below}
    </div>
  );
}

/** Props of {@link InsetCard}. */
export type InsetCardProps = {
  /** The caps label that heads the card (Notes, About, Wakes). */
  title: string;
  /** How many rows it holds, when that is a fact worth showing. */
  count?: number | string;
  /** A control at the far end of the header. */
  action?: ReactNode;
  children: ReactNode;
};

/** An inset section: a 14 px rounded soft sage card with 16 px sides, a caps header and its content. */
export function InsetCard({ title, count, action, children }: InsetCardProps) {
  return (
    <section className="flex flex-col gap-1 rounded-[14px] bg-sage-fill px-4 py-2.5">
      <SectionHeader title={title} count={count} action={action} />
      {children}
    </section>
  );
}

/** How a {@link Situation} reads: the dot's colour and the phrase's. `late` is for what is past its time or cannot go on. */
export type SituationTone = "live" | "wait" | "late" | "rest";

const DOT: Record<SituationTone, string> = { live: "bg-sage", wait: "bg-tide", late: "bg-[var(--late-ink)]", rest: "bg-ink-ghost" };

/** Props of {@link Situation}. */
export type SituationProps = {
  tone: SituationTone;
  /** The short phrase, with its fact: "Working · 4 min", "Starts in 25 min", "Past due by 2 days". */
  children: ReactNode;
};

/** The situation line of a popover's header: a 7 px coloured dot and one short phrase in 13.5 px medium type. Not a pill. */
export function Situation({ tone, children }: SituationProps) {
  return (
    <span className={`flex items-center gap-2 text-[13.5px] font-medium ${tone === "late" ? "text-[var(--late-ink)]" : "text-ink"}`}>
      <span className={`size-[7px] flex-none rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
