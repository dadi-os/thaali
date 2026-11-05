import { useState, type ReactElement } from "react";
import { motion } from "motion/react";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { EASE, SLOW_S } from "../../shared/motion";
import { Button, ButtonGroup, IconButton } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Icon, type IconName } from "../../shared/ui/Icon";
import { Truncate } from "../../shared/ui/Truncate";
import type { ChaaviFolder, ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { ITEM_TYPES, TYPE_META, type VaultScope } from "./draft";
import { folderActions } from "./actions";
import { buildFolderTree, joinPath, parentPath, type FolderNode } from "./folders";

/** The washed background and halo of a row an item is dragged over, or has just landed on. */
const HOT_STYLE = { background: "var(--sage-active)", boxShadow: "0 0 0 3px var(--sage-faint)" } as const;

/** What the pane is asking the person for in place of a row. */
type FolderEdit = { mode: "create"; parent: string | null } | { mode: "rename"; path: string } | { mode: "delete"; path: string };

type ScopeRowProps = {
  icon: IconName;
  name: string;
  count: number;
  selected: boolean;
  /** The key a dragged item lands on, when the row takes drops. */
  drop?: string;
  /** An item is over the row or has just landed on it. */
  hot?: boolean;
  onClick: () => void;
};

/** One row of the pane: a glyph, a name and how many items it holds; the chosen scope's row is washed in sage. */
function ScopeRow({ icon, name, count, selected, drop, hot = false, onClick }: ScopeRowProps) {
  return (
    <button
      type="button"
      className="ui-trans ui-hover-fill"
      data-drop={drop}
      aria-current={selected ? "true" : "false"}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 38, flex: "none", padding: "0 12px", borderRadius: 12, background: selected ? "var(--sage-active)" : "transparent", fontWeight: selected ? 600 : 500, ...(hot ? HOT_STYLE : {}) }}
    >
      <span style={{ display: "flex", color: selected ? "var(--sage-text)" : "var(--ink-muted)" }}>
        <Icon name={icon} size={15} />
      </span>
      <Truncate text={name} style={{ flex: 1, minWidth: 0, fontSize: 14 }} />
      <span style={{ fontSize: 13, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}

/** The label above a group of rows. */
function GroupLabel({ children }: { children: string }) {
  return (
    <span className="ui-label" style={{ padding: "14px 12px 6px", fontSize: 11 }}>
      {children}
    </span>
  );
}

type NameRowProps = {
  depth: number;
  initial: string;
  /** The accessible name of the save control. */
  save: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

/** The inline name field of a new or renamed folder: Enter or the check saves, Escape or the cross leaves. */
function NameRow({ depth, initial, save, onSubmit, onCancel }: NameRowProps) {
  const [name, setName] = useState(initial);
  const submit = () => {
    if (name.trim() !== "") {
      onSubmit(name.trim());
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none", height: 38, padding: `0 8px 0 ${12 + depth * 16}px`, borderRadius: 12, background: "var(--sage-active)" }}>
      <input
        className="cinp"
        type="text"
        aria-label="Folder name"
        placeholder="Folder name"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submit();
          } else if (event.key === "Escape") {
            onCancel();
          }
        }}
        style={{ fontSize: 14, color: "var(--ink)" }}
      />
      <IconButton icon="check" label={save} size={26} iconSize={14} onClick={submit} />
      <IconButton icon="close" label="Cancel" size={26} iconSize={14} onClick={onCancel} />
    </div>
  );
}

type FolderRowProps = {
  node: FolderNode;
  depth: number;
  /** The folder is the chosen scope. */
  on: boolean;
  /** Its children show. */
  open: boolean;
  /** An item is dragged over it. */
  hot: boolean;
  /** The key a dragged item lands on; unset for a folder that exists only as another's path. */
  dropKey: string | undefined;
  busy: boolean;
  onScope: () => void;
  onToggle: () => void;
  onAdd: () => void;
  onRename: () => void;
  onRemove: () => void;
};

/** One folder of the tree: a chevron when it has folders inside, its name and count, and add, rename and delete on hover, also on its right-click menu. */
function FolderRow({ node, depth, on, open, hot, dropKey, busy, onScope, onToggle, onAdd, onRename, onRemove }: FolderRowProps) {
  const context = useContextActions(() => folderActions(node.name, node.id !== null, { busy, add: onAdd, rename: onRename, remove: onRemove }));
  return (
    <div
      {...context}
      className="frow ui-trans ui-hover-fill"
      data-drop={dropKey}
      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", height: 38, flex: "none", padding: `0 8px 0 ${6 + depth * 16}px`, borderRadius: 12, background: on ? "var(--sage-active)" : "transparent", ...(hot ? HOT_STYLE : {}) }}
    >
      {node.children.length > 0 ? (
        <button
          type="button"
          className="ui-trans ui-hover-fill"
          aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
          aria-expanded={open ? "true" : "false"}
          onClick={onToggle}
          style={{ width: 28, height: 28, margin: "0 -4px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", flex: "none" }}
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: SLOW_S, ease: EASE }} style={{ display: "flex" }}>
            <Icon name="chevron" size={12} />
          </motion.span>
        </button>
      ) : (
        <span style={{ width: 20, height: 20, flex: "none" }} />
      )}
      <button
        type="button"
        className="ui-trans"
        aria-current={on ? "true" : "false"}
        onClick={onScope}
        style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, height: 38, fontWeight: on ? 600 : 500, textAlign: "left" }}
      >
        <span style={{ display: "flex", color: node.id === null ? "var(--ink-faint)" : on ? "var(--sage-text)" : "var(--ink-muted)" }}>
          <Icon name="folder" size={15} />
        </span>
        <Truncate text={node.name} style={{ flex: 1, minWidth: 0, fontSize: 14, color: node.id === null ? "var(--ink-muted)" : "var(--ink)" }} />
      </button>
      <span className="fcount" style={{ fontSize: 13, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
        {node.count}
      </span>
      <span className="fact" style={{ gap: 0 }}>
        <IconButton icon="plus" label={`Add a folder inside ${node.name}`} size={32} iconSize={13} disabled={busy || undefined} onClick={onAdd} />
        <IconButton icon="pencil" label={`Rename ${node.name}`} size={32} iconSize={13} disabled={busy || undefined} onClick={onRename} />
        {node.id === null ? null : <IconButton icon="trash" label={`Delete ${node.name}`} size={32} iconSize={13} disabled={busy || undefined} onClick={onRemove} />}
      </span>
    </div>
  );
}

