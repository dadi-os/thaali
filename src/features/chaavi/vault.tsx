/**
 * How the vault page draws itself: a ledger of item types that filters the list, the
 * folder rail (scopes, folders with rename and delete, drop targets), and the item rows.
 * State and mutations stay in index.tsx.
 */

import { Fragment, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from "react";
import { motion } from "motion/react";
import { IconPlus } from "../../shared/components/IconButton";
import { Ticker } from "../../shared/components/Ticker";
import { EASE, SLOW_S, SLOWER_S } from "../../shared/lib/ux/motion";
import type { ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { ITEM_TYPES, itemSubtitle, TYPE_META, type VaultScope } from "./draft";
import { joinPath, parentPath, type FolderNode } from "./folders";
import { IconFolder, IconPencil, IconStar } from "./icons";

export type SelectionMarkProps = {
  /** Shared layout id of the group, so one mark glides between the group's members. */
  group: string;
  className?: string;
};

/**
 * The plate behind the picked member of a group (a type, a scope, an item). Picking another
 * member glides the same plate across to it. Its parent must be `relative` and keep its
 * content positioned above it.
 */
export function SelectionMark({ group, className = "rounded-[var(--radius)] bg-sage-active shadow-[var(--shadow)]" }: SelectionMarkProps) {
  return (
    <motion.span
      aria-hidden
      layoutId={group}
      className={`absolute inset-0 ${className}`}
      transition={{ duration: SLOW_S, ease: EASE }}
    />
  );
}

/** A drop that just landed on a rail row, numbered so each landing flashes afresh. */
export type Landing = { key: string; n: number };

/** Where a dragged item can land: a folder, no folder, or Favorites (which stars it). */
export type DropTarget = { kind: "folder"; id: string } | { kind: "none" } | { kind: "favorites" };

/** The `data-drop` value that marks an element as a drop target. */
export function dropKey(target: DropTarget): string {
  return target.kind === "folder" ? `folder:${target.id}` : target.kind;
}

/** Parse a `data-drop` value back into its target. */
export function parseDrop(key: string): DropTarget | null {
  if (key === "none" || key === "favorites") {
    return { kind: key };
  }
  return key.startsWith("folder:") ? { kind: "folder", id: key.slice("folder:".length) } : null;
}

export type LedgerProps = {
  /** Items per type in the current search and scope; null while loading. */
  counts: Record<ChaaviItemType, number> | null;
  /** The type the list is narrowed to, or null for every type. */
  active: ChaaviItemType | null;
  onPick: (type: ChaaviItemType | null) => void;
};

/**
 * The vault's type chips, as on the canvas: All, then one per item type the vault holds (and the
 * picked one), each with its count; picking a type narrows the list to it, picking it again or
 * All shows everything.
 */
export function Ledger({ counts, active, onPick }: LedgerProps) {
  if (counts === null) {
    return <span className="skeleton h-7 w-56 rounded-full" />;
  }
  const shown = ITEM_TYPES.filter((type) => counts[type] > 0 || type === active);
  const total = ITEM_TYPES.reduce((sum, type) => sum + counts[type], 0);
  const chip = (on: boolean) =>
    `flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] font-semibold transition-colors duration-slow ease-dadi ${
      on ? "bg-sage-deep text-bone" : "bg-sage-fill text-sage-text hover:bg-sage-active"
    }`;
  return (
    <nav aria-label="Filter by type" className="flex flex-wrap items-center gap-1.5 self-center">
      <button type="button" aria-pressed={active === null} onClick={() => onPick(null)} className={chip(active === null)}>
        All<span className="tabular-nums opacity-70">{total}</span>
      </button>
      {shown.map((type) => (
        <button key={type} type="button" aria-pressed={active === type} onClick={() => onPick(active === type ? null : type)} className={chip(active === type)}>
          {TYPE_META[type].many}
          <span className="tabular-nums opacity-70">{counts[type]}</span>
        </button>
      ))}
    </nav>
  );
}

export type FolderRailProps = {
  tree: FolderNode[];
  scope: VaultScope;
  /** Item counts in the current search: every item, favorites and no folder. */
  counts: { all: number; favorites: number; none: number };
  /** The drop target under a dragged item, by {@link dropKey}. */
  hot: string | null;
  /** The rail row a dropped item last landed on, which flashes as it takes it. */
  landed: Landing | null;
  /** A folder create, rename or delete is in flight. */
  busy: boolean;
  onScope: (scope: VaultScope) => void;
  /** Create the folder at this full path. */
  onCreate: (path: string) => void;
  /** Move the folder at `from`, with the folders under it, to the path `to`. */
  onRename: (from: string, to: string) => void;
  /** Delete the vault folder with this id; folders under it stay. */
  onDelete: (id: string) => void;
};

/** A row of the folder tree in display order. */
type RailRow = { node: FolderNode; depth: number };

/** The tree's visible rows, skipping the children of collapsed folders. */
function railRows(nodes: FolderNode[], collapsed: Set<string>, depth = 0): RailRow[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(collapsed.has(node.path) ? [] : railRows(node.children, collapsed, depth + 1)),
  ]);
}

