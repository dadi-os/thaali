import { Card } from "../../shared/components/Card";
import { Icon, type IconName } from "../../shared/components/Icon";
import { Truncate } from "../../shared/components/Truncate";
import type { ChaaviFolder, ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { ITEM_TYPES, TYPE_META, type VaultScope } from "./draft";

type ScopeRowProps = {
  icon: IconName;
  name: string;
  count: number;
  selected: boolean;
  /** Indent in nesting levels. */
  depth?: number;
  onClick: () => void;
};

/** One row of the pane: a glyph, a name and how many items it holds; the chosen scope's row is washed in sage. */
function ScopeRow({ icon, name, count, selected, depth = 0, onClick }: ScopeRowProps) {
  return (
    <button
      type="button"
      className="ui-trans ui-hover-fill"
      aria-current={selected ? "true" : "false"}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 38, padding: `0 12px 0 ${12 + depth * 16}px`, borderRadius: 11, background: selected ? "var(--sage-active)" : "transparent", fontWeight: selected ? 600 : 500 }}
    >
      <span style={{ display: "flex", color: selected ? "var(--sage-text)" : "var(--ink-muted)" }}>
        <Icon name={icon} size={15} />
      </span>
      <Truncate text={name} style={{ flex: 1, minWidth: 0, fontSize: 14 }} />
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}

/** The label above a group of rows. */
function GroupLabel({ children }: { children: string }) {
  return (
    <span className="ui-label" style={{ padding: "14px 12px 6px", fontSize: 10.5 }}>
      {children}
    </span>
  );
}

export type FolderPaneProps = {
  /** Every item in the vault, which the counts are of. */
  items: ChaaviItem[];
  folders: ChaaviFolder[];
  scope: VaultScope;
  onScope: (scope: VaultScope) => void;
};

/** The pane that narrows the list: all items, the favorites, each kind of item the vault holds and each folder, every row with its count. */
export function FolderPane({ items, folders, scope, onScope }: FolderPaneProps) {
  const kinds = new Map<ChaaviItemType, number>();
  for (const item of items) {
    kinds.set(item.type, (kinds.get(item.type) ?? 0) + 1);
  }
  return (
    <Card style={{ width: 232, flex: "none", padding: 8, gap: 2, minHeight: 0 }}>
      <ScopeRow icon="grid" name="All items" count={items.length} selected={scope.kind === "all"} onClick={() => onScope({ kind: "all" })} />
      <ScopeRow icon="star" name="Favorites" count={items.filter((item) => item.favorite).length} selected={scope.kind === "favorites"} onClick={() => onScope({ kind: "favorites" })} />
      <GroupLabel>Types</GroupLabel>
      {ITEM_TYPES.filter((type) => kinds.has(type)).map((type) => (
        <ScopeRow key={type} icon={TYPE_META[type].icon} name={TYPE_META[type].many} count={kinds.get(type)!} selected={scope.kind === "type" && scope.type === type} onClick={() => onScope({ kind: "type", type })} />
      ))}
      <GroupLabel>Folders</GroupLabel>
      {folders.map((folder) => (
        <ScopeRow
          key={folder.id}
          icon="folder"
          name={folder.name.split("/").pop()!}
          count={items.filter((item) => item.folderId === folder.id).length}
          selected={scope.kind === "folder" && scope.id === folder.id}
          depth={folder.name.split("/").length - 1}
          onClick={() => onScope({ kind: "folder", id: folder.id })}
        />
      ))}
    </Card>
  );
}
