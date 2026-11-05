import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { draftFromItem, emptyDraft, createBody, inScope, searchItems, updateBody, type ItemDraft, type VaultScope } from "../features/chaavi/draft";
import { dropChange, useItemDrag, type DropTarget } from "../features/chaavi/drag";
import { FolderPane } from "../features/chaavi/FolderPane";
import { isWithin, subtreeRenames } from "../features/chaavi/folders";
import { ItemDetail } from "../features/chaavi/ItemDetail";
import { DragGhost, ItemList } from "../features/chaavi/ItemList";
import { ItemSheet } from "../features/chaavi/ItemSheet";
import { chaavi, isMeshOnline } from "../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../shared/api/chaavi";
import { Button } from "../shared/components/Button";
import { Card } from "../shared/components/Card";
import { StaleBanner, StateView } from "../shared/components/ModuleState";
import { Skeleton } from "../shared/components/Skeleton";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useRetained } from "../shared/hooks/useRetained";
import { useSize } from "../shared/hooks/useSize";
import { ConfirmDialog } from "../shared/overlay/ConfirmDialog";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { ChaaviItem, ChaaviUpdateItem } from "../types/chaavi";

/** The page is narrower than this before the folder pane goes and the list and the open item share it. */
const FOLDER_PANE_FROM = 800;

/** The page is at least this wide before the list takes 400 px instead of 340. */
const WIDE_LIST_FROM = 1500;

/** How long a sheet or dialog takes to leave, in ms. */

/** What is open over the page. */
type Overlay = { kind: "create"; draft: ItemDraft } | { kind: "edit"; item: ChaaviItem } | { kind: "delete"; item: ChaaviItem };

/** The page while the vault answers: cards of the loaded page's widths and row heights, so nothing shifts when it arrives. */
function Loading({ narrow, wide }: { narrow: boolean; wide: boolean }) {
  const list = (width: number) => (
    <Card style={{ width, flex: "none", minHeight: 0 }}>
      <div style={{ padding: "12px 12px 8px", flex: "none" }}>
        <Skeleton width="100%" height={40} radius={12} />
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "0 8px 8px" }}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, height: 56, padding: "0 10px" }}>
            <Skeleton width={36} height={36} radius={11} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton width={100 + ((i * 23) % 50)} height={14} />
              <Skeleton width={150} height={11} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
  const detail = (
    <Card style={{ flex: 1, minWidth: 0, minHeight: 0, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px 14px", flex: "none" }}>
        <Skeleton width={52} height={52} radius={16} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width={180} height={22} />
          <Skeleton width={120} height={12} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "0 22px 22px", gap: 10 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width="100%" height={56} radius={14} />
        ))}
      </div>
    </Card>
  );
  if (narrow) {
    return (
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 12, minHeight: 0 }}>
        {list(300)}
        {detail}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 14, minHeight: 0 }}>
      <Card style={{ width: 232, flex: "none", padding: 8, gap: 2, minHeight: 0 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", height: 38, padding: "0 12px", gap: 10 }}>
            <Skeleton width={15} height={15} radius={4} />
            <Skeleton width={`${40 + ((i * 17) % 30)}%`} height={14} />
            <Skeleton width={14} height={13} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </Card>
      {list(wide ? 400 : 340)}
      {detail}
    </div>
  );
}

/**
 * The Chaavi page: the vault as a folder pane, a searchable list of items and the open item. Chaavi is the vault (a Vaultwarden fork that
 * also serves /v1); the Bitwarden extension fills the browser. `?item=` names the item to open on. A new or edited item is a sheet from
 * the right edge and a delete is asked in a dialog; a failure of either toasts through the app's mutation cache. Secrets are asked for only when shown or copied.
 */