/**
 * The folder rail: All items, Favorites, the folder tree (collapse, add a subfolder, rename
 * and delete on hover), and No folder. Favorites, folders and No folder are drop targets for a
 * dragged item.
 */
export function FolderRail({ tree, scope, counts, hot, landed, busy, onScope, onCreate, onRename, onDelete }: FolderRailProps) {
  const [naming, setNaming] = useState<{ parent: string | null } | null>(null);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const isScope = (next: VaultScope) =>
    scope.kind === next.kind && (scope.kind !== "folder" || (next.kind === "folder" && next.path === scope.path));

  const row = (on: boolean, target: DropTarget | null) =>
    `relative flex min-h-[38px] w-full items-center gap-2.5 rounded-[var(--radius)] border border-dashed px-3 text-left text-[13px] transition-[background-color,border-color,box-shadow] duration-fast ease-dadi [&>:not([aria-hidden])]:relative ${
      target !== null && hot === dropKey(target)
        ? "border-sage bg-sage-active shadow-[0_0_0_3px_var(--sage-faint)]"
        : on
          ? "border-transparent"
          : "border-transparent hover:bg-sage-faint"
    }`;

  const marks = (on: boolean, target: DropTarget | null) => (
    <>
      {on ? <SelectionMark group="chaavi-scope" /> : null}
      {target !== null && landed !== null && landed.key === dropKey(target) ? (
        <motion.span
          key={landed.n}
          aria-hidden
          className="absolute inset-0 rounded-[var(--radius)] border border-sage bg-sage-fill"
          initial={{ opacity: 0.9, scale: 0.97 }}
          animate={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: SLOWER_S, ease: EASE }}
        />
      ) : null}
    </>
  );

  const count = (n: number) => (
    <span className="text-[11px] text-ink-ghost group-hover:hidden">
      <Ticker value={n} />
    </span>
  );

  const startNaming = (parent: string | null) => {
    if (parent !== null) {
      setCollapsed((current) => {
        const next = new Set(current);
        next.delete(parent);
        return next;
      });
    }
    setNaming({ parent });
    setDraft("");
  };

  const indent = (depth: number) => ({ paddingLeft: 12 + depth * 16 });

  const addForm = (parent: string | null, depth: number) => (
    <div key={`new:${parent ?? ""}`} style={indent(depth)} className="rounded-[var(--radius)] bg-sage-active pr-3">
      <NameForm
        submitLabel="Add"
        onSubmit={(name) => {
          setNaming(null);
          onCreate(joinPath(parent, name));
        }}
        onCancel={() => setNaming(null)}
        draft={draft}
        setDraft={setDraft}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-0.5 p-2">
      <button type="button" className={row(isScope({ kind: "all" }), null)} onClick={() => onScope({ kind: "all" })}>
        {marks(isScope({ kind: "all" }), null)}
        <span className="flex-1 truncate text-ink">All items</span>
        {count(counts.all)}
      </button>
      <button
        type="button"
        data-drop="favorites"
        className={row(isScope({ kind: "favorites" }), { kind: "favorites" })}
        onClick={() => onScope({ kind: "favorites" })}
      >
        {marks(isScope({ kind: "favorites" }), { kind: "favorites" })}
        <span className="text-[var(--clay)]">
          <IconStar filled size={14} />
        </span>
        <span className="flex-1 truncate text-ink">Favorites</span>
        {count(counts.favorites)}
      </button>

      <div className="mt-3 mb-1 flex items-center justify-between pt-1 pr-1.5 pl-3">
        <span className="text-[11.5px] font-semibold text-ink-ghost">Folders</span>
        <button
          type="button"
          aria-label="New folder"
          disabled={busy}
          onClick={() => startNaming(null)}
          className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-ghost transition-colors duration-fast ease-dadi hover:bg-sage-active hover:text-sage-deep [&_svg]:size-3.5"
        >
          <IconPlus />
        </button>
      </div>

      {naming !== null && naming.parent === null ? addForm(null, 0) : null}

      {railRows(tree, collapsed).map(({ node, depth }) => {
        const target: DropTarget | null = node.id === null ? null : { kind: "folder", id: node.id };
        const scopeOf: VaultScope = { kind: "folder", path: node.path };
        if (renaming === node.path) {
          return (
            <div key={node.path} style={indent(depth)} className="rounded-[var(--radius)] bg-sage-active pr-3">
              <NameForm
                submitLabel="Save"
                onSubmit={(name) => {
                  setRenaming(null);
                  if (name !== node.name) {
                    onRename(node.path, joinPath(parentPath(node.path), name));
                  }
                }}
                onCancel={() => setRenaming(null)}
                draft={draft}
                setDraft={setDraft}
              />
            </div>
          );
        }
        if (confirming === node.path && node.id !== null) {
          return (
            <div key={node.path} style={indent(depth)} className="my-0.5 rounded-[var(--radius)] border border-dashed border-error-line bg-error-fill/40 py-2.5 pr-3">
              <p className="text-[12px] text-ink">
                Delete {node.name}? Its {node.own} items move to No folder
                {node.children.length > 0 ? "; the folders inside it stay." : "."}
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  className="text-[10px] font-medium tracking-[0.14em] text-error uppercase"
                  onClick={() => {
                    setConfirming(null);
                    onDelete(node.id!);
                  }}
                >
                  Delete folder
                </button>
                <button
                  type="button"
                  className="text-[10px] font-medium tracking-[0.14em] text-ink-ghost uppercase"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }
        const open = !collapsed.has(node.path);
        return (
          <Fragment key={node.path}>
            <div
              {...(target !== null ? { "data-drop": dropKey(target) } : {})}
              style={indent(depth)}
              className={`group ${row(isScope(scopeOf), target)}`}
            >
              {marks(isScope(scopeOf), target)}
              {node.children.length > 0 ? (
                <button
                  type="button"
                  aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (!next.delete(node.path)) {
                        next.add(node.path);
                      }
                      return next;
                    })
                  }
                  className="-ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-ink-ghost hover:text-sage-deep"
                >
                  <motion.svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.16, ease: EASE }}>
                    <path d="m3.5 2 3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                </button>
              ) : (
                <span aria-hidden className="-ml-1 size-5 shrink-0" />
              )}
              <button
                type="button"
                className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2.5 text-left"
                onClick={() => onScope(scopeOf)}
                onDoubleClick={() => {
                  setRenaming(node.path);
                  setDraft(node.name);
                }}
              >
                <span className={target === null ? "text-ink-faint" : "text-sage"}>
                  <IconFolder dashed={target === null} />
                </span>
                <span className={`truncate ${target === null ? "text-ink-muted" : "text-ink"}`}>{node.name}</span>
              </button>
              {count(node.count)}
              <span className="hidden gap-0.5 group-hover:inline-flex">
                <RailAction label={`Add a folder inside ${node.name}`} disabled={busy} onClick={() => startNaming(node.path)}>
                  <IconPlus />
                </RailAction>
                <RailAction
                  label={`Rename ${node.name}`}
                  disabled={busy}
                  onClick={() => {
                    setRenaming(node.path);
                    setDraft(node.name);
                  }}
                >
                  <IconPencil />
                </RailAction>
                {node.id !== null ? (
                  <RailAction label={`Delete ${node.name}`} disabled={busy} onClick={() => setConfirming(node.path)}>
                    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden>
                      <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </RailAction>
                ) : null}
              </span>
            </div>
            {naming !== null && naming.parent === node.path ? addForm(node.path, depth + 1) : null}
          </Fragment>
        );
      })}

      <button
        type="button"
        data-drop="none"
        className={row(isScope({ kind: "none" }), { kind: "none" })}
        onClick={() => onScope({ kind: "none" })}
      >
        {marks(isScope({ kind: "none" }), { kind: "none" })}
        <span className="text-ink-faint">
          <IconFolder dashed />
        </span>
        <span className="flex-1 truncate text-ink-muted">No folder</span>
        {count(counts.none)}
      </button>
      <p className="mx-3 mt-4 mb-1 text-[11px] leading-relaxed text-ink-ghost">
        Drag an item onto a folder to move it, or onto Favorites to star it.
      </p>
    </div>
  );
}

