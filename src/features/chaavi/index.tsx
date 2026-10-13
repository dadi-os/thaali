/**
 * The vault page: a ledger of item types, the folder rail, the item list and the open item.
 * Owns the queries, mutations, search, scope and the drag that moves an item between
 * folders; vault.tsx draws the rail and rows, detail.tsx the item, editor.tsx the sheet.
 * Revealed secrets live in the detail and editor components only, never in the query cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { CHAAVI_VAULT, chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { IconPlus } from "../../shared/components/IconButton";
import { SearchField } from "../../shared/components/SearchField";
import { StateView, type StateViewProps } from "../../shared/components/states";
import { Ticker } from "../../shared/components/Ticker";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import type { ChaaviItem, ChaaviItemType, ChaaviUpdateItem } from "../../types/chaavi";
import { ItemDetail } from "./detail";
import { createBody, draftFromItem, emptyDraft, inScope, ITEM_TYPES, searchItems, TYPE_META, updateBody, type ItemDraft, type VaultScope } from "./draft";
import { ItemEditor } from "./editor";
import { FolderRail, ItemFace, ItemRow, Ledger, parseDrop, type DropTarget, type Landing } from "./vault";

/** Pointer travel before a press on a row becomes a drag. */
const DRAG_PX = 4;

/** How far the drag ghost sits right of the pointer, so the pointer holds it by its glyph. */
const GHOST_GRIP_PX = 24;

/**
 * The open item's pane as the selection moves: the new item rises from the side of the list
 * it was picked from (`custom` is +1 for further down, -1 for further up) out of a soft blur,
 * and the old one leaves the other way, quickly, so a run of clicks still feels immediate.
 */
const PANE = {
  enter: (dir: number) => ({ opacity: 0, y: dir * 18, filter: "blur(4px)" }),
  center: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: SLOW_S, ease: EASE, staggerChildren: 0.03, delayChildren: 0.03 },
  },
  exit: (dir: number) => ({ opacity: 0, y: dir * -12, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE } }),
};

type EditorState =
  | { mode: "closed" }
  | { mode: "create"; draft: ItemDraft }
  | { mode: "edit"; item: ChaaviItem; draft: ItemDraft };

type DragState = {
  id: string;
  /** The pressed row, where a drop on no target flies back to. */
  row: HTMLElement;
  startX: number;
  startY: number;
  dragging: boolean;
};

/**
 * The lifted copy of a dragged row. It follows the pointer while `drag`, then flies to the
 * folder that took it and sinks into it (`drop`) or flies back to its row (`return`).
 */
