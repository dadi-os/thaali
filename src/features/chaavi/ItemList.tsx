import { Card } from "../../shared/components/Card";
import { Icon } from "../../shared/components/Icon";
import { StateView } from "../../shared/components/ModuleState";
import { Truncate } from "../../shared/components/Truncate";
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

export type ItemListProps = {
  /** The items to list, in the order to show them. */
  items: ChaaviItem[];
  selectedId: string | null;
  query: string;
  /** What the search box holds is why an empty list is empty. */
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  /** The card's width in px. */
  width: number;
};

/** The search box over the scrolling list of items: a mark, the name and one public line each, and a star, passkey and one-time code glyph where the item has them. */
export function ItemList({ items, selectedId, query, onQuery, onSelect, width }: ItemListProps) {
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
              }
            }}
          />
        </label>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 8px 8px" }}>
        {items.length === 0 ? (
          <StateView kind="empty" title="No matches" detail="Nothing in the vault fits that." dense />
        ) : (
          items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  className="ui-trans ui-hover-fill"
                  aria-current={selected ? "true" : "false"}
                  onClick={() => onSelect(item.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: 56, padding: "0 10px", borderRadius: 12, background: selected ? "var(--sage-active)" : "transparent" }}
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
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