export type FolderPaneProps = {
  /** Every item in the vault, which the counts are of. */
  items: ChaaviItem[];
  folders: ChaaviFolder[];
  scope: VaultScope;
  /** A folder change is in flight. */
  busy: boolean;
  /** The key of the drop target a dragged item is over. */
  hot: string | null;
  onScope: (scope: VaultScope) => void;
  /** Create the folder at this full path. */
  onCreate: (path: string) => void;
  /** Move the folder at `from`, with the folders under it, to the path `to`. */
  onRename: (from: string, to: string) => void;
  /** Delete the vault folder with this id; folders under it stay. */
  onDelete: (id: string) => void;
};

/**
 * The pane that narrows the list: all items, the favorites, each kind of item, the folder tree (collapse, add a subfolder, rename and
 * delete on hover) and No folder, every row with its count. Favorites, each folder and No folder take a dragged item.
 */
export function FolderPane({ items, folders, scope, busy, hot, onScope, onCreate, onRename, onDelete }: FolderPaneProps) {
  const [editing, setEditing] = useState<FolderEdit | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const kinds = new Map<ChaaviItemType, number>();
  for (const item of items) {
    kinds.set(item.type, (kinds.get(item.type) ?? 0) + 1);
  }

  const startAdding = (parent: string | null) => {
    setCollapsed((current) => current.filter((path) => path !== parent));
    setEditing({ mode: "create", parent });
  };

  const renderNodes = (nodes: FolderNode[], depth: number): ReactElement[] =>
    nodes.flatMap((node) => {
      const on = scope.kind === "folder" && scope.path === node.path;
      const open = !collapsed.includes(node.path);
      if (editing?.mode === "rename" && editing.path === node.path) {
        return [
          <NameRow
            key={node.path}
            depth={depth}
            initial={node.name}
            save="Save folder name"
            onSubmit={(name) => {
              setEditing(null);
              if (name !== node.name) {
                onRename(node.path, joinPath(parentPath(node.path), name));
              }
            }}
            onCancel={() => setEditing(null)}
          />,
        ];
      }
      if (editing?.mode === "delete" && editing.path === node.path && node.id !== null) {
        return [
          <div key={node.path} style={{ display: "flex", flexDirection: "column", flex: "none", gap: 8, padding: `10px 10px 10px ${12 + depth * 16}px`, borderRadius: 12, background: "var(--error-fill)" }}>
            <span style={{ fontSize: 13, lineHeight: "18px", overflowWrap: "anywhere" }}>
              {`Delete ${node.name}? Its ${node.own} ${node.own === 1 ? "item moves" : "items move"} to No folder${node.children.length > 0 ? "; the folders inside it stay." : "."}`}
            </span>
            <ButtonGroup>
              <Button tone="quiet" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                tone="danger"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  onDelete(node.id!);
                }}
              >
                Delete folder
              </Button>
            </ButtonGroup>
          </div>,
        ];
      }
      const dropKey = node.id === null ? undefined : `folder:${node.id}`;
      const out: ReactElement[] = [
        <FolderRow
          key={node.path}
          node={node}
          depth={depth}
          on={on}
          open={open}
          hot={dropKey !== undefined && hot === dropKey}
          dropKey={dropKey}
          busy={busy}
          onScope={() => onScope({ kind: "folder", path: node.path })}
          onToggle={() => setCollapsed((current) => (open ? [...current, node.path] : current.filter((path) => path !== node.path)))}
          onAdd={() => startAdding(node.path)}
          onRename={() => setEditing({ mode: "rename", path: node.path })}
          onRemove={() => setEditing({ mode: "delete", path: node.path })}
        />,
      ];
      if (editing?.mode === "create" && editing.parent === node.path) {
        out.push(createRow(node.path, depth + 1));
      }
      if (open) {
        out.push(...renderNodes(node.children, depth + 1));
      }
      return out;
    });

  const createRow = (parent: string | null, depth: number) => (
    <NameRow
      key={`new:${parent ?? ""}`}
      depth={depth}
      initial=""
      save="Add folder"
      onSubmit={(name) => {
        setEditing(null);
        onCreate(joinPath(parent, name));
      }}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <Card style={{ width: 232, flex: "none", padding: 8, minHeight: 0 }}>
      <div className="scroll" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0 }}>
        <ScopeRow icon="grid" name="All items" count={items.length} selected={scope.kind === "all"} onClick={() => onScope({ kind: "all" })} />
        <ScopeRow icon="star" name="Favorites" count={items.filter((item) => item.favorite).length} selected={scope.kind === "favorites"} drop="favorites" hot={hot === "favorites"} onClick={() => onScope({ kind: "favorites" })} />
        <GroupLabel>Types</GroupLabel>
        {ITEM_TYPES.filter((type) => kinds.has(type)).map((type) => (
          <ScopeRow key={type} icon={TYPE_META[type].icon} name={TYPE_META[type].many} count={kinds.get(type)!} selected={scope.kind === "type" && scope.type === type} onClick={() => onScope({ kind: "type", type })} />
        ))}
        <div style={{ display: "flex", alignItems: "center", flex: "none", justifyContent: "space-between", padding: "0 4px 0 0" }}>
          <GroupLabel>Folders</GroupLabel>
          <IconButton icon="plus" label="New folder" size={26} iconSize={13} disabled={busy || undefined} onClick={() => startAdding(null)} />
        </div>
        {editing?.mode === "create" && editing.parent === null ? createRow(null, 0) : null}
        {renderNodes(buildFolderTree(folders, items), 0)}
        <ScopeRow icon="folder" name="No folder" count={items.filter((item) => item.folderId === null).length} selected={scope.kind === "none"} drop="none" hot={hot === "none"} onClick={() => onScope({ kind: "none" })} />
        <span style={{ flex: "none", fontSize: 12, lineHeight: "17px", color: "var(--ink-muted)", padding: "12px 12px 4px" }}>Drag an item onto a folder to move it, or onto Favorites to star it.</span>
      </div>
    </Card>
  );
}
