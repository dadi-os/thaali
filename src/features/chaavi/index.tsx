/**
 * The vault page: a ledger of item types, the folder rail, the item list and the open item.
 * Owns the queries, mutations, search, scope and the drag that moves an item between
 * folders; vault.tsx draws the rail and rows, detail.tsx the item, editor.tsx the sheet.
 * Revealed secrets live in the detail and editor components only, never in the query cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHAAVI_VAULT, chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { IconPlus } from "../../shared/components/IconButton";
import { SearchField } from "../../shared/components/SearchField";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import type { ChaaviItem, ChaaviItemType, ChaaviUpdateItem } from "../../types/chaavi";
import { ItemDetail } from "./detail";
import { createBody, draftFromItem, emptyDraft, inScope, ITEM_TYPES, searchItems, TYPE_META, updateBody, type ItemDraft, type VaultScope } from "./draft";
import { ItemEditor } from "./editor";
import { FolderRail, ItemFace, ItemRow, Ledger, parseDrop, type DropTarget } from "./vault";

/** Pointer travel before a press on a row becomes a drag. */
const DRAG_PX = 4;

type EditorState =
  | { mode: "closed" }
  | { mode: "create"; draft: ItemDraft }
  | { mode: "edit"; item: ChaaviItem; draft: ItemDraft };

type DragState = {
  id: string;
  startX: number;
  startY: number;
  dragging: boolean;
};

type Ghost = {
  id: string;
  x: number;
  y: number;
  over: string | null;
};

export type PasswordManagerProps = {
  /** Page header slot for search and New item. */
  toolbar: HTMLElement | null;
};

