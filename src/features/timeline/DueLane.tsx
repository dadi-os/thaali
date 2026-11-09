import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDismiss } from "../../shared/interaction/dismiss";
import { formatClock } from "../../shared/lib/ux/time";
import { Truncate } from "../../shared/ui/Truncate";
import type { TimelineItem } from "../../types/timeline";
import { clusterDues, DUE_TAG_HEIGHT } from "./dueClusters";
import { itemKey } from "./plans";

/** Width in px of the due lane at the right of the day column. */
export const DUE_LANE_WIDTH = 156;
/** Width in px of an expanded cluster's list. */
const LIST_WIDTH = 248;

const TAG: CSSProperties = {
  height: DUE_TAG_HEIGHT,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 8px",
  borderRadius: 8,
  background: "var(--due-fill)",
  border: "1px solid var(--due-line)",
  borderLeft: "3px solid var(--clay)",
  color: "var(--due-ink)",
  fontSize: 12,
  textAlign: "left",
  boxSizing: "border-box",
};

export type DueLaneProps = {
  /** The day's due-at plans. */
  items: TimelineItem[];
  /** Distance in px from the top of the axis of a due time in minutes. */
  top: (item: TimelineItem) => number;
  /** Occurrence key of the plan whose details are open. */
  selected: string | null;
  /** Opens a plan's details under the chosen control. */
  onOpen: (item: TimelineItem, element: Element) => void;
};

/** One due plan's title and time, as a tag or as a row in an expanded list. */
function DueText({ item }: { item: TimelineItem }) {
  return (
    <>
      <Truncate text={item.title} style={{ flex: 1, minWidth: 0, fontWeight: 600 }} />
      <span style={{ flex: "none", fontVariantNumeric: "tabular-nums" }}>{formatClock(item.due_at!)}</span>
    </>
  );
}

/**
 * The day's due lane: each due-at plan sits at its time as a compact clay tag with its title and time; plans too close to
 * draw apart become one `<N> due` pill that opens in place into a stacked list, each row opening the plan's details.
 */
export function DueLane({ items, top, selected, onOpen }: DueLaneProps) {
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const clusters = clusterDues(items.map((item) => ({ item, y: top(item) })));
  const stamp = items.map(itemKey).join("|");
  useEffect(() => setOpen(null), [stamp]);
  useDismiss({ open: open !== null, onDismiss: () => setOpen(null), surface: root, outside: true });
  return (
    <div ref={root} style={{ position: "absolute", right: 8, top: 0, bottom: 0, width: DUE_LANE_WIDTH, zIndex: 3, pointerEvents: "none" }}>
      {clusters.map((cluster, index) => {
        const y = cluster.y - DUE_TAG_HEIGHT / 2;
        const [only] = cluster.items;
        if (cluster.items.length === 1) {
          return (
            <button
              key={itemKey(only)}
              type="button"
              className="ui-trans ui-hover-fill"
              aria-haspopup="menu"
              aria-expanded={selected === itemKey(only)}
              onClick={(event) => onOpen(only, event.currentTarget)}
              style={{ ...TAG, position: "absolute", left: 0, right: 0, top: y, pointerEvents: "auto" }}
            >
              <DueText item={only} />
            </button>
          );
        }
        const expanded = open === index;
        return (
          <div key={`cluster-${itemKey(only)}`} style={{ position: "absolute", left: 0, right: 0, top: y, height: DUE_TAG_HEIGHT }}>
            <button
              type="button"
              className="ui-trans ui-hover-fill"
              aria-expanded={expanded}
              aria-label={`${cluster.items.length} due`}
              onClick={() => setOpen(expanded ? null : index)}
              style={{ ...TAG, width: "100%", fontWeight: 600, pointerEvents: "auto" }}
            >
              <span style={{ flex: 1 }}>{`${cluster.items.length} due`}</span>
              <span style={{ flex: "none", fontVariantNumeric: "tabular-nums", fontWeight: 400 }}>{formatClock(only.due_at!)}</span>
            </button>
            {expanded ? (
              <div
                role="menu"
                aria-label={`${cluster.items.length} due`}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: LIST_WIDTH,
                  maxHeight: 280,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: 6,
                  borderRadius: 12,
                  background: "var(--bone-raised)",
                  border: "1px solid var(--rule)",
                  boxShadow: "0 6px 20px rgba(44,48,42,.16)",
                  zIndex: 4,
                  pointerEvents: "auto",
                }}
              >
                {cluster.items.map((item) => (
                  <button
                    key={itemKey(item)}
                    type="button"
                    role="menuitem"
                    className="ui-trans ui-hover-fill"
                    onClick={(event) => {
                      setOpen(null);
                      onOpen(item, event.currentTarget);
                    }}
                    style={{ ...TAG, flex: "none" }}
                  >
                    <DueText item={item} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