type Ghost = {
  id: string;
  over: string | null;
  phase: "drag" | "drop" | "return";
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
  const [landed, setLanded] = useState<Landing | null>(null);
  const [slide, setSlide] = useState(1);
  const ghostX = useMotionValue(0);
  const ghostY = useMotionValue(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;

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

  function dropAt(clientX: number, clientY: number): Element | null {
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .map((node) => node.closest("[data-drop]"))
      .find((node): node is Element => node !== null);
    return hit === undefined ? null : hit;
  }

  /** Select an item, sliding the open pane in from the side of the list it sits on. */
  function select(id: string): void {
    const from = shown.findIndex((item) => item.id === selectedId);
    const to = shown.findIndex((item) => item.id === id);
    setSlide(from === -1 || to === -1 ? 1 : Math.sign(to - from));
    setSelectedId(id);
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
    session.current = { id: item.id, row: event.currentTarget, startX: event.clientX, startY: event.clientY, dragging: false };
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
    ghostX.jump(event.clientX - canvas.left);
    ghostY.jump(event.clientY - canvas.top);
    const over = dropAt(event.clientX, event.clientY)?.getAttribute("data-drop");
    const key = over === undefined ? null : over;
    setGhost((prev) => (prev !== null && prev.phase === "drag" && prev.id === current.id && prev.over === key ? prev : { id: current.id, over: key, phase: "drag" }));
  }

  /**
   * End a press: a click selects; a drag drops the item on the folder under the pointer, and
   * its ghost flies there and sinks in (the folder flashing as it lands), or flies back to its
   * row when there is no target.
   */
  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>, item: ChaaviItem): void {
    const current = session.current;
    session.current = null;
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!current || current.id !== item.id || !canvas) {
      setGhost(null);
      return;
    }
    if (!current.dragging) {
      setGhost(null);
      select(item.id);
      return;
    }
    const landing = dropAt(event.clientX, event.clientY);
    const key = landing === null ? null : landing.getAttribute("data-drop");
    const target = key === null ? null : parseDrop(key);
    if (target !== null) {
      moveTo(item, target);
    }
    const rect = (target !== null && landing !== null ? landing : current.row).getBoundingClientRect();
    setGhost({ id: item.id, over: null, phase: target !== null ? "drop" : "return" });
    const flight = { duration: reduced ? 0 : SLOW_S, ease: EASE };
    void Promise.all([
      animate(ghostX, rect.left - canvas.left + GHOST_GRIP_PX + (target !== null ? 8 : 0), flight),
      animate(ghostY, rect.top + rect.height / 2 - canvas.top, flight),
    ]).then(() => {
      setGhost((prev) => (prev !== null && prev.phase === "drag" ? prev : null));
      if (key !== null && target !== null) {
        setLanded((prev) => ({ key, n: prev === null ? 1 : prev.n + 1 }));
      }
    });
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
            select(searched[0]!.id);
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

  const listTitle = typeFilter ? `${scopeTitle} · ${TYPE_META[typeFilter].many}` : scopeTitle;

  return (
    <div ref={canvasRef} className="relative flex h-full min-h-0 flex-col gap-4">
      {toolbar ? createPortal(toolbarContent, toolbar) : null}

      <Ledger counts={typeCounts} active={typeFilter} onPick={setTypeFilter} />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="widget-frame w-[15.5rem] shrink-0" aria-label="Folders">
          <div className="widget-frame__chrome !justify-between !px-5 !pt-3.5 !pb-3">
            <span className="widget-frame__title">Vault</span>
          </div>
          <motion.div layoutScroll className="widget-frame__body !overflow-y-auto border-t border-dashed border-sage-line">
            <FolderRail
              folders={folders}
              scope={scope}
              counts={{
                all: searched.length,
                favorites: searched.filter((item) => item.favorite).length,
                none: searched.filter((item) => item.folderId === null).length,
                byFolder,
              }}
              hot={ghost === null ? null : ghost.over}
              landed={landed}
              busy={folderOp.isPending}
              onScope={setScope}
              onCreate={(name) => folderOp.mutate({ op: "create", name })}
              onRename={(id, name) => folderOp.mutate({ op: "rename", id, name })}
              onDelete={(id) => folderOp.mutate({ op: "delete", id })}
            />
          </motion.div>
        </aside>

        <section className="widget-frame w-[min(100%,22rem)] shrink-0" aria-label="Items">
          <div className="widget-frame__chrome !justify-between !px-5 !pt-3.5 !pb-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={listTitle}
                className="widget-frame__title"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.85, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: EASE }}
              >
                {listTitle}
              </motion.span>
            </AnimatePresence>
            {items === null ? null : <Ticker value={shown.length} className="text-[11px] text-ink-ghost" />}
          </div>
          <motion.div layoutScroll className="widget-frame__body !overflow-y-auto border-t border-dashed border-sage-line p-2">
            <AnimatePresence mode="wait" initial={false}>
              {status !== null ? (
                <StateView key={`${status.tone}:${status.label}`} {...status} compact className="min-h-[10rem]" />
              ) : shown.length === 0 ? (
                <StateView
                  key="empty"
                  tone="empty"
                  label={query.trim() ? "No matches" : "Nothing here yet"}
                  detail={query.trim() ? `Nothing matches “${query.trim()}”` : undefined}
                  compact
                  className="min-h-[10rem]"
                />
              ) : (
                <ul key="items" className="relative flex flex-col gap-0.5">
                  <AnimatePresence mode="popLayout">
                    {shown.map((item, i) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        index={i}
                        selected={item.id === selectedId}
                        dragging={ghost !== null && ghost.id === item.id}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onSelect={(next) => select(next.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        <section className="widget-frame min-w-0 flex-1" aria-label="Item">
          <div ref={detailRef} className="widget-frame__body !overflow-y-auto">
            <AnimatePresence
              mode="wait"
              custom={slide}
              onExitComplete={() => detailRef.current?.scrollTo({ top: 0 })}
            >
              {selected ? (
                <motion.div
                  key={selected.id}
                  className="min-h-full"
                  custom={slide}
                  variants={PANE}
                  initial="enter"
                  animate="center"
                  exit="exit"
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
                  transition={{ duration: SLOW_S, ease: EASE }}
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
        <motion.div className="pointer-events-none absolute top-0 left-0 z-30" style={{ x: ghostX, y: ghostY }}>
          <motion.div
            className="flex w-72 -translate-x-6 -translate-y-1/2 items-center gap-3 rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--glass-sheet)] px-3 py-2.5 shadow-[var(--shadow-deep)] backdrop-blur-[var(--glass-blur)]"
            initial={{ opacity: 0, scale: 0.96, rotate: 0 }}
            animate={
              ghost.phase === "drag"
                ? { opacity: 1, scale: 1.03, rotate: -1.5 }
                : ghost.phase === "drop"
                  ? { opacity: 0, scale: 0.55, rotate: 0 }
                  : { opacity: 1, scale: 1, rotate: 0 }
            }
            transition={{ duration: SLOW_S, ease: EASE }}
          >
            <ItemFace item={dragged} />
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}

/** The real error message for display. */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * What the list shows instead of items while it cannot show them: offline, Chaavi's error
 * with a retry, loading, or an unconfigured vault. Null once items are in.
 */
function vaultStatus(
  connected: boolean,
  health: { isError: boolean; error: unknown; data?: { vault: "ready" | "unconfigured" } | undefined; refetch: () => Promise<unknown> },
  items: { isError: boolean; error: unknown; data?: unknown; refetch: () => Promise<unknown> },
): StateViewProps | null {
  if (!connected) {
    return { tone: "offline", label: "Chaavi is offline", detail: "The vault comes back when dadi reconnects" };
  }
  if (health.isError) {
    return { tone: "error", label: "Could not reach Chaavi", error: health.error, onRetry: () => void health.refetch() };
  }
  if (!health.data) {
    return { tone: "loading", label: "Opening the vault" };
  }
  if (health.data.vault === "unconfigured") {
    return {
      tone: "empty",
      label: "Vault unconfigured",
      detail: "Sign up at the Bitwarden vault, set BW_* in Preferences, then restart Chaavi",
    };
  }
  if (items.isError) {
    return { tone: "error", label: "Could not list items", error: items.error, onRetry: () => void items.refetch() };
  }
  if (items.data === undefined) {
    return { tone: "loading", label: "Reading items" };
  }
  return null;
}