/** The full vault manager. */
export function PasswordManager({ toolbar }: PasswordManagerProps) {
  const queryClient = useQueryClient();
  const { state } = useConnection();
  const connected = isMeshOnline(state);
  const canvasRef = useRef<HTMLDivElement>(null);
  const session = useRef<DragState | null>(null);

  const [query, setQuery] = useState("");
  const [pickedScope, setScope] = useState<VaultScope>({ kind: "all" });
  const [typeFilter, setTypeFilter] = useState<ChaaviItemType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [ghost, setGhost] = useState<Ghost | null>(null);

  const healthQuery = useQuery({
    queryKey: CHAAVI_HEALTH_KEY,
    queryFn: () => chaavi.getHealth(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });
  const ready = healthQuery.data?.vault === "ready";
  const itemsQuery = useQuery({
    queryKey: CHAAVI_ITEMS_KEY,
    queryFn: () => chaavi.listItems(),
    enabled: connected && ready,
    refetchInterval: POLL_MS,
  });
  const foldersQuery = useQuery({
    queryKey: CHAAVI_FOLDERS_KEY,
    queryFn: () => chaavi.listFolders(),
    enabled: connected && ready,
    refetchInterval: POLL_MS,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CHAAVI_ITEMS_KEY }),
      queryClient.invalidateQueries({ queryKey: CHAAVI_FOLDERS_KEY }),
    ]);

  const patch = useMutation({
    mutationFn: (input: { id: string; body: ChaaviUpdateItem }) => chaavi.updateItem(input.id, input.body),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CHAAVI_ITEMS_KEY });
      const previous = queryClient.getQueryData<{ items: ChaaviItem[] }>(CHAAVI_ITEMS_KEY);
      const { folderId, favorite } = input.body;
      queryClient.setQueryData<{ items: ChaaviItem[] }>(CHAAVI_ITEMS_KEY, (current) =>
        current
          ? {
              items: current.items.map((item) =>
                item.id === input.id
                  ? { ...item, ...(folderId !== undefined ? { folderId } : {}), ...(favorite !== undefined ? { favorite } : {}) }
                  : item,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CHAAVI_ITEMS_KEY, context.previous);
      }
    },
    onSettled: () => void invalidate(),
  });

  const save = useMutation({
    mutationFn: (input: { mode: "create"; draft: ItemDraft } | { mode: "edit"; item: ChaaviItem; draft: ItemDraft }) => {
      if (input.mode === "create") {
        return chaavi.createItem(createBody(input.draft));
      }
      const body = updateBody(input.item, input.draft);
      return body === null ? Promise.resolve(input.item) : chaavi.updateItem(input.item.id, body);
    },
    onSuccess: async (item) => {
      await invalidate();
      setEditor({ mode: "closed" });
      setSelectedId(item.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => chaavi.deleteItem(id),
    onSuccess: async () => {
      await invalidate();
      setSelectedId(null);
    },
  });

  const folderOp = useMutation({
    mutationFn: (
      input: { op: "create"; name: string } | { op: "rename"; id: string; name: string } | { op: "delete"; id: string },
    ): Promise<unknown> => {
      if (input.op === "create") {
        return chaavi.createFolder(input.name);
      }
      if (input.op === "rename") {
        return chaavi.renameFolder(input.id, input.name);
      }
      return chaavi.deleteFolder(input.id);
    },
    onSettled: () => void invalidate(),
  });

  const items = itemsQuery.data?.items ?? null;
  const folders = foldersQuery.data?.folders ?? [];
  const scope: VaultScope =
    pickedScope.kind === "folder" && !folders.some((folder) => folder.id === pickedScope.id) ? { kind: "all" } : pickedScope;
  const searched = items === null ? [] : searchItems(items, query);
  const scoped = searched.filter((item) => inScope(item, scope));
  const shown = scoped.filter((item) => typeFilter === null || item.type === typeFilter);
  const selected = items?.find((item) => item.id === selectedId) ?? null;
  const dragged = ghost === null ? null : (items?.find((item) => item.id === ghost.id) ?? null);

  const typeCounts =
    items === null
      ? null
      : (Object.fromEntries(ITEM_TYPES.map((type) => [type, scoped.filter((item) => item.type === type).length])) as Record<ChaaviItemType, number>);
  const byFolder: Record<string, number> = {};
  for (const item of searched) {
    if (item.folderId !== null) {
      byFolder[item.folderId] = (byFolder[item.folderId] ?? 0) + 1;
    }
  }
  const scopeTitle =
    scope.kind === "all"
      ? "All items"
      : scope.kind === "favorites"
        ? "Favorites"
        : scope.kind === "none"
          ? "No folder"
          : folders.find((folder) => folder.id === scope.id)!.name;

  const trouble = foldersQuery.isError ? foldersQuery.error : folderOp.isError ? folderOp.error : null;

  function dropAt(clientX: number, clientY: number): string | null {
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .map((node) => node.closest("[data-drop]"))
      .find((node): node is Element => node !== null);
    return hit?.getAttribute("data-drop") ?? null;
  }

  function moveTo(item: ChaaviItem, target: DropTarget): void {
    if (target.kind === "favorites") {
      if (!item.favorite) {
        patch.mutate({ id: item.id, body: { favorite: true } });
      }
      return;
    }
    const folderId = target.kind === "folder" ? target.id : null;
    if (folderId !== item.folderId) {
      patch.mutate({ id: item.id, body: { folderId } });
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, item: ChaaviItem): void {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = { id: item.id, startX: event.clientX, startY: event.clientY, dragging: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    const current = session.current;
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!current || !canvas) {
      return;
    }
    if (!current.dragging && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_PX) {
      return;
    }
    current.dragging = true;
    setGhost({ id: current.id, x: event.clientX - canvas.left, y: event.clientY - canvas.top, over: dropAt(event.clientX, event.clientY) });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>, item: ChaaviItem): void {
    const current = session.current;
    session.current = null;
    setGhost(null);
    if (!current || current.id !== item.id) {
      return;
    }
    if (!current.dragging) {
      setSelectedId(item.id);
      return;
    }
    const key = dropAt(event.clientX, event.clientY);
    const target = key === null ? null : parseDrop(key);
    if (target !== null) {
      moveTo(item, target);
    }
  }

  function openCreate(): void {
    save.reset();
    setEditor({
      mode: "create",
      draft: emptyDraft(typeFilter ?? "login", scope.kind === "folder" ? scope.id : null),
    });
  }

  const toolbarContent = (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search vault"
        matches={query.trim() ? searched.length : null}
        onPick={() => {
          if (searched.length === 1) {
            setSelectedId(searched[0]!.id);
          }
        }}
      />
      <button
        type="button"
        onClick={openCreate}
        disabled={!connected || !ready}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[7px] border border-dashed border-sage-line bg-[var(--glass-sheet)] px-3 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap text-sage-deep uppercase shadow-[var(--shadow)] transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-default disabled:opacity-40"
      >
        <span className="flex size-4 shrink-0">
          <IconPlus />
        </span>
        New item
      </button>
    </>
  );

  const status = vaultStatus(connected, healthQuery, itemsQuery);

  return (
    <div ref={canvasRef} className="relative flex h-full min-h-0 flex-col gap-4">
      {toolbar ? createPortal(toolbarContent, toolbar) : null}

      <Ledger counts={typeCounts} active={typeFilter} onPick={setTypeFilter} />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="widget-frame w-[15.5rem] shrink-0" aria-label="Folders">
          <div className="widget-frame__body overflow-y-auto">
            <FolderRail
              folders={folders}
              scope={scope}
              counts={{
                all: searched.length,
                favorites: searched.filter((item) => item.favorite).length,
                none: searched.filter((item) => item.folderId === null).length,
                byFolder,
              }}
              hot={ghost?.over ?? null}
              busy={folderOp.isPending}
              onScope={setScope}
              onCreate={(name) => folderOp.mutate({ op: "create", name })}
              onRename={(id, name) => folderOp.mutate({ op: "rename", id, name })}
              onDelete={(id) => folderOp.mutate({ op: "delete", id })}
            />
          </div>
        </aside>

        <section className="widget-frame w-[min(100%,22rem)] shrink-0" aria-label="Items">
          <div className="widget-frame__chrome !justify-between !px-4 !pt-3.5 !pb-3">
            <span className="widget-frame__title">
              {typeFilter ? `${scopeTitle} · ${TYPE_META[typeFilter].many}` : scopeTitle}
            </span>
            <span className="font-numeric text-[11px] text-ink-ghost">{items === null ? "" : shown.length}</span>
          </div>
          <div className="widget-frame__body overflow-y-auto border-t border-dashed border-sage-line p-2">
            {status !== null ? (
              <ListMessage tone={status.tone}>{status.text}</ListMessage>
            ) : shown.length === 0 ? (
              <ListMessage>{query.trim() ? `Nothing matches “${query.trim()}”` : "Nothing here yet"}</ListMessage>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {shown.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    selected={item.id === selectedId}
                    dragging={ghost?.id === item.id}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onSelect={(next) => setSelectedId(next.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="widget-frame min-w-0 flex-1" aria-label="Item">
          <div className="widget-frame__body overflow-y-auto">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.id}
                  className="min-h-full"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: SLOW_S, ease: EASE }}
                >
                  <ItemDetail
                    item={selected}
                    folders={folders}
                    busy={remove.isPending || patch.isPending}
                    error={remove.isError ? messageOf(remove.error) : patch.isError ? messageOf(patch.error) : null}
                    onEdit={() => {
                      save.reset();
                      setEditor({ mode: "edit", item: selected, draft: draftFromItem(selected) });
                    }}
                    onToggleFavorite={() => patch.mutate({ id: selected.id, body: { favorite: !selected.favorite } })}
                    onDelete={() => remove.mutate(selected.id)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 px-6 text-center"
                >
                  <p className="text-[15px] text-ink">Select an item</p>
                  <p className="max-w-sm text-[12px] leading-relaxed text-ink-ghost">
                    Secrets stay hidden until you reveal or copy them.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 px-1">
        <p className={`text-[11px] ${trouble ? "text-error" : "text-ink-ghost"}`}>
          {trouble ? messageOf(trouble) : "Vaultwarden store · Chaavi adapter · Bitwarden extension fills the browser"}
        </p>
        <a
          href={CHAAVI_VAULT}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-medium tracking-[1.4px] text-sage-deep transition-colors duration-slow ease-dadi hover:text-sage"
        >
          OPEN VAULT
        </a>
      </footer>

      <AnimatePresence>
        {editor.mode !== "closed" ? (
          <ItemEditor
            key={editor.mode === "edit" ? editor.item.id : "create"}
            mode={editor.mode}
            initial={editor.draft}
            itemId={editor.mode === "edit" ? editor.item.id : null}
            folders={folders}
            pending={save.isPending}
            error={save.isError ? messageOf(save.error) : null}
            onClose={() => {
              if (!save.isPending) {
                setEditor({ mode: "closed" });
              }
            }}
            onSubmit={(draft) =>
              save.mutate(editor.mode === "edit" ? { mode: "edit", item: editor.item, draft } : { mode: "create", draft })
            }
          />
        ) : null}
      </AnimatePresence>

      {dragged && ghost ? (
        <div
          className="pointer-events-none absolute z-30 flex w-72 items-center gap-3 rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--glass-sheet)] px-3 py-2.5 shadow-[var(--shadow-deep)] backdrop-blur-[var(--glass-blur)]"
          style={{ left: ghost.x, top: ghost.y, transform: "translate(-24px, -50%)" }}
        >
          <ItemFace item={dragged} />
        </div>
      ) : null}
    </div>
  );
}

/** The real error message for display. */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * What the list shows instead of items while it cannot show them: offline, Chaavi's error,
 * loading, or an unconfigured vault. Null once items are in.
 */
function vaultStatus(
  connected: boolean,
  health: { isError: boolean; error: unknown; data?: { vault: "ready" | "unconfigured" } | undefined },
  items: { isError: boolean; error: unknown; data?: unknown },
): { text: string; tone: "quiet" | "error" } | null {
  if (!connected) {
    return { text: "Connect to load the vault", tone: "quiet" };
  }
  if (health.isError) {
    return { text: messageOf(health.error), tone: "error" };
  }
  if (!health.data) {
    return { text: "Loading…", tone: "quiet" };
  }
  if (health.data.vault === "unconfigured") {
    return { text: "Vault unconfigured — sign up at the Bitwarden vault, set BW_* in Preferences, restart Chaavi.", tone: "quiet" };
  }
  if (items.isError) {
    return { text: messageOf(items.error), tone: "error" };
  }
  if (items.data === undefined) {
    return { text: "Loading…", tone: "quiet" };
  }
  return null;
}

type ListMessageProps = {
  children: ReactNode;
  tone?: "quiet" | "error";
};

/** A centered line in the list panel. */
function ListMessage({ children, tone = "quiet" }: ListMessageProps) {
  return (
    <div className="flex h-full min-h-[10rem] items-center justify-center px-3">
      <p className={`text-center text-[12px] leading-relaxed ${tone === "error" ? "text-error" : "text-ink-ghost"}`}>{children}</p>
    </div>
  );
}

