import { useState, type CSSProperties } from "react";
import { Icon } from "../../shared/ui/Icon";
import { Card } from "../../shared/ui/Card";
import { Truncate } from "../../shared/ui/Truncate";
import { formatClock } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { itemKey } from "./plans";

/** A due time this close, in ms, is "soon". */
const SOON_MS = 3 * 3_600_000;

/** How near a due time is: already `overdue`, `soon` (within three hours), or `later`. */
export type DueUrgency = "overdue" | "soon" | "later";

/** Classifies a due instant against `now`. */
export function dueUrgency(dueAt: string, now: Date): DueUrgency {
  const left = Date.parse(dueAt) - now.getTime();
  return left < 0 ? "overdue" : left <= SOON_MS ? "soon" : "later";
}

/** A day's due-at items in time order, earliest first. */
export function dueInOrder(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
}

const ROW: Record<DueUrgency, CSSProperties> = {
  later: { background: "var(--due-fill)", border: "1px solid var(--due-line)", borderLeft: "3px solid var(--clay)", color: "var(--due-ink)" },
  soon: { background: "var(--due-fill)", border: "1px solid var(--clay)", borderLeft: "3px solid var(--clay)", color: "var(--due-ink)", fontWeight: 600 },
  overdue: { background: "var(--error-fill)", border: "1px solid var(--error-line)", borderLeft: "3px solid var(--error)", color: "var(--error)" },
};

/** Props of {@link DuePanel}. */
export type DuePanelProps = {
  /** The day's due-at plans. */
  items: TimelineItem[];
  /** Real instant, for overdue and soon emphasis. */
  now: Date;
  /** Occurrence key of the plan whose details are open. */
  selected: string | null;
  /** Opens a plan's details under the chosen control. */
  onOpen: (item: TimelineItem, element: Element) => void;
  /** Beside the hour grid, filling the column's height; false puts it above the grid as a collapsible section with a capped height. */
  docked: boolean;
};

/**
 * The day's Due panel: every due-at plan in time order, each opening its details, in a list that scrolls on its own so none
 * is ever left off. Docked it fills the side column; undocked it is a collapsible section whose list is capped in height.
 */
export function DuePanel({ items, now, selected, onOpen, docked }: DuePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sorted = dueInOrder(items);
  const open = docked || !collapsed;
  const header = (
    <>
      <span className="ui-label">Due</span>
      <span className="text-[12px] text-ink-muted tabular-nums">{sorted.length}</span>
    </>
  );
  return (
    <Card
      aria-label="Due"
      style={{ padding: 16, minWidth: 0, gap: 10, minHeight: 0, flex: docked ? "1 1 220px" : "none", ...(docked ? { minHeight: 200 } : {}) }}
    >
      {docked ? (
        <div className="flex flex-none items-baseline justify-between">{header}</div>
      ) : (
        <button type="button" aria-expanded={open} onClick={() => setCollapsed(open)} className="ui-trans flex flex-none items-center justify-between gap-2 text-left">
          <span className="flex items-baseline gap-2">{header}</span>
          <span style={{ display: "flex", transform: open ? "rotate(90deg)" : "none" }}>
            <Icon name="chevron" size={14} />
          </span>
        </button>
      )}
      {open ? (
        sorted.length === 0 ? (
          <span className="text-[13px] text-ink-muted">Nothing due</span>
        ) : (
          <ul className="scroll m-0 flex min-h-0 list-none flex-col gap-1.5 p-0" style={docked ? { flex: 1 } : { maxHeight: "min(22vh, 150px)" }}>
            {sorted.map((item) => {
              const urgency = dueUrgency(item.due_at!, now);
              const meta = [urgency === "overdue" ? "overdue" : null, item.owner === "manual" || item.owner === "ingest" ? null : item.owner.replace(/-specialist$/, "")].filter(Boolean).join(" · ");
              return (
                <li key={itemKey(item)} className="flex-none">
                  <button
                    type="button"
                    className="ui-trans ui-hover-fill flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px]"
                    aria-haspopup="menu"
                    aria-expanded={selected === itemKey(item)}
                    data-urgency={urgency}
                    onClick={(event) => onOpen(item, event.currentTarget)}
                    style={ROW[urgency]}
                  >
                    <span className="w-[4.25rem] flex-none whitespace-nowrap text-[12px] tabular-nums">{formatClock(item.due_at!)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Truncate text={item.title} style={{ fontWeight: 600 }} />
                      {meta === "" ? null : <Truncate text={meta} style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.8 }} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </Card>
  );
}
