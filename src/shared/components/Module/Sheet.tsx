import type { ReactNode } from "react";

/** Props of {@link SectionHeader}. */
export type SectionHeaderProps = {
  /** The small tracked-caps label. */
  title: string;
  /** How many rows the section holds; it keeps a fixed slot so it does not jump as it changes. */
  count?: number | string;
  /** A control at the far end, such as a button. */
  action?: ReactNode;
};

/** The label that heads a section of a tile or sheet, with an optional count and action at the far end. */
export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div className="flex h-6 min-w-0 flex-none items-center gap-2">
      <span className="ui-label truncate">{title}</span>
      {count === undefined ? null : <span className="ml-auto min-w-[2ch] text-right text-[13px] text-ink-muted tabular-nums">{count}</span>}
      {action === undefined ? null : <span className={count === undefined ? "ml-auto" : ""}>{action}</span>}
    </div>
  );
}

/** Props of {@link SheetHeader}. */
export type SheetHeaderProps = {
  /** The name, already drawn (it may be an agent name or an input while renaming). */
  name: ReactNode;
  /** The line under the name: state chips, kind or where it is. */
  status?: ReactNode;
  /** The sheet's primary action or its close control. */
  action?: ReactNode;
};

/** The head of a side sheet: the name over its status at the left and the primary action at the right. */
export function SheetHeader({ name, status, action }: SheetHeaderProps) {
  return (
    <div className="flex flex-none items-start gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {name}
        {status}
      </div>
      {action}
    </div>
  );
}

/** Props of {@link KeyValue}. */
export type KeyValueProps = {
  /** What the fact is. */
  label: string;
  /** The fact. */
  children: ReactNode;
  /** The value is text a person may copy. */
  selectable?: boolean;
  /** A quiet second fact after the value (a clock beside "in 20 min"), kept on the line when the value truncates. */
  hint?: string;
  /** `late` for a value that is past its time (an answer overdue, a task past due). */
  tone?: "late";
  /** The row stacks: the label (and its hint) over the value, which may take two lines, for words such as a task's. */
  wrap?: boolean;
  /** How many lines a stacked value may take before it is cut: 2 (the default) or 4, for a message. */
  lines?: 2 | 4;
};

/** One fact of a sheet on a line: a quiet label at the left and its value at the right, 32 px tall at least. */
export function KeyValue({ label, children, selectable = false, hint, tone, wrap = false, lines = 2 }: KeyValueProps) {
  return (
    <div className={`flex min-w-0 text-[13px] ${wrap ? "flex-col gap-0.5 py-1.5" : "min-h-8 items-center gap-3"}`}>
      <span className={`flex-none text-ink-muted ${wrap && hint !== undefined ? "flex items-baseline gap-2" : ""}`}>
        {label}
        {wrap && hint !== undefined ? <span className="text-ink-ghost">{hint}</span> : null}
      </span>
      <span
        data-selectable={selectable ? "" : undefined}
        className={`min-w-0 font-medium tabular-nums ${wrap ? `${lines === 4 ? "line-clamp-4" : "line-clamp-2"} text-[13.5px] leading-[19px] [overflow-wrap:anywhere]` : "ml-auto truncate text-right"} ${tone === "late" ? "text-[var(--late-ink)]" : ""}`}
      >
        {children}
      </span>
      {hint === undefined || wrap ? null : <span className="flex-none text-ink-ghost">{hint}</span>}
    </div>
  );
}

/** Props of {@link FieldRow}. */
export type FieldRowProps = {
  /** The caps name of the figure. */
  label: string;
  /** The figure. */
  value: string;
  /** A quiet line under the figure. */
  note?: string;
  /** The note is text a person may copy. */
  selectable?: boolean;
};

/** A figure of a sheet in a sage cell: caps label, the figure and a quiet line under it. */
export function FieldRow({ label, value, note, selectable = false }: FieldRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[12px] bg-sage-fill px-3 py-3">
      <span className="ui-label">{label}</span>
      <span className="text-[17px] leading-[22px] font-semibold tabular-nums">{value}</span>
      {note ? (
        <span data-selectable={selectable ? "" : undefined} className="truncate text-[13px] text-ink-muted" title={note}>
          {note}
        </span>
      ) : null}
    </div>
  );
}
