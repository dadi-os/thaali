import { useEffect, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { nas } from "../../../api";
import { BOX_HOME, ancestorsOf, parentPath } from "../../../lib/content/boxLink";
import { Expandable } from "../../../ui/Expandable";
import { Skeleton } from "../../../ui/Skeleton";
import { listKey } from "./useFolder";

/** How long a folder's listing is reused by the tree before it asks Nas again, in ms. */
const FRESH_MS = 5_000;

/** The attribute that marks a folder row with its path, for the arrow keys. */
const ROW = "data-tree-path";

/** Props of {@link FolderTree}. */
export type FolderTreeProps = {
  /** The folder the explorer shows; its row is marked and it and its ancestors are opened. */
  current: string;
  /** A folder's name was pressed (or Enter): show it in the list. */
  onOpenFolder: (path: string) => void;
  /** A folder's children could not be loaded. */
  onError: (err: unknown) => void;
  /** The accessible name of the tree. */
  label?: string;
};

type BranchProps = {
  path: string;
  name: string;
  current: string;
  open: string[];
  onToggle: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onError: (err: unknown) => void;
};

/** The folders inside `path`, listed from the same query the file list reads, so one fetch serves both. Mounted only while the folder is open. */
function Children({ path, ...rest }: BranchProps) {
  const query = useQuery({ queryKey: listKey(path), queryFn: () => nas.listFiles(path), staleTime: FRESH_MS });
  const { error } = query;
  const { onError } = rest;
  useEffect(() => {
    if (error !== null) {
      onError(error);
    }
  }, [error, onError]);
  if (query.data === undefined) {
    return error === null ? <Skeleton width="70%" height={20} /> : null;
  }
  return (
    <>
      {query.data.entries
        .filter((entry) => entry.kind === "folder")
        .map((entry) => (
          <Branch key={entry.path} {...rest} path={entry.path} name={entry.name} />
        ))}
    </>
  );
}

/** One folder as the shared `folder` Expandable: the chevron opens and closes it, its name shows it in the list. */
function Branch(props: BranchProps) {
  const { path, name, current, open, onToggle, onOpenFolder } = props;
  const isOpen = open.includes(path);
  return (
    <Expandable
      look="folder"
      title={name}
      open={isOpen}
      onToggle={() => onToggle(path)}
      selected={path === current}
      onSelect={() => {
        if (!isOpen) {
          onToggle(path);
        }
        onOpenFolder(path);
      }}
      rowProps={{ "data-tree-path": path }}
    >
      <Children {...props} />
    </Expandable>
  );
}

/**
 * The folder tree: the home and the folders under it, loaded one level at a time as they open. Each row is the shared `folder`
 * Expandable (the chevron opens and closes, the name shows the folder in the list), and the arrow keys walk it: Up and Down move
 * between rows, Right opens a folder and then enters it, Left closes it and then goes to its parent.
 */
export function FolderTree({ current, onOpenFolder, onError, label = "Folders" }: FolderTreeProps) {
  const [open, setOpen] = useState<string[]>([BOX_HOME]);

  useEffect(() => {
    setOpen((now) => [...new Set([...now, ...ancestorsOf(current), current])]);
  }, [current]);

  const toggle = (path: string) => setOpen((now) => (now.includes(path) ? now.filter((p) => p !== path) : [...now, path]));

  const walk = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>(`[${ROW}]`);
    if (row === null || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(`[${ROW}]`)];
    const path = row.getAttribute(ROW)!;
    const focus = (target: HTMLElement | undefined) => target?.querySelector<HTMLElement>("button[aria-current]")?.focus();
    event.preventDefault();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      focus(rows[rows.indexOf(row) + (event.key === "ArrowDown" ? 1 : -1)]);
    } else if (event.key === "ArrowRight") {
      if (open.includes(path)) {
        const next = rows[rows.indexOf(row) + 1];
        if (next?.getAttribute(ROW)?.startsWith(`${path}/`)) {
          focus(next);
        }
      } else {
        toggle(path);
      }
    } else if (open.includes(path) && path !== BOX_HOME) {
      toggle(path);
    } else {
      focus(rows.find((candidate) => candidate.getAttribute(ROW) === parentPath(path)));
    }
  };

  return (
    <div role="group" aria-label={label} onKeyDown={walk} className="flex min-h-0 flex-col">
      <Branch path={BOX_HOME} name="Home" current={current} open={open} onToggle={toggle} onOpenFolder={onOpenFolder} onError={onError} />
    </div>
  );
}