type RailActionProps = {
  /** Accessible name and tooltip. */
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
};

/** A small icon action on a folder row, shown on hover. */
function RailAction({ label, disabled, onClick, children }: RailActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-ghost hover:bg-sage-active hover:text-sage-deep disabled:opacity-40 [&_svg]:size-3"
    >
      {children}
    </button>
  );
}

type NameFormProps = {
  submitLabel: string;
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

/** An inline folder name field with its save and cancel. */
function NameForm({ submitLabel, draft, setDraft, onSubmit, onCancel }: NameFormProps) {
  return (
    <form
      className="flex min-h-[38px] items-center gap-2 rounded-[var(--radius)] bg-sage-active px-3"
      onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (name) {
          onSubmit(name);
        }
      }}
    >
      <input
        value={draft}
        autoFocus
        aria-label="Folder name"
        placeholder="Folder name"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        className="min-w-0 flex-1 border-b border-sage-line bg-transparent py-1 text-[13px] text-ink outline-none placeholder:text-ink-ghost focus:border-sage"
      />
      <button type="submit" className="text-[10px] font-medium tracking-[0.14em] text-sage-deep uppercase">
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel} className="text-[10px] font-medium tracking-[0.14em] text-ink-ghost uppercase">
        Cancel
      </button>
    </form>
  );
}

