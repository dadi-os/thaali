import { useState } from "react";
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

/** The dot, the time's ink and the title's ink of a row, by how near its due time is. */
const LOOK: Record<DueUrgency, { dot: string; time: string; title: string }> = {
  later: { dot: "bg-ink-ghost", time: "text-ink-muted", title: "text-ink" },
  soon: { dot: "bg-clay", time: "text-due-ink", title: "text-ink" },
  overdue: { dot: "bg-error", time: "text-error", title: "text-error" },
};

/** The tallest the docked panel grows to, in px, before its list scrolls inside it. */
const DOCKED_CAP = 360;

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
  /** In the side rail, as tall as its rows up to a cap; false puts it above the grid as a collapsible section with a capped height. */
  docked: boolean;
};

/**
 * The day's Due card: every due-at plan in time order, each opening its details, in a list that scrolls inside the card so none
 * is ever left off. Docked it is as tall as its rows up to a cap; undocked it is a collapsible section whose list is capped in height.
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
    <Card aria-label="Due" style={{ padding: 16, gap: 10, flex: "none", maxHeight: docked ? DOCKED_CAP : undefined }}>
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
          <ul className="scroll -mx-1.5 m-0 flex min-h-0 list-none flex-col gap-0.5 p-0" style={docked ? undefined : { maxHeight: "min(22vh, 150px)" }}>
            {sorted.map((item) => {
              const urgency = dueUrgency(item.due_at!, now);
              const look = LOOK[urgency];
              const meta = [urgency === "overdue" ? "overdue" : null, item.owner === "manual" || item.owner === "ingest" ? null : item.owner.replace(/-specialist$/, "")].filter(Boolean).join(" · ");
              return (
                <li key={itemKey(item)} className="flex-none">
                  <button
                    type="button"
                    className="ui-trans ui-hover-fill flex w-full items-start gap-2.5 rounded-[10px] px-1.5 py-1.5 text-left text-[13px]"
                    aria-haspopup="menu"
                    aria-expanded={selected === itemKey(item)}
                    data-urgency={urgency}
                    onClick={(event) => onOpen(item, event.currentTarget)}
                  >
                    <span className={`mt-[6px] size-2 flex-none rounded-full ${look.dot}`} />
                    <span className={`w-[4.25rem] flex-none pt-px text-[12px] whitespace-nowrap tabular-nums ${look.time}`}>{formatClock(item.due_at!)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Truncate text={item.title} className={`font-medium ${look.title}`} />
                      {meta === "" ? null : <Truncate text={meta} className="text-[11.5px] text-ink-muted" />}
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
