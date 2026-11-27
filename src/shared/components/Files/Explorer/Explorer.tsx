import { useState } from "react";
import type { ReactNode } from "react";
import { AnchoredMenu } from "../../../overlay/AnchoredMenu";
import { ConfirmDialog } from "../../../overlay/ConfirmDialog";
import { failureProps } from "../../../lib/ux/moduleState";
import { failureFacts } from "../../../states/failure";
import { StaleBanner, StateView } from "../../../states/ModuleState";
import { BOX_HOME, baseName, parentPath } from "../../../lib/content/boxLink";
import { useSize } from "../../../hooks/useSize";
import { IconButton } from "../../../ui/Button";
import { Breadcrumb, type BreadcrumbItem } from "../../../ui/Breadcrumb";
import { Icon } from "../../../ui/Icon";
import { Skeleton } from "../../../ui/Skeleton";
import type { NasFileEntry } from "../../../../types/nas";
import { copyLinks, createFolder, fileActions, moveEntries, renameEntry, trashEntries, uploadFiles, type FileActionDeps } from "../fileActions";
import { FileList } from "./FileList";
import { FolderTree } from "./FolderTree";
import { arrange, DEFAULT_SORT, isFolder, nextSort, type Sort, type SortKey } from "./listing";
import { MovePicker } from "./MovePicker";
import { useFolder, useRefreshFiles } from "./useFolder";

/** The explorer is narrower than this, in px, before the filter takes its own row and the folder tree hides behind a toggle. */
const NARROW_PX = 900;

/** Props of {@link Explorer}. */
export type ExplorerProps = {
  /** The folder listed, as an absolute box path. */
  folder: string;
  onFolderChange: (path: string) => void;
  /** The selected entries of that folder. */
  selection: NasFileEntry[];
  onSelectionChange: (entries: NasFileEntry[]) => void;
  /** The name filter's text. */
  filter: string;
  onFilterChange: (text: string) => void;
  /** One line over the list, such as "File removed" when a link's file is gone. */
  notice?: string | null;
  /** A file row was opened (double-click, Enter). */
  onOpenFile?: (entry: NasFileEntry) => void;
  /** The preview of the selected file, drawn under the list. */
  children?: ReactNode;
};

/** The breadcrumb's steps: the home, then each folder down to `folder`, each opening its own path. */
function crumbs(folder: string, open: (path: string) => void): BreadcrumbItem[] {
  const rest = folder === BOX_HOME ? [] : folder.slice(BOX_HOME.length + 1).split("/");
  return [
    { label: "Home", icon: "home", onSelect: () => open(BOX_HOME) },
    ...rest.map((name, i): BreadcrumbItem => ({ label: name, onSelect: () => open(`${BOX_HOME}/${rest.slice(0, i + 1).join("/")}`) })),
  ];
}

/**
 * The file explorer over the box: the folder tree at the left, and at the right a breadcrumb with the name filter and the actions menu at its end, the folder's
 * list (sortable) and, under it, whatever preview the surface gives. Actions on files are the one {@link fileActions} list,
 * serving the right-click menu and the menu button. Each write goes to Nas and then reloads the listings, so a failed one
 * leaves the list as Nas has it and says what failed.
 */
