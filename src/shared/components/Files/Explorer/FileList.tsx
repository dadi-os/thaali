import { useEffect, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { ActionList } from "../../../interaction/actions";
import { useContextActions } from "../../../interaction/contextMenu";
import { Icon } from "../../../ui/Icon";
import type { NasFileEntry } from "../../../../types/nas";
import { iconFor, isFolder, modifiedLabel, sizeLabel, type Sort, type SortKey } from "./listing";

/** The three columns: the name takes what is left. */
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-3 px-3";

const HEADERS: ReadonlyArray<{ key: SortKey; label: string; end: boolean }> = [
  { key: "name", label: "Name", end: false },
  { key: "modified", label: "Modified", end: false },
  { key: "size", label: "Size", end: true },
];

/** Props of {@link FileList}. */
export type FileListProps = {
  /** The folder listed: files dropped on the list outside a folder row go here. */
  folder: string;
  /** The rows, already filtered and ordered. */
  entries: NasFileEntry[];
  /** The selected rows, the last one being the keyboard's place. */
  selection: NasFileEntry[];
  onSelect: (entries: NasFileEntry[]) => void;
  sort: Sort;
  onSort: (key: SortKey) => void;
  /** A folder row opened (double-click, Enter) lists it; a file row opened is for the surface to decide. */
  onOpen: (entry: NasFileEntry) => void;
  /** Backspace: go to the folder above. */
  onUp: () => void;
  /** Cmd/Ctrl+C: copy the selection's links. */
  onCopyLinks: () => void;
  /** The actions on these entries (an empty list is the folder itself), for the right-click menu. */
  actionsFor: (entries: NasFileEntry[]) => ActionList;
  /** The path of the entry being renamed in place, or null. */
  renaming: string | null;
  onRename: (entry: NasFileEntry, name: string) => void;
  onCancelRename: () => void;
  /** Whether a new folder's name is being typed in a row at the top. */
  creating: boolean;
  onCreate: (name: string) => void;
  onCancelCreate: () => void;
  /** The folder a Mac file is being dragged over, or null. */
  dropTarget: string | null;
  onDropTarget: (path: string | null) => void;
  /** Mac files were dropped on a folder (the listed one or a row's). */
  onDropFiles: (folder: string, files: File[]) => void;
  /** What shows under the rows: the empty state, or the line that says the filter hides every row. */
  children?: ReactNode;
};

/** Whether a drag carries files from outside the page. */
function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

/** A name typed in place: Enter keeps it, Escape or leaving the field drops it. */
function NameField({ initial, label, onCommit, onCancel }: { initial: string; label: string; onCommit: (name: string) => void; onCancel: () => void }) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = field.current;
    if (input !== null) {
      input.focus();
      input.setSelectionRange(0, initial.includes(".") ? initial.lastIndexOf(".") : initial.length);
    }
  }, [initial]);
  return (
    <input
      ref={field}
      aria-label={label}
      defaultValue={initial}
      className="sfi h-7 min-w-0 flex-1 rounded-[6px] border border-sage-line bg-bone px-1.5 text-[13px]"
      onClick={(event) => event.stopPropagation()}
      onBlur={onCancel}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          onCommit(event.currentTarget.value);
        } else if (event.key === "Escape") {
          onCancel();
        }
      }}
    />
  );
}

type RowProps = {
  entry: NasFileEntry;
  selected: boolean;
  renaming: boolean;
  dropping: boolean;
  actions: () => ActionList;
  onPress: (event: MouseEvent) => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDropTarget: (path: string | null) => void;
  onDropFiles: (folder: string, files: File[]) => void;
};

