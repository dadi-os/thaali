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
};

/** One fact of a sheet on a line: a quiet label at the left and its value at the right. */
export function KeyValue({ label, children, selectable = false }: KeyValueProps) {
  return (
    <div className="flex min-h-8 min-w-0 items-baseline gap-3 text-[13px]">
      <span className="flex-none text-ink-muted">{label}</span>
      <span data-selectable={selectable ? "" : undefined} className="ml-auto min-w-0 truncate text-right font-medium tabular-nums">
        {children}
      </span>
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