export type ItemRowProps = {
  item: ChaaviItem;
  /** Place in the list, to stagger rows in. */
  index: number;
  selected: boolean;
  /** It is the one being dragged, so its place shows lifted out and faded. */
  dragging: boolean;
  /** The row's list element, which the list's presence measures to pop a leaving row out of flow. */
  ref?: Ref<HTMLLIElement>;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, item: ChaaviItem) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>, item: ChaaviItem) => void;
  /** Keyboard activation; a pointer press selects through onPointerUp. */
  onSelect: (item: ChaaviItem) => void;
};

/**
 * One item in the list: type glyph, name, a public subtitle, a star when it is a favorite.
 * Click selects (the list's selection plate glides to it); a drag moves it. Rows ease in
 * staggered, slide to their new places when the list re-flows, and shrink away when they leave.
 */
export function ItemRow({ item, index, selected, dragging, ref, onPointerDown, onPointerMove, onPointerUp, onSelect }: ItemRowProps) {
  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: EASE } }}
      transition={{
        layout: { duration: SLOW_S, ease: EASE },
        default: { duration: SLOW_S, ease: EASE, delay: Math.min(index, 12) * 0.022 },
      }}
    >
      <button
        type="button"
        onPointerDown={(event) => onPointerDown(event, item)}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => onPointerUp(event, item)}
        onPointerCancel={(event) => onPointerUp(event, item)}
        onClick={(event) => {
          if (event.detail === 0) {
            onSelect(item);
          }
        }}
        className={`relative flex w-full cursor-grab touch-none items-center rounded-[var(--radius)] px-3 py-2.5 text-left transition-[background-color,opacity,scale] duration-slow ease-dadi active:cursor-grabbing ${
          selected ? "" : "hover:bg-sage-faint"
        } ${dragging ? "scale-[0.97] opacity-35" : ""}`}
      >
        {selected ? <SelectionMark group="chaavi-item" className="rounded-[var(--radius)] bg-sage-active/70 shadow-[var(--shadow)]" /> : null}
        <span className="relative flex min-w-0 flex-1 items-center gap-3">
          <ItemFace item={item} />
        </span>
      </button>
    </motion.li>
  );
}

export type ItemFaceProps = {
  item: ChaaviItem;
};

/** Monogram tints, the same three Khisso uses, picked by the item's name so an item keeps its color. */
const MONOGRAM_TINTS = [
  "bg-[color-mix(in_srgb,var(--sage)_20%,transparent)] text-sage-deep",
  "bg-[color-mix(in_srgb,var(--clay)_18%,transparent)] text-[color-mix(in_srgb,var(--clay)_70%,var(--ink))]",
  "bg-[color-mix(in_srgb,#7d9aa6_18%,transparent)] text-[color-mix(in_srgb,#7d9aa6_60%,var(--ink))]",
];

export type MonogramProps = {
  /** The item's name: its first letter, and the tint it picks. */
  name: string;
  /** Size and type utilities; a list row's is `size-[34px] rounded-[10px] text-[14px]`. */
  className?: string;
};

/** Khisso's item monogram: the name's first letter on a tile tinted by the name. */
export function Monogram({ name, className = "size-[34px] rounded-[10px] text-[14px]" }: MonogramProps) {
  const tint = MONOGRAM_TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % MONOGRAM_TINTS.length];
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center font-semibold ${tint} ${className}`}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** An item's monogram, name and subtitle, shared by the row and the drag ghost. */
export function ItemFace({ item }: ItemFaceProps) {
  return (
    <>
      <Monogram name={item.name} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] text-ink">{item.name}</span>
        <span className="truncate text-[11px] text-ink-ghost">{itemSubtitle(item)}</span>
      </span>
      {item.favorite ? (
        <span className="text-[var(--clay)]" aria-label="Favorite">
          <IconStar filled size={13} />
        </span>
      ) : null}
      {item.type === "login" && item.login.passkeys.length > 0 ? (
        <span className="rounded-full border border-sage-line px-[7px] py-[2px] text-[10.5px] font-semibold text-sage-deep">passkey</span>
      ) : null}
    </>
  );
}