/** One entry: its icon and name, when it changed and its size. A press selects, a double press opens, a Mac file dropped on a folder row uploads there. */
function Row({ entry, selected, renaming, dropping, actions, onPress, onOpen, onRename, onCancelRename, onDropTarget, onDropFiles }: RowProps) {
  const context = useContextActions(actions);
  const folder = isFolder(entry);
  return (
    <div
      {...context}
      role="option"
      aria-selected={selected}
      data-path={entry.path}
      onClick={onPress}
      onDoubleClick={onOpen}
      onDragOver={
        folder
          ? (event) => {
              if (hasFiles(event)) {
                event.preventDefault();
                event.stopPropagation();
                onDropTarget(entry.path);
              }
            }
          : undefined
      }
      onDrop={
        folder
          ? (event) => {
              if (hasFiles(event)) {
                event.preventDefault();
                event.stopPropagation();
                onDropFiles(entry.path, [...event.dataTransfer.files]);
              }
            }
          : undefined
      }
      className={`${COLUMNS} h-9 ui-trans ui-hover-fill cursor-default rounded-[8px] text-[13px] ${selected || dropping ? "hl-on" : ""} ${dropping ? "outline outline-1 outline-sage-line" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name={iconFor(entry)} size={15} style={{ flex: "none" }} />
        {renaming ? <NameField initial={entry.name} label={`Rename ${entry.name}`} onCommit={onRename} onCancel={onCancelRename} /> : <span className="min-w-0 flex-1 truncate text-ink">{entry.name}</span>}
      </span>
      <span className="truncate text-[12px] text-ink-muted">{modifiedLabel(entry)}</span>
      <span className="truncate text-right text-[12px] text-ink-muted">{sizeLabel(entry)}</span>
    </div>
  );
}

/**
 * The rows of one folder, sortable by its headers: an icon and name, the day it changed and its size. Arrow keys move
 * the selection (Shift extends it), Enter opens, Backspace goes up, Space previews the row, Cmd/Ctrl+C copies the
 * links; the modifier keys multi-select with the pointer. Right-click offers the entry's actions, or the folder's on the
 * empty space. Mac files dropped on the list, or on a folder row, upload there.
 */
export function FileList({
  folder,
  entries,
  selection,
  onSelect,
  sort,
  onSort,
  onOpen,
  onUp,
  onCopyLinks,
  actionsFor,
  renaming,
  onRename,
  onCancelRename,
  creating,
  onCreate,
  onCancelCreate,
  dropTarget,
  onDropTarget,
  onDropFiles,
  children,
}: FileListProps) {
  const context = useContextActions(() => actionsFor([]));
  const list = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<NasFileEntry | null>(null);
  const place = selection.length === 0 ? null : selection[selection.length - 1]!;

  useEffect(() => {
    if (place !== null) {
      [...(list.current?.querySelectorAll("[data-path]") ?? [])].find((row) => row.getAttribute("data-path") === place.path)?.scrollIntoView({ block: "nearest" });
    }
  }, [place]);

  const press = (entry: NasFileEntry, event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      onSelect(selection.some((s) => s.path === entry.path) ? selection.filter((s) => s.path !== entry.path) : [...selection, entry]);
      setAnchor(entry);
    } else if (event.shiftKey && anchor !== null) {
      const from = entries.findIndex((e) => e.path === anchor.path);
      const to = entries.findIndex((e) => e.path === entry.path);
      onSelect(entries.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else {
      onSelect([entry]);
      setAnchor(entry);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    const at = place === null ? -1 : entries.findIndex((e) => e.path === place.path);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = entries[Math.max(0, Math.min(entries.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))];
      if (next !== undefined) {
        onSelect(event.shiftKey ? [...selection.filter((s) => s.path !== next.path), next] : [next]);
        if (!event.shiftKey) {
          setAnchor(next);
        }
      }
    } else if (event.key === "Enter" && place !== null) {
      event.preventDefault();
      onOpen(place);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      onUp();
    } else if (event.key === " " && place !== null) {
      event.preventDefault();
      onSelect([place]);
    } else if (event.key.toLowerCase() === "c" && (event.metaKey || event.ctrlKey) && selection.length > 0) {
      event.preventDefault();
      onCopyLinks();
    }
  };

  return (
    <div
      {...context}
      ref={list}
      role="listbox"
      aria-label="Files"
      aria-multiselectable="true"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          onDropTarget(folder);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onDropTarget(null);
        }
      }}
      onDrop={(event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          onDropFiles(folder, [...event.dataTransfer.files]);
        }
      }}
      className={`scroll flex min-h-0 flex-1 flex-col overflow-auto px-2 pb-2 outline-none ${dropTarget === folder ? "bg-sage-fill/40" : ""}`}
    >
      <div role="presentation" className={`${COLUMNS} sticky top-0 z-10 h-8 flex-none bg-bone text-[12px] text-ink-muted`}>
        {HEADERS.map(({ key, label, end }) => (
          <button key={key} type="button" aria-label={`Sort by ${label}`} onClick={() => onSort(key)} className={`ui-trans ui-hover-fill -mx-1.5 flex h-6 items-center gap-1 rounded-[6px] px-1.5 ${end ? "justify-end" : ""} ${sort.key === key ? "text-ink" : ""}`}>
            {label}
            {sort.key === key ? <Icon name="chevDown" size={11} style={{ transform: sort.descending ? undefined : "rotate(180deg)" }} /> : null}
          </button>
        ))}
      </div>
      {creating ? (
        <div className={`${COLUMNS} h-9 rounded-[8px] bg-sage-fill`}>
          <span className="flex min-w-0 items-center gap-2">
            <Icon name="folder" size={15} style={{ flex: "none" }} />
            <NameField initial="New folder" label="New folder name" onCommit={onCreate} onCancel={onCancelCreate} />
          </span>
        </div>
      ) : null}
      {entries.map((entry) => (
        <Row
          key={entry.path}
          entry={entry}
          selected={selection.some((s) => s.path === entry.path)}
          renaming={renaming === entry.path}
          dropping={dropTarget === entry.path}
          actions={() => actionsFor(selection.some((s) => s.path === entry.path) ? selection : [entry])}
          onPress={(event) => press(entry, event)}
          onOpen={() => onOpen(entry)}
          onRename={(name) => onRename(entry, name)}
          onCancelRename={onCancelRename}
          onDropTarget={onDropTarget}
          onDropFiles={onDropFiles}
        />
      ))}
      {children}
    </div>
  );
}
