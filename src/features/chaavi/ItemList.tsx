import { AnimatePresence, motion } from "motion/react";
import { useContextActions } from "../../shared/interaction/contextMenu";
import type { ActionList } from "../../shared/interaction/actions";
import { RISE } from "../../shared/motion";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Truncate } from "../../shared/ui/Truncate";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ChaaviItem } from "../../types/chaavi";
import { itemSubtitle } from "./draft";

export type AvatarProps = {
  /** The item's name; its first letter is the mark. */
  name: string;
  /** Width and height in px. */
  size: number;
};

/** A rounded square holding the first letter of an item's name. */
export function Avatar({ name, size }: AvatarProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.2,
        background: "var(--sage-active)",
        color: "var(--sage-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 600,
        flex: "none",
      }}
    >
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

export type DragGhostProps = {
  /** The name of the dragged item. */
  name: string;
  /** Where the pointer is in the page, in px. */
  x: number;
  y: number;
};

/** The lifted copy of a dragged item, at the pointer. */
export function DragGhost({ name, x, y }: DragGhostProps) {
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 6px 6px", borderRadius: 12, background: "var(--bone)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-deep)", pointerEvents: "none", zIndex: 40, transform: "translate(-18px, -18px)" }}>
      <Avatar name={name} size={30} />
      <Truncate text={name} style={{ fontSize: 14, fontWeight: 600, maxWidth: 180 }} />
    </div>
  );
}

/** The pointer handlers that make a row draggable. */
export type RowDragHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, item: ChaaviItem) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
};

type ItemRowProps = {
  item: ChaaviItem;
  selected: boolean;
  /** The row is being dragged, so it shows lifted out. */
  dragging: boolean;
  drag: RowDragHandlers;
  actions: (item: ChaaviItem) => ActionList;
  onSelect: (id: string) => void;
};

/** One item of the list: its mark, name and public line, a star, passkey and one-time code glyph where it has them; draggable onto a folder, with the item's menu on right click. */
function ItemRow({ item, selected, dragging, drag, actions, onSelect }: ItemRowProps) {
  const context = useContextActions(() => actions(item));
  return (
    <motion.div layout="position" {...RISE} {...context}>
      <button
        type="button"
        className="ui-trans ui-hover-fill"
        aria-current={selected ? "true" : "false"}
        onPointerDown={(event) => drag.onPointerDown(event, item)}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        onClick={(event) => {
          if (event.detail === 0) {
            onSelect(item.id);
          }
        }}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: 56, padding: "0 10px", borderRadius: 12, background: selected ? "var(--sage-active)" : "transparent", cursor: "grab", touchAction: "none", ...(dragging ? { opacity: 0.35, scale: 0.97 } : {}) }}
      >
        <Avatar name={item.name} size={36} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }}>
          <Truncate text={item.name} style={{ fontSize: 14.5, fontWeight: 600 }} />
          <Truncate text={itemSubtitle(item)} style={{ fontSize: 12.5, color: "var(--ink-muted)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-muted)", flex: "none" }}>
          {item.favorite ? (
            <span style={{ color: "var(--clay)", display: "flex" }}>
              <Icon name="star" size={14} />
            </span>
          ) : null}
          {item.type === "login" && item.login.passkeys.length > 0 ? <Icon name="key" size={14} /> : null}
          {item.type === "login" && item.login.hasTotp ? <Icon name="clock" size={14} /> : null}
        </div>
      </button>
    </motion.div>
  );
}

export type ItemListProps = {
  /** The items to list, in the order to show them. */
  items: ChaaviItem[];
  selectedId: string | null;
  query: string;
  /** What the search box holds is why an empty list is empty. */
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  /** The row being dragged, which shows lifted out. */
  draggingId: string | null;
  drag: RowDragHandlers;
  /** What a right click on a row offers. */
  actions: (item: ChaaviItem) => ActionList;
  /** The card's width in px. */
  width: number;
};

/** The search box over the scrolling list of items: a mark, the name and one public line each, and a star, passkey and one-time code glyph where the item has them. */
export function ItemList({ items, selectedId, query, onQuery, onSelect, draggingId, drag, actions, width }: ItemListProps) {
  return (
    <Card style={{ width, flex: "none", minHeight: 0 }}>
      <div style={{ padding: "12px 12px 8px", flex: "none" }}>
        <label className="search-field">
          <Icon name="search" size={15} />
          <input
            type="search"
            className="sfi"
            placeholder="Search items"
            aria-label="Search items"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onQuery("");
              } else if (event.key === "Enter" && items.length === 1) {
                onSelect(items[0]!.id);
              }
            }}
          />
        </label>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 8px 8px" }}>
        {items.length === 0 ? (
          <StateView kind="empty" title="No matches" detail="Nothing in the vault fits that." dense />
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} selected={item.id === selectedId} dragging={item.id === draggingId} drag={drag} actions={actions} onSelect={onSelect} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
}
