import { useState, type ReactElement } from "react";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { Button, ButtonGroup, IconButton } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Field, FIELD_INPUT } from "../../shared/ui/Field";
import { Expandable } from "../../shared/ui/Expandable";
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
      data-drop={drop}
      aria-current={selected ? "true" : "false"}
      onClick={onClick}
      className={`ui-trans ui-hover-fill flex h-10 w-full flex-none items-center gap-2.5 rounded-[12px] px-3 ${selected ? "hl-on font-semibold" : "bg-transparent font-medium"}`}
      style={hot ? HOT_STYLE : undefined}
    >
      <span className={`flex ${selected ? "text-sage-text" : "text-ink-muted"}`}>
        <Icon name={icon} size={16} />
      </span>
      <Truncate text={name} className="min-w-0 flex-1 text-[14px]" />
      <span className="text-[13px] text-ink-muted tabular-nums">{count}</span>
    </button>
  );
}

/** The label above a group of rows. */
function GroupLabel({ children }: { children: string }) {
  return (
    <span className="ui-label px-3 pt-3.5 pb-1.5">
      {children}
    </span>
  );
}

type NameRowProps = {
  initial: string;
  /** The accessible name of the save control. */
  save: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

/** The inline name field of a new or renamed folder: Enter or the check saves, Escape or the cross leaves. */
function NameRow({ initial, save, onSubmit, onCancel }: NameRowProps) {
  const [name, setName] = useState(initial);
  const submit = () => {
    if (name.trim() !== "") {
      onSubmit(name.trim());
    }
  };
  return (
    <div className="flex-none">
      <Field extra={<><IconButton icon="check" label={save} size={32} iconSize={14} onClick={submit} /><IconButton icon="close" label="Cancel" size={32} iconSize={14} onClick={onCancel} /></>}>
      <input
        className={`${FIELD_INPUT} text-[14px]`}
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
      />
      </Field>
    </div>
  );
}

type FolderRowProps = {
  node: FolderNode;
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
  /** The folders inside it and the name field of a folder being added there, if any; left out for a folder with nothing inside. */
  children?: ReactElement[];
};

/** One folder of the tree, drawn by the shared expandable: a folder glyph that opens, its name and count, add, rename and delete on hover and on its right-click menu, its folders under a connector. */
function FolderRow({ node, on, open, hot, dropKey, busy, onScope, onToggle, onAdd, onRename, onRemove, children }: FolderRowProps) {
  const context = useContextActions(() => folderActions(node.name, node.id !== null, { busy, add: onAdd, rename: onRename, remove: onRemove }));
  return (
    <Expandable
      look="folder"
      title={node.name}
      trailing={node.count}
      open={open}
      onToggle={onToggle}
      selected={on}
      hot={hot}
      onSelect={onScope}
      rowProps={{ ...context, "data-drop": dropKey }}
      actions={
        <>
          <IconButton icon="plus" label={`Add a folder inside ${node.name}`} size={32} iconSize={13} disabled={busy || undefined} onClick={onAdd} />
          <IconButton icon="pencil" label={`Rename ${node.name}`} size={32} iconSize={13} disabled={busy || undefined} onClick={onRename} />
          {node.id === null ? null : <IconButton icon="trash" label={`Delete ${node.name}`} size={32} iconSize={13} disabled={busy || undefined} onClick={onRemove} />}
        </>
      }
    >
      {children}
    </Expandable>
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

  const renderNode = (node: FolderNode): ReactElement => {
    const on = scope.kind === "folder" && scope.path === node.path;
    const open = !collapsed.includes(node.path);
    if (editing?.mode === "rename" && editing.path === node.path) {
      return (
        <NameRow
          key={node.path}
          initial={node.name}
          save="Save folder name"
          onSubmit={(name) => {
            setEditing(null);
            if (name !== node.name) {
              onRename(node.path, joinPath(parentPath(node.path), name));
            }
          }}
          onCancel={() => setEditing(null)}
        />
      );
    }
    if (editing?.mode === "delete" && editing.path === node.path && node.id !== null) {
      return (
        <div key={node.path} className="flex flex-none flex-col gap-2 rounded-[12px] bg-error-fill p-2.5">
          <span className="text-[13px] leading-[18px] break-words">
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
        </div>
      );
    }
    const dropKey = node.id === null ? undefined : `folder:${node.id}`;
    const inside = [...(editing?.mode === "create" && editing.parent === node.path ? [createRow(node.path)] : []), ...node.children.map(renderNode)];
    return (
      <FolderRow
        key={node.path}
        node={node}
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
      >
        {inside.length > 0 ? inside : undefined}
      </FolderRow>
    );
  };

  const createRow = (parent: string | null) => (
    <NameRow
      key={`new:${parent ?? ""}`}
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
    <Card className="min-h-0 w-58 flex-none p-2">
      <div className="scroll flex min-h-0 flex-1 flex-col gap-0.5">
        <ScopeRow icon="grid" name="All items" count={items.length} selected={scope.kind === "all"} onClick={() => onScope({ kind: "all" })} />
        <ScopeRow icon="star" name="Favorites" count={items.filter((item) => item.favorite).length} selected={scope.kind === "favorites"} drop="favorites" hot={hot === "favorites"} onClick={() => onScope({ kind: "favorites" })} />
        <GroupLabel>Types</GroupLabel>
        {ITEM_TYPES.filter((type) => kinds.has(type)).map((type) => (
          <ScopeRow key={type} icon={TYPE_META[type].icon} name={TYPE_META[type].many} count={kinds.get(type)!} selected={scope.kind === "type" && scope.type === type} onClick={() => onScope({ kind: "type", type })} />
        ))}
        <div className="flex flex-none items-center justify-between pr-1">
          <GroupLabel>Folders</GroupLabel>
          <IconButton icon="plus" label="New folder" size={32} iconSize={13} disabled={busy || undefined} onClick={() => startAdding(null)} />
        </div>
        {editing?.mode === "create" && editing.parent === null ? createRow(null) : null}
        {buildFolderTree(folders, items).map(renderNode)}
        <ScopeRow icon="folder" name="No folder" count={items.filter((item) => item.folderId === null).length} selected={scope.kind === "none"} drop="none" hot={hot === "none"} onClick={() => onScope({ kind: "none" })} />
        <span className="flex-none px-3 pt-3 pb-1 text-[12px] leading-[17px] text-ink-muted">Drag an item onto a folder to move it, or onto Favorites to star it.</span>
      </div>
    </Card>
  );
}
