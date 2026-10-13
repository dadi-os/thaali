/**
 * How the vault page draws itself: a ledger of item types that filters the list, the
 * folder rail (scopes, folders with rename and delete, drop targets), and the item rows.
 * State and mutations stay in index.tsx.
 */

import { useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { motion } from "motion/react";
import { IconPlus } from "../../shared/components/IconButton";
import { Ticker } from "../../shared/components/Ticker";
import { EASE, SLOW_S, SLOWER_S } from "../../shared/lib/ux/motion";
import type { ChaaviFolder, ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { ITEM_TYPES, itemSubtitle, TYPE_META, type VaultScope } from "./draft";
import { IconFolder, IconPencil, IconStar, TypeGlyph } from "./icons";

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

/** The vault's ledger: a ticker per item type that narrows the list to that type when picked. */
export function Ledger({ counts, active, onPick }: LedgerProps) {
  return (
    <nav
      aria-label="Filter by type"
      className="flex flex-wrap items-stretch rounded-[var(--radius-window)] border border-[var(--glass-border)] bg-[var(--glass-veil)] px-1 py-3 shadow-[var(--shadow)] backdrop-blur-[var(--glass-blur)] [&>*+*]:border-l [&>*+*]:border-dashed [&>*+*]:border-sage-line/70"
    >
      {ITEM_TYPES.map((type, i) => {
        const on = active === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : type)}
            className={`relative flex min-w-[110px] flex-1 flex-col items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 transition-[background-color] duration-slow ease-dadi ${
              on ? "" : "hover:bg-sage-faint"
            }`}
          >
            {on ? <SelectionMark group="chaavi-type" className="rounded-[var(--radius)] bg-sage-active" /> : null}
            <Ticker
              value={counts ? counts[type] : null}
              delay={i * 0.06}
              className="relative text-[28px] font-medium tracking-tight text-ink"
            />
            <span
              className={`relative text-[10px] font-medium tracking-[2px] uppercase transition-colors duration-slow ease-dadi ${
                on ? "text-ink" : "text-sage-deep"
              }`}
            >
              {TYPE_META[type].many}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export type FolderRailProps = {
  folders: ChaaviFolder[];
  scope: VaultScope;
  /** Item counts in the current search: every item, favorites, no folder, and per folder id. */
  counts: { all: number; favorites: number; none: number; byFolder: Record<string, number> };
  /** The drop target under a dragged item, by {@link dropKey}. */
  hot: string | null;
  /** The rail row a dropped item last landed on, which flashes as it takes it. */
  landed: Landing | null;
  /** A folder create, rename or delete is in flight. */
  busy: boolean;
  onScope: (scope: VaultScope) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

/**
 * The folder rail: All items, Favorites, each folder (rename and delete on hover), and No
 * folder. Favorites, folders and No folder are drop targets for a dragged item.
 */
export function FolderRail({ folders, scope, counts, hot, landed, busy, onScope, onCreate, onRename, onDelete }: FolderRailProps) {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const isScope = (next: VaultScope) =>
    scope.kind === next.kind && (scope.kind !== "folder" || (next.kind === "folder" && next.id === scope.id));

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

      <div className="mt-2.5 mb-1.5 flex items-center justify-between border-t border-dashed border-sage-line pt-3 pr-1.5 pl-3">
        <span className="text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">Folders</span>
        <button
          type="button"
          aria-label="New folder"
          disabled={busy}
          onClick={() => {
            setNaming(true);
            setDraft("");
          }}
          className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-ghost transition-colors duration-fast ease-dadi hover:bg-sage-active hover:text-sage-deep [&_svg]:size-3.5"
        >
          <IconPlus />
        </button>
      </div>

      {naming ? (
        <NameForm
          submitLabel="Add"
          onSubmit={(name) => {
            setNaming(false);
            onCreate(name);
          }}
          onCancel={() => setNaming(false)}
          draft={draft}
          setDraft={setDraft}
        />
      ) : null}

      {folders.map((folder) => {
        const target: DropTarget = { kind: "folder", id: folder.id };
        if (renaming === folder.id) {
          return (
            <NameForm
              key={folder.id}
              submitLabel="Save"
              onSubmit={(name) => {
                setRenaming(null);
                if (name !== folder.name) {
                  onRename(folder.id, name);
                }
              }}
              onCancel={() => setRenaming(null)}
              draft={draft}
              setDraft={setDraft}
            />
          );
        }
        if (confirming === folder.id) {
          return (
            <div key={folder.id} className="my-0.5 rounded-[var(--radius)] border border-dashed border-error-line bg-error-fill/40 px-3 py-2.5">
              <p className="text-[12px] text-ink">
                Delete {folder.name}? Its {counts.byFolder[folder.id] ?? 0} items move to No folder.
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  className="text-[10px] font-medium tracking-[0.14em] text-error uppercase"
                  onClick={() => {
                    setConfirming(null);
                    onDelete(folder.id);
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
        return (
          <div key={folder.id} data-drop={dropKey(target)} className={`group ${row(isScope(target), target)}`}>
            {marks(isScope(target), target)}
            <button
              type="button"
              className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2.5 text-left"
              onClick={() => onScope(target)}
              onDoubleClick={() => {
                setRenaming(folder.id);
                setDraft(folder.name);
              }}
            >
              <span className="text-sage">
                <IconFolder />
              </span>
              <span className="truncate text-ink">{folder.name}</span>
            </button>
            {count(counts.byFolder[folder.id] ?? 0)}
            <span className="hidden gap-0.5 group-hover:inline-flex">
              <button
                type="button"
                aria-label={`Rename ${folder.name}`}
                disabled={busy}
                onClick={() => {
                  setRenaming(folder.id);
                  setDraft(folder.name);
                }}
                className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-ghost hover:bg-sage-active hover:text-sage-deep"
              >
                <IconPencil />
              </button>
              <button
                type="button"
                aria-label={`Delete ${folder.name}`}
                disabled={busy}
                onClick={() => setConfirming(folder.id)}
                className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-ghost hover:bg-sage-active hover:text-sage-deep"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden>
                  <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          </div>
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

/** An item's glyph, name and subtitle, shared by the row and the drag ghost. */
export function ItemFace({ item }: ItemFaceProps) {
  return (
    <>
      <span
        className={`inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border ${
          item.type === "card"
            ? "border-[color-mix(in_srgb,var(--clay)_60%,transparent)] bg-[color-mix(in_srgb,var(--clay)_14%,var(--bone))] text-[var(--clay)]"
            : "border-sage-line bg-bone text-sage-deep"
        }`}
      >
        <TypeGlyph type={item.type} />
      </span>
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
        <span className="text-[9px] font-medium tracking-[1.4px] text-sage-deep">PASSKEY</span>
      ) : null}
    </>
  );
}