export function ChaaviPage() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [page, { width }] = useSize<HTMLDivElement>();
  const [pickedId, setPickedId] = useState<string | null>(params.get("item"));
  const [scope, setScope] = useState<VaultScope>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  const health = useQuery({ queryKey: CHAAVI_HEALTH_KEY, queryFn: () => chaavi.getHealth(), enabled: connected });
  const open = health.data?.vault === "ready";
  const itemsQuery = useQuery({ queryKey: CHAAVI_ITEMS_KEY, queryFn: () => chaavi.listItems(), enabled: connected && open });
  const foldersQuery = useQuery({ queryKey: CHAAVI_FOLDERS_KEY, queryFn: () => chaavi.listFolders(), enabled: connected && open });
  const healthState = useModuleState(health, () => false);
  const itemsState = useModuleState(itemsQuery, (answer) => answer.items.length === 0);
  const foldersState = useModuleState(foldersQuery, () => false);
  const failed = [healthState, itemsState, foldersState].find((state) => state.kind === "error" || state.kind === "module-offline");
  const state = failed ?? itemsState;
  const retry = () => void [health, itemsQuery, foldersQuery].find((query_) => query_.isError)?.refetch();
  const unconfigured = health.data?.vault === "unconfigured";

  const items = itemsState.kind === "ready" ? itemsState.data.items : [];
  const folders = foldersState.kind === "ready" ? foldersState.data.folders : [];
  const activeScope: VaultScope = scope.kind === "folder" && !folders.some((folder) => isWithin(folder.name, scope.path)) ? { kind: "all" } : scope;
  const listed = useMemo(
    () => searchItems(items, query).filter((item) => inScope(item, activeScope, folders)).sort((a, b) => a.name.localeCompare(b.name)),
    [items, query, activeScope, folders],
  );
  const selected = listed.find((item) => item.id === pickedId) ?? listed[0] ?? null;

  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: CHAAVI_ITEMS_KEY }), queryClient.invalidateQueries({ queryKey: CHAAVI_FOLDERS_KEY })]);

  const close = () => setOverlay(null);
  const shown = useRetained(overlay);

  const patch = useMutation({
    mutationFn: (input: { id: string; body: ChaaviUpdateItem }) => chaavi.updateItem(input.id, input.body),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CHAAVI_ITEMS_KEY });
      const previous = queryClient.getQueryData<{ items: ChaaviItem[] }>(CHAAVI_ITEMS_KEY);
      queryClient.setQueryData<{ items: ChaaviItem[] }>(CHAAVI_ITEMS_KEY, (current) =>
        current === undefined
          ? current
          : { items: current.items.map((item) => (item.id === input.id ? { ...item, favorite: input.body.favorite ?? item.favorite, folderId: input.body.folderId === undefined ? item.folderId : input.body.folderId } : item)) },
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
      setPickedId(item.id);
      close();
    },
  });

  const folderOp = useMutation({
    mutationFn: (input: { op: "create"; path: string } | { op: "rename"; from: string; to: string } | { op: "delete"; id: string }): Promise<unknown> => {
      if (input.op === "create") {
        return chaavi.createFolder(input.path);
      }
      if (input.op === "rename") {
        return Promise.all(subtreeRenames(folders, input.from, input.to).map((entry) => chaavi.renameFolder(entry.id, entry.name)));
      }
      return chaavi.deleteFolder(input.id);
    },
    onSettled: () => void invalidate(),
  });

  const drag = useItemDrag({
    container: page,
    onSelect: setPickedId,
    onDrop: (item: ChaaviItem, target: DropTarget) => {
      const change = dropChange(item, target);
      if (change !== null) {
        patch.mutate({ id: item.id, body: change });
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => chaavi.deleteItem(id),
    onSuccess: async () => {
      await invalidate();
      setPickedId(null);
      close();
    },
  });

  const narrow = width < FOLDER_PANE_FROM;
  const ready = state.kind === "ready";
  const canAdd = ready || state.kind === "empty";
  const wideList = width >= WIDE_LIST_FROM;

  let body;
  if (unconfigured) {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="empty" title="Vault unconfigured" detail="Set the vault account in Preferences → Chaavi" />
      </Card>
    );
  } else if (state.kind === "loading" || (state.kind === "ready" && foldersState.kind === "loading")) {
    body = <Loading narrow={narrow} wide={wideList} />;
  } else if (state.kind === "offline") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
      </Card>
    );
  } else if (state.kind === "module-offline") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="module-offline" title="Chaavi isn’t answering" detail="The vault service is down. Your other modules still work." service={`${state.error.service}.dadi`} status={state.error.status} onRetry={retry} />
      </Card>
    );
  } else if (state.kind === "error") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="error" title="Chaavi failed to answer" {...failureProps(state.error)} onRetry={retry} />
      </Card>
    );
  } else if (state.kind === "empty") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="empty" title="The vault is empty" detail="Create your first login or secure note." />
      </Card>
    );
  } else {
    const list = <ItemList items={listed} selectedId={selected?.id ?? null} query={query} onQuery={setQuery} onSelect={setPickedId} draggingId={drag.draggingId} drag={drag.handlers} width={narrow ? 300 : wideList ? 400 : 340} />;
    const detail =
      selected === null ? (
        <Card style={{ flex: 1, minWidth: 0 }}>
          <StateView kind="empty" title="No item open" detail="Nothing in the list to open." />
        </Card>
      ) : (
        <ItemDetail
          key={selected.id}
          item={selected}
          folders={folders}
          busy={patch.isPending || remove.isPending}
          onEdit={() => setOverlay({ kind: "edit", item: selected })}
          onToggleFavorite={() => patch.mutate({ id: selected.id, body: { favorite: !selected.favorite } })}
          onDelete={() => setOverlay({ kind: "delete", item: selected })}
        />
      );
    body = narrow ? (
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 12, minHeight: 0 }}>
        {list}
        {detail}
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 14, minHeight: 0 }}>
        <FolderPane
          items={items}
          folders={folders}
          scope={activeScope}
          busy={folderOp.isPending}
          hot={drag.hot}
          onScope={setScope}
          onCreate={(path) => folderOp.mutate({ op: "create", path })}
          onRename={(from, to) => {
            if (activeScope.kind === "folder" && isWithin(activeScope.path, from)) {
              setScope({ kind: "folder", path: to + activeScope.path.slice(from.length) });
            }
            folderOp.mutate({ op: "rename", from, to });
          }}
          onDelete={(id) => folderOp.mutate({ op: "delete", id })}
        />
        {list}
        {detail}
      </div>
    );
  }

  return (
    <div ref={page} data-page="chaavi" style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "18px 20px 20px", gap: 14, minHeight: 0 }}>
        <PageHeader
          title="Chaavi"
          meta={ready ? `${items.length} items` : undefined}
          trailing={
            canAdd ? (
              <Button tone="fill" size="lg" icon="plus" onClick={() => setOverlay({ kind: "create", draft: emptyDraft("login", activeScope.kind === "folder" ? (folders.find((folder) => folder.name === activeScope.path)?.id ?? null) : null) })}>
                New item
              </Button>
            ) : undefined
          }
        />
        {ready && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Chaavi reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={retry} /> : null}
        {body}
      </div>
      {shown?.kind === "create" || shown?.kind === "edit" ? (
        <ItemSheet
          open={overlay !== null}
          mode={shown.kind}
          initial={shown.kind === "create" ? shown.draft : draftFromItem(shown.item)}
          itemId={shown.kind === "edit" ? shown.item.id : null}
          folders={folders}
          pending={save.isPending}
          onClose={close}
          onSubmit={(draft) => save.mutate(shown.kind === "create" ? { mode: "create", draft } : { mode: "edit", item: shown.item, draft })}
        />
      ) : null}
      {drag.ghost === null ? null : <DragGhost name={drag.ghost.item.name} x={drag.ghost.x} y={drag.ghost.y} />}
      {shown?.kind === "delete" ? (
        <ConfirmDialog
          open={overlay !== null}
          title={`Delete ${shown.item.name}?`}
          detail="It moves to the vault’s trash on every device."
          confirmLabel="Delete"
          pending={remove.isPending}
          onCancel={close}
          onConfirm={() => remove.mutate(shown.item.id)}
        />
      ) : null}
    </div>
  );
}