export function Explorer({ folder, onFolderChange, selection, onSelectionChange, filter, onFilterChange, notice = null, onOpenFile, children }: ExplorerProps) {
  const { query, state } = useFolder(folder);
  const refresh = useRefreshFiles();
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<NasFileEntry[] | null>(null);
  const [trashing, setTrashing] = useState<NasFileEntry[] | null>(null);
  const [pending, setPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [menu, setMenu] = useState<DOMRect | null>(null);

  const [frame, size] = useSize<HTMLDivElement>();
  const narrow = size.width > 0 && size.width < NARROW_PX;
  const [treeOpen, setTreeOpen] = useState(false);

  const fail = (err: unknown) => setError(failureFacts(err).message);

  const changed = async () => {
    await refresh();
  };

  const attempt = async (work: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    try {
      await work();
    } catch (err) {
      fail(err);
    } finally {
      await changed();
    }
  };

  const confirm = async (work: () => Promise<void>, close: () => void) => {
    setPending(true);
    setDialogError(null);
    try {
      await work();
      close();
      onSelectionChange([]);
    } catch (err) {
      setDialogError(failureFacts(err).message);
    } finally {
      setPending(false);
      await changed();
    }
  };

  const go = (path: string) => {
    onFolderChange(path);
    onSelectionChange([]);
    onFilterChange("");
    setCreating(false);
    setRenaming(null);
  };

  const open = (entry: NasFileEntry) => {
    if (isFolder(entry)) {
      go(entry.path);
    } else {
      onSelectionChange([entry]);
      onOpenFile?.(entry);
    }
  };

  const deps: FileActionDeps = {
    onOpen: open,
    onRename: (entry) => setRenaming(entry.path),
    onMove: (entries) => {
      setDialogError(null);
      setMoving(entries);
    },
    onNewFolder: () => setCreating(true),
    onTrash: (entries) => {
      setDialogError(null);
      setTrashing(entries);
    },
  };

  const rows = state.kind === "ready" || state.kind === "empty" ? arrange(state.kind === "ready" ? state.data.entries : [], sort, filter) : [];

  const renameEntryTo = (entry: NasFileEntry, name: string) => {
    setRenaming(null);
    if (name.trim() === entry.name) {
      return;
    }
    void attempt(async () => {
      const path = await renameEntry(entry, name);
      onSelectionChange(selection.map((s) => (s.path === entry.path ? { ...s, path, name: baseName(path) } : s)));
    });
  };

  const upload = (target: string, files: File[]) => {
    setDropTarget(null);
    void attempt(async () => {
      const renamed = await uploadFiles(target, files);
      setInfo(renamed.length === 0 ? null : renamed.join(" "));
    });
  };

  const filterField = (
    <label className={`search-field search-field--compact ${narrow ? "w-full" : "min-w-24"}`}>
      <Icon name="search" size={14} />
      <input
        type="search"
        className="sfi"
        placeholder="Filter by name"
        aria-label="Filter by name"
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && filter !== "") {
            event.stopPropagation();
            onFilterChange("");
          }
        }}
      />
    </label>
  );

  return (
    <div ref={frame} className="relative flex min-h-0 flex-1">
      {narrow && !treeOpen ? null : (
        <nav aria-label="Folder tree" className={`scroll ${narrow ? "w-56" : "w-64"} flex-none overflow-auto border-r border-rule p-2`}>
        <FolderTree current={folder} onOpenFolder={go} onError={fail} />
      </nav>
      )}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-none items-center gap-2 border-b border-rule px-3">
          {narrow ? <IconButton icon="folder" label="Folders" selected={treeOpen} size={32} onClick={() => setTreeOpen(!treeOpen)} /> : null}
          <Breadcrumb label="Path" items={crumbs(folder, go)} className="min-w-36 flex-1" />
          {narrow ? null : filterField}
          <IconButton icon="dots" label="Actions" size={32} onClick={(event) => setMenu(event.currentTarget.getBoundingClientRect())} />
        </div>
        {narrow ? <div className="flex-none border-b border-rule px-3 py-2">{filterField}</div> : null}
        {notice === null ? null : (
          <p role="status" className="flex-none border-b border-rule px-4 py-2 text-[13px] text-ink-muted">
            {notice}
          </p>
        )}
        {info === null ? null : (
          <p role="status" className="flex-none border-b border-rule px-4 py-2 text-[13px] text-ink-muted">
            {info}
          </p>
        )}
        {error === null ? null : (
          <p role="alert" data-selectable className="flex-none border-b border-rule px-4 py-2 text-[13px] text-error [overflow-wrap:anywhere]">
            {error}
          </p>
        )}
        {state.kind === "ready" && state.stale !== null ? <StaleBanner text="Showing this folder as it was" onRetry={() => void query.refetch()} /> : null}
        <div className={`flex min-h-0 flex-col ${children === undefined ? "flex-1" : "flex-[2]"}`}>
          {state.kind === "loading" ? (
            <div aria-label="Loading folder" className="flex flex-col gap-2 px-4 py-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} width="100%" height={28} />
              ))}
            </div>
          ) : state.kind === "offline" ? (
            <StateView kind="offline" title="dadi is unreachable" detail="Files appear when this computer is back on the network." />
          ) : state.kind === "module-offline" ? (
            <StateView kind="module-offline" title="Files aren’t available" {...failureProps(state.error)} onRetry={() => void query.refetch()} />
          ) : state.kind === "error" ? (
            <StateView kind="error" title="This folder didn’t load" {...failureProps(state.error)} onRetry={() => void query.refetch()} />
          ) : (
            <FileList
              folder={folder}
              entries={rows}
              selection={selection}
              onSelect={onSelectionChange}
              sort={sort}
              onSort={(key: SortKey) => setSort(nextSort(sort, key))}
              onOpen={open}
              onUp={() => go(parentPath(folder))}
              onCopyLinks={() => void copyLinks(selection).catch(fail)}
              actionsFor={(entries) => fileActions(entries, deps)}
              renaming={renaming}
              onRename={renameEntryTo}
              onCancelRename={() => setRenaming(null)}
              creating={creating}
              onCreate={(name) => {
                setCreating(false);
                void attempt(async () => {
                  await createFolder(folder, name);
                });
              }}
              onCancelCreate={() => setCreating(false)}
              dropTarget={dropTarget}
              onDropTarget={setDropTarget}
              onDropFiles={upload}
            >
              {state.kind === "empty" ? (
                <StateView kind="empty" dense title="Nothing here" detail="Drop files from this Mac to add them." />
              ) : rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-ink-muted">No file named like “{filter}”</p>
              ) : null}
            </FileList>
          )}
        </div>
        {children === undefined ? null : <div className="flex min-h-0 flex-[3] flex-col border-t border-rule">{children}</div>}
      </section>
      <AnchoredMenu actions={fileActions(selection, deps)} anchor={menu} onClose={() => setMenu(null)} />
      <MovePicker
        key={moving === null ? "closed" : moving.map((entry) => entry.path).join("\n")}
        entries={moving}
        folder={folder}
        pending={pending}
        error={dialogError}
        onCancel={() => setMoving(null)}
        onMove={(target) => void confirm(() => moveEntries(moving!, target), () => setMoving(null))}
        onTreeError={fail}
      />
      <ConfirmDialog
        open={trashing !== null}
        title={trashing !== null && trashing.length === 1 ? `Move ${trashing[0]!.name} to the trash?` : `Move ${trashing?.length ?? 0} items to the trash?`}
        detail="It stays in the trash for 14 days, then it is removed."
        confirmLabel="Move to trash"
        pending={pending}
        error={dialogError}
        onCancel={() => setTrashing(null)}
        onConfirm={() => void confirm(() => trashEntries(trashing!), () => setTrashing(null))}
      />
    </div>
  );
}
